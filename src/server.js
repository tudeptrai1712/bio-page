require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');

const { db, uploadsDir } = require('./db');
const {
  COOKIE_NAME,
  generateToken,
  hashPassword,
  comparePassword,
  requireAuth
} = require('./auth');

const {
  getCache,
  setCache,
  invalidateProfileCache,
  setChallenge,
  getChallenge,
  delChallenge,
  incrRealtimeView,
  incrRealtimeClick
} = require('./redis');

const {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuth
} = require('./webauthn');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Multer storage for media uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'upload-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|svg|webp|ico/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mime = file.mimetype.toLowerCase();
  if (allowed.test(ext) && (mime.startsWith('image/') || mime === 'image/svg+xml')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, gif, webp, svg, ico) are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Static files
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '..', 'public')));

// -------------------------------------------------------------
// PUBLIC API ROUTES (WITH REDIS ACCELERATION)
// -------------------------------------------------------------

// Get full bio page public profile (with Redis caching)
app.get('/api/profile', async (req, res) => {
  try {
    const cached = await getCache('bio:public_profile');
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
    const links = db.prepare('SELECT id, title, url, description, icon, is_highlighted, display_order FROM links WHERE enabled = 1 ORDER BY display_order ASC, id ASC').all();
    const socials = db.prepare('SELECT id, platform, url, icon, display_order FROM social_links WHERE enabled = 1 ORDER BY display_order ASC, id ASC').all();

    const responseData = {
      profile: profile || {},
      links: links || [],
      socials: socials || []
    };

    // Cache in Redis for 10 minutes (600s)
    await setCache('bio:public_profile', responseData, 600);

    res.setHeader('X-Cache', 'MISS');
    res.json(responseData);
  } catch (err) {
    console.error('Error fetching public profile:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// Record page view analytics
app.post('/api/analytics/view', async (req, res) => {
  try {
    const referrer = req.body.referrer || req.get('referrer') || '';
    const userAgent = req.get('user-agent') || '';

    // Atomic Redis increment
    incrRealtimeView();

    // Persistent storage in SQLite
    db.prepare(`
      INSERT INTO analytics (event_type, target_id, referrer, user_agent)
      VALUES ('view', NULL, ?, ?)
    `).run(referrer.slice(0, 500), userAgent.slice(0, 500));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record analytics' });
  }
});

// Record link click analytics
app.post('/api/analytics/click/:id', async (req, res) => {
  try {
    const linkId = parseInt(req.params.id, 10);
    if (isNaN(linkId)) return res.status(400).json({ error: 'Invalid link ID' });

    const referrer = req.body.referrer || req.get('referrer') || '';
    const userAgent = req.get('user-agent') || '';

    // Atomic Redis increment
    incrRealtimeClick(linkId);

    // Increment click count in SQLite
    db.prepare('UPDATE links SET clicks = clicks + 1 WHERE id = ?').run(linkId);

    // Record analytics event
    db.prepare(`
      INSERT INTO analytics (event_type, target_id, referrer, user_agent)
      VALUES ('click', ?, ?, ?)
    `).run(linkId, referrer.slice(0, 500), userAgent.slice(0, 500));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record click' });
  }
});

// -------------------------------------------------------------
// AUTHENTICATION & WEBAUTHN (PASSKEYS) ROUTES
// -------------------------------------------------------------

// Standard Password Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = generateToken(user);

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username }
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !comparePassword(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const updatedUsername = (newUsername && newUsername.trim()) ? newUsername.trim() : user.username;
  let updatedHash = user.password_hash;

  if (newPassword && newPassword.trim()) {
    if (newPassword.trim().length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    updatedHash = hashPassword(newPassword.trim());
  }

  try {
    db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(
      updatedUsername,
      updatedHash,
      user.id
    );

    const newToken = generateToken({ id: user.id, username: updatedUsername });
    res.cookie(COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, message: 'Credentials updated successfully', username: updatedUsername });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username is already taken' });
    }
    res.status(500).json({ error: 'Failed to update credentials' });
  }
});

// -------------------------------------------------------------
// WEBAUTHN (PASSKEY BIOMETRICS) ENDPOINTS
// -------------------------------------------------------------

// 1. Generate Registration Options (Admin only)
app.get('/api/auth/webauthn/register-options', requireAuth, async (req, res) => {
  try {
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existingAuthenticators = db.prepare('SELECT credential_id, transports FROM authenticators WHERE user_id = ?').all(user.id);
    const options = await getRegistrationOptions(user, existingAuthenticators);

    // Save challenge in Redis (5 min TTL)
    await setChallenge(`reg:${user.id}`, options.challenge, 300);

    res.json(options);
  } catch (err) {
    console.error('Error generating registration options:', err);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

// 2. Verify Registration Response & Save Passkey (Admin only)
app.post('/api/auth/webauthn/register-verify', requireAuth, async (req, res) => {
  try {
    const { registrationResponse, deviceName } = req.body;
    const userId = req.user.id;

    const expectedChallenge = await getChallenge(`reg:${userId}`);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Registration challenge expired. Please try again.' });
    }

    const verification = await verifyRegistration(registrationResponse, expectedChallenge);

    if (verification.verified && verification.registrationInfo) {
      const regInfo = verification.registrationInfo;
      const credential = regInfo.credential || {};
      const credentialID = credential.id || regInfo.credentialID;
      const rawPublicKey = credential.publicKey || regInfo.credentialPublicKey;
      const credentialPublicKey = rawPublicKey ? Buffer.from(rawPublicKey).toString('base64') : '';
      const counter = credential.counter ?? regInfo.counter ?? 0;
      const transports = credential.transports 
        ? JSON.stringify(credential.transports) 
        : (regInfo.transports ? JSON.stringify(regInfo.transports) : (registrationResponse.response?.transports ? JSON.stringify(registrationResponse.response.transports) : '[]'));

      db.prepare(`
        INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter, transports, device_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        credentialID,
        credentialPublicKey,
        counter,
        transports,
        deviceName || 'Biometric Key / Passkey'
      );

      await delChallenge(`reg:${userId}`);
      res.json({ success: true, message: 'Passkey registered successfully!' });
    } else {
      res.status(400).json({ error: 'Verification failed' });
    }
  } catch (err) {
    console.error('Error verifying passkey registration:', err);
    res.status(400).json({ error: err.message || 'Passkey verification failed' });
  }
});

// 3. Generate Authentication Options (Public - for login)
app.get('/api/auth/webauthn/auth-options', async (req, res) => {
  try {
    const authenticators = db.prepare('SELECT credential_id, transports FROM authenticators').all();
    const options = await getAuthenticationOptions(authenticators);

    // Save login challenge in Redis with session/temp ID
    const challengeKey = req.query.sessionKey || 'public_login';
    await setChallenge(`auth:${challengeKey}`, options.challenge, 300);

    res.json(options);
  } catch (err) {
    console.error('Error generating auth options:', err);
    res.status(500).json({ error: 'Failed to generate authentication options' });
  }
});

// 4. Verify Authentication Response (Public - logs in with Passkey)
app.post('/api/auth/webauthn/auth-verify', async (req, res) => {
  try {
    const { authResponse, sessionKey } = req.body;
    const challengeKey = sessionKey || 'public_login';

    const expectedChallenge = await getChallenge(`auth:${challengeKey}`);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Login challenge expired. Please retry.' });
    }

    const credentialId = authResponse.id;
    const authenticator = db.prepare('SELECT * FROM authenticators WHERE credential_id = ?').get(credentialId);
    if (!authenticator) {
      return res.status(400).json({ error: 'Unrecognized passkey device.' });
    }

    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(authenticator.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const verification = await verifyAuth(authResponse, expectedChallenge, authenticator);

    if (verification.verified) {
      // Update counter and last_used_at
      const newCounter = verification.authenticationInfo?.newCounter 
        ?? verification.authenticationInfo?.counter 
        ?? (Number(authenticator.counter) + 1);

      db.prepare(`
        UPDATE authenticators
        SET counter = ?, last_used_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newCounter, authenticator.id);

      await delChallenge(`auth:${challengeKey}`);

      // Issue JWT session token
      const token = generateToken(user);
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        token,
        user: { id: user.id, username: user.username }
      });
    } else {
      res.status(400).json({ error: 'Passkey verification failed' });
    }
  } catch (err) {
    console.error('Error verifying passkey authentication:', err);
    res.status(400).json({ error: err.message || 'Passkey authentication failed' });
  }
});

// 5. List Registered Passkeys (Admin only)
app.get('/api/admin/authenticators', requireAuth, (req, res) => {
  try {
    const authenticators = db.prepare(`
      SELECT id, device_name, created_at, last_used_at
      FROM authenticators
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(req.user.id);
    res.json(authenticators || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch authenticators' });
  }
});

// 6. Delete / Revoke Passkey (Admin only)
app.delete('/api/admin/authenticators/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    db.prepare('DELETE FROM authenticators WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true, message: 'Passkey deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete passkey' });
  }
});

// -------------------------------------------------------------
// ADMIN MANAGEMENT ROUTES (PROTECTED)
// -------------------------------------------------------------

// Get admin profile
app.get('/api/admin/profile', requireAuth, (req, res) => {
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  res.json(profile || {});
});

// Update profile details (auto-invalidates Redis cache)
app.put('/api/admin/profile', requireAuth, async (req, res) => {
  const {
    name,
    handle,
    tagline,
    bio,
    avatar_url,
    banner_url,
    theme,
    accent_color,
    background_type,
    background_value,
    seo_title,
    seo_description,
    footer_text,
    contact_email,
    contact_phone,
    contact_whatsapp,
    contact_telegram,
    contact_signal,
    color_mode,
    show_share_button
  } = req.body;

  try {
    db.prepare(`
      UPDATE profile SET
        name = ?,
        handle = ?,
        tagline = ?,
        bio = ?,
        avatar_url = ?,
        banner_url = ?,
        theme = ?,
        accent_color = ?,
        background_type = ?,
        background_value = ?,
        seo_title = ?,
        seo_description = ?,
        footer_text = ?,
        contact_email = ?,
        contact_phone = ?,
        contact_whatsapp = ?,
        contact_telegram = ?,
        contact_signal = ?,
        color_mode = ?,
        show_share_button = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      name || '',
      handle || '',
      tagline || '',
      bio || '',
      avatar_url || '',
      banner_url || '',
      theme || 'classic-gray',
      accent_color || '#818cf8',
      background_type || 'preset',
      background_value || 'classic-gray',
      seo_title || 'My Bio Page',
      seo_description || '',
      footer_text || '',
      contact_email || '',
      contact_phone || '',
      contact_whatsapp || '',
      contact_telegram || '',
      contact_signal || '',
      color_mode || 'auto',
      show_share_button ? 1 : 0
    );

    // Invalidate Redis Cache
    await invalidateProfileCache();

    const updated = db.prepare('SELECT * FROM profile WHERE id = 1').get();
    res.json({ success: true, profile: updated });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile settings' });
  }
});

// File upload (Avatar / Banner)
app.post('/api/admin/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    fileUrl: fileUrl,
    filename: req.file.filename
  });
});

// Get all links (admin)
app.get('/api/admin/links', requireAuth, (req, res) => {
  const links = db.prepare('SELECT * FROM links ORDER BY display_order ASC, id ASC').all();
  res.json(links || []);
});

// Create new link
app.post('/api/admin/links', requireAuth, async (req, res) => {
  const { title, url, description, icon, is_highlighted, enabled } = req.body;

  if (!title || !url) {
    return res.status(400).json({ error: 'Title and URL are required' });
  }

  try {
    const maxOrderRow = db.prepare('SELECT MAX(display_order) as maxOrder FROM links').get();
    const nextOrder = (maxOrderRow.maxOrder || 0) + 1;

    const result = db.prepare(`
      INSERT INTO links (title, url, description, icon, is_highlighted, display_order, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      url,
      description || '',
      icon || '🔗',
      is_highlighted ? 1 : 0,
      nextOrder,
      enabled !== undefined ? (enabled ? 1 : 0) : 1
    );

    await invalidateProfileCache();

    const newLink = db.prepare('SELECT * FROM links WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, link: newLink });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create link' });
  }
});

// Update link
app.put('/api/admin/links/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, url, description, icon, is_highlighted, enabled, display_order } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM links WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Link not found' });

    db.prepare(`
      UPDATE links SET
        title = ?,
        url = ?,
        description = ?,
        icon = ?,
        is_highlighted = ?,
        enabled = ?,
        display_order = ?
      WHERE id = ?
    `).run(
      title !== undefined ? title : existing.title,
      url !== undefined ? url : existing.url,
      description !== undefined ? description : existing.description,
      icon !== undefined ? icon : existing.icon,
      is_highlighted !== undefined ? (is_highlighted ? 1 : 0) : existing.is_highlighted,
      enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
      display_order !== undefined ? display_order : existing.display_order,
      id
    );

    await invalidateProfileCache();

    const updated = db.prepare('SELECT * FROM links WHERE id = ?').get(id);
    res.json({ success: true, link: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update link' });
  }
});

// Delete link
app.delete('/api/admin/links/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    db.prepare('DELETE FROM links WHERE id = ?').run(id);
    await invalidateProfileCache();
    res.json({ success: true, message: 'Link deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

// Reorder links
app.post('/api/admin/links/reorder', requireAuth, async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'Order must be an array of link IDs' });
  }

  const updateStmt = db.prepare('UPDATE links SET display_order = ? WHERE id = ?');
  const transaction = db.transaction((ids) => {
    ids.forEach((id, index) => {
      updateStmt.run(index + 1, id);
    });
  });

  try {
    transaction(order);
    await invalidateProfileCache();
    res.json({ success: true, message: 'Links reordered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder links' });
  }
});

// Get social links
app.get('/api/admin/socials', requireAuth, (req, res) => {
  const socials = db.prepare('SELECT * FROM social_links ORDER BY display_order ASC, id ASC').all();
  res.json(socials || []);
});

// Batch update social links
app.post('/api/admin/socials', requireAuth, async (req, res) => {
  const { socials } = req.body;

  if (!Array.isArray(socials)) {
    return res.status(400).json({ error: 'Socials must be an array' });
  }

  const transaction = db.transaction((items) => {
    db.prepare('DELETE FROM social_links').run();
    const insertStmt = db.prepare(`
      INSERT INTO social_links (platform, url, icon, display_order, enabled)
      VALUES (?, ?, ?, ?, ?)
    `);

    items.forEach((item, index) => {
      if (item.url && item.url.trim()) {
        insertStmt.run(
          item.platform || 'custom',
          item.url.trim(),
          item.icon || '',
          index + 1,
          item.enabled !== undefined ? (item.enabled ? 1 : 0) : 1
        );
      }
    });
  });

  try {
    transaction(socials);
    await invalidateProfileCache();
    const updated = db.prepare('SELECT * FROM social_links ORDER BY display_order ASC, id ASC').all();
    res.json({ success: true, socials: updated });
  } catch (err) {
    console.error('Error saving socials:', err);
    res.status(500).json({ error: 'Failed to update social links' });
  }
});

// Admin Stats & Analytics
app.get('/api/admin/stats', requireAuth, (req, res) => {
  try {
    const totalViews = db.prepare("SELECT COUNT(*) as count FROM analytics WHERE event_type = 'view'").get().count;
    const totalClicks = db.prepare("SELECT COUNT(*) as count FROM analytics WHERE event_type = 'click'").get().count;

    const linkStats = db.prepare(`
      SELECT id, title, url, icon, clicks, enabled
      FROM links
      ORDER BY clicks DESC, display_order ASC
    `).all();

    const recentViews = db.prepare(`
      SELECT DATE(timestamp) as date, COUNT(*) as count
      FROM analytics
      WHERE event_type = 'view' AND timestamp >= datetime('now', '-7 days')
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `).all();

    const recentClicks = db.prepare(`
      SELECT DATE(timestamp) as date, COUNT(*) as count
      FROM analytics
      WHERE event_type = 'click' AND timestamp >= datetime('now', '-7 days')
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `).all();

    res.json({
      totalViews,
      totalClicks,
      linkStats,
      recentViews,
      recentClicks
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`🚀 Bio Page server running on port ${PORT}`);
  console.log(`🌐 Public Bio Page: http://localhost:${PORT}`);
  console.log(`🔒 Admin Dashboard: http://localhost:${PORT}/login.html`);
  console.log(`=========================================`);
});
