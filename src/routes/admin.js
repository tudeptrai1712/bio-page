const express = require('express');
const router = express.Router();

const { db } = require('../db');
const { requireAuth } = require('../auth');
const { invalidateProfileCache } = require('../redis');
const { upload, verifyUploadedFileSignature } = require('../middleware/upload');
const { adminRateLimiter } = require('../middleware/rateLimit');
const { adminCacheControl, isValidUrlScheme, sanitizeUrl } = require('../middleware/security');
const { Logger } = require('../logger');

// Apply authentication, rate limiting, and no-cache headers to all admin routes (ASVS V4/V8/V13)
router.use(requireAuth);
router.use(adminRateLimiter);
router.use(adminCacheControl);

// -------------------------------------------------------------
// PROFILE & CUSTOMIZATION
// -------------------------------------------------------------

// Get admin profile
router.get('/profile', (req, res) => {
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  res.json(profile || {});
});

// Update profile details (auto-invalidates Redis cache)
router.put('/profile', async (req, res) => {
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
    contact_zalo,
    color_mode,
    show_share_button,
    allow_password_login
  } = req.body;

  // Validate URL schemes for avatar, banner, and background if URLs (ASVS V5)
  if (avatar_url && !isValidUrlScheme(avatar_url)) {
    return res.status(400).json({ error: 'Invalid avatar URL scheme.' });
  }
  if (banner_url && !isValidUrlScheme(banner_url)) {
    return res.status(400).json({ error: 'Invalid banner URL scheme.' });
  }
  if (background_type === 'image' && background_value && !isValidUrlScheme(background_value)) {
    return res.status(400).json({ error: 'Invalid background image URL scheme.' });
  }

  // Validate Accent Color format (hex code)
  if (accent_color && !/^#([0-9a-fA-F]{3}){1,2}$/.test(accent_color.trim())) {
    return res.status(400).json({ error: 'Invalid accent color hex code.' });
  }

  try {
    // Safety check: Prevent disabling password sign-in if no passkeys are registered
    if (allow_password_login !== undefined && (allow_password_login === 0 || allow_password_login === false || allow_password_login === '0')) {
      const passkeyCount = db.prepare('SELECT COUNT(*) as count FROM authenticators WHERE user_id = ?').get(req.user.id).count;
      if (passkeyCount === 0) {
        return res.status(400).json({
          error: 'Cannot disable password sign-in! You must register at least one WebAuthn Passkey first to avoid locking yourself out.'
        });
      }
    }

    const current = db.prepare('SELECT allow_password_login FROM profile WHERE id = 1').get();
    const finalAllowPassword = allow_password_login !== undefined
      ? (allow_password_login ? 1 : 0)
      : (current ? current.allow_password_login : 1);

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
        contact_zalo = ?,
        color_mode = ?,
        show_share_button = ?,
        allow_password_login = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      (name || '').substring(0, 100),
      (handle || '').substring(0, 50),
      (tagline || '').substring(0, 200),
      (bio || '').substring(0, 1000),
      sanitizeUrl(avatar_url),
      sanitizeUrl(banner_url),
      (theme || 'classic-gray').substring(0, 50),
      (accent_color || '#818cf8').substring(0, 20),
      (background_type || 'preset').substring(0, 20),
      (background_value || 'classic-gray').substring(0, 500),
      (seo_title || 'My Bio Page').substring(0, 100),
      (seo_description || '').substring(0, 300),
      (footer_text || '').substring(0, 200),
      (contact_email || '').substring(0, 100),
      (contact_phone || '').substring(0, 50),
      (contact_whatsapp || '').substring(0, 100),
      (contact_telegram || '').substring(0, 100),
      (contact_signal || '').substring(0, 100),
      (contact_zalo || '').substring(0, 100),
      (color_mode || 'auto').substring(0, 10),
      show_share_button !== undefined ? (show_share_button ? 1 : 0) : 1,
      finalAllowPassword
    );

    // Invalidate Redis Cache
    await invalidateProfileCache();

    Logger.audit('PROFILE_UPDATED', req, { userId: req.user.id });

    const updated = db.prepare('SELECT * FROM profile WHERE id = 1').get();
    res.json({ success: true, profile: updated });
  } catch (err) {
    Logger.error('Error updating profile settings', err, req);
    res.status(500).json({ error: 'Failed to update profile settings' });
  }
});

// File upload with magic byte validation (ASVS V12)
router.post('/upload', upload.single('file'), verifyUploadedFileSignature, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  Logger.audit('FILE_UPLOADED', req, { filename: req.file.filename, size: req.file.size });

  res.json({
    success: true,
    fileUrl: fileUrl,
    filename: req.file.filename
  });
});

// -------------------------------------------------------------
// LINKS MANAGEMENT
// -------------------------------------------------------------

// Get all links
router.get('/links', (req, res) => {
  const links = db.prepare('SELECT * FROM links ORDER BY display_order ASC, id ASC').all();
  res.json(links || []);
});

// Create new link (ASVS V5 URL Scheme Validation)
router.post('/links', async (req, res) => {
  const { title, url, description, icon, is_highlighted, enabled } = req.body;

  if (!title || !url) {
    return res.status(400).json({ error: 'Title and URL are required' });
  }

  if (!isValidUrlScheme(url)) {
    return res.status(400).json({ error: 'Invalid URL scheme. Only HTTP, HTTPS, mailto, and tel are permitted.' });
  }

  try {
    const maxOrderRow = db.prepare('SELECT MAX(display_order) as maxOrder FROM links').get();
    const nextOrder = (maxOrderRow.maxOrder || 0) + 1;

    const result = db.prepare(`
      INSERT INTO links (title, url, description, icon, is_highlighted, display_order, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.substring(0, 150),
      url.trim().substring(0, 1000),
      (description || '').substring(0, 300),
      (icon || '🔗').substring(0, 100),
      is_highlighted ? 1 : 0,
      nextOrder,
      enabled !== undefined ? (enabled ? 1 : 0) : 1
    );

    await invalidateProfileCache();

    Logger.audit('LINK_CREATED', req, { linkId: result.lastInsertRowid, title });

    const newLink = db.prepare('SELECT * FROM links WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, link: newLink });
  } catch (err) {
    Logger.error('Failed to create link', err, req);
    res.status(500).json({ error: 'Failed to create link' });
  }
});

// Update link (ASVS V5 URL Scheme Validation)
router.put('/links/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, url, description, icon, is_highlighted, enabled, display_order } = req.body;

  if (url !== undefined && !isValidUrlScheme(url)) {
    return res.status(400).json({ error: 'Invalid URL scheme. Only HTTP, HTTPS, mailto, and tel are permitted.' });
  }

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
      title !== undefined ? title.substring(0, 150) : existing.title,
      url !== undefined ? url.trim().substring(0, 1000) : existing.url,
      description !== undefined ? description.substring(0, 300) : existing.description,
      icon !== undefined ? icon.substring(0, 100) : existing.icon,
      is_highlighted !== undefined ? (is_highlighted ? 1 : 0) : existing.is_highlighted,
      enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
      display_order !== undefined ? display_order : existing.display_order,
      id
    );

    await invalidateProfileCache();

    Logger.audit('LINK_UPDATED', req, { linkId: id });

    const updated = db.prepare('SELECT * FROM links WHERE id = ?').get(id);
    res.json({ success: true, link: updated });
  } catch (err) {
    Logger.error('Failed to update link', err, req);
    res.status(500).json({ error: 'Failed to update link' });
  }
});

// Delete link
router.delete('/links/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    db.prepare('DELETE FROM links WHERE id = ?').run(id);
    await invalidateProfileCache();
    Logger.audit('LINK_DELETED', req, { linkId: id });
    res.json({ success: true, message: 'Link deleted' });
  } catch (err) {
    Logger.error('Failed to delete link', err, req);
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

// Reorder links
router.post('/links/reorder', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'Order must be an array of link IDs' });
  }

  const updateStmt = db.prepare('UPDATE links SET display_order = ? WHERE id = ?');
  const transaction = db.transaction((ids) => {
    ids.forEach((id, index) => {
      updateStmt.run(index + 1, parseInt(id, 10));
    });
  });

  try {
    transaction(order);
    await invalidateProfileCache();
    Logger.audit('LINKS_REORDERED', req);
    res.json({ success: true, message: 'Links reordered successfully' });
  } catch (err) {
    Logger.error('Failed to reorder links', err, req);
    res.status(500).json({ error: 'Failed to reorder links' });
  }
});

// -------------------------------------------------------------
// SOCIAL LINKS MANAGEMENT
// -------------------------------------------------------------

// Get social links
router.get('/socials', (req, res) => {
  const socials = db.prepare('SELECT * FROM social_links ORDER BY display_order ASC, id ASC').all();
  res.json(socials || []);
});

// Batch update social links (ASVS V5 URL Scheme Validation)
router.post('/socials', async (req, res) => {
  const { socials } = req.body;

  if (!Array.isArray(socials)) {
    return res.status(400).json({ error: 'Socials must be an array' });
  }

  for (const item of socials) {
    if (item.url && !isValidUrlScheme(item.url)) {
      return res.status(400).json({ error: `Invalid URL scheme for ${item.platform || 'social'}` });
    }
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
          (item.platform || 'custom').substring(0, 50),
          item.url.trim().substring(0, 1000),
          (item.icon || '').substring(0, 100),
          index + 1,
          item.enabled !== undefined ? (item.enabled ? 1 : 0) : 1
        );
      }
    });
  });

  try {
    transaction(socials);
    await invalidateProfileCache();
    Logger.audit('SOCIALS_UPDATED', req, { count: socials.length });
    const updated = db.prepare('SELECT * FROM social_links ORDER BY display_order ASC, id ASC').all();
    res.json({ success: true, socials: updated });
  } catch (err) {
    Logger.error('Error saving socials', err, req);
    res.status(500).json({ error: 'Failed to update social links' });
  }
});

// -------------------------------------------------------------
// AUTHENTICATORS (PASSKEYS) MANAGEMENT
// -------------------------------------------------------------

// List registered passkeys
router.get('/authenticators', (req, res) => {
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

// Delete / Revoke passkey (Protected against deleting sole remaining auth method)
router.delete('/authenticators/:id', (req, res) => {
  try {
    const profile = db.prepare('SELECT allow_password_login FROM profile WHERE id = 1').get();
    if (profile && profile.allow_password_login === 0) {
      const count = db.prepare('SELECT COUNT(*) as count FROM authenticators WHERE user_id = ?').get(req.user.id).count;
      if (count <= 1) {
        return res.status(400).json({
          error: 'Cannot delete your only registered Passkey while Password Sign-In is disabled. Enable password login or register a backup Passkey first.'
        });
      }
    }

    const id = parseInt(req.params.id, 10);
    db.prepare('DELETE FROM authenticators WHERE id = ? AND user_id = ?').run(id, req.user.id);

    Logger.audit('PASSKEY_REVOKED', req, { authenticatorId: id });

    res.json({ success: true, message: 'Passkey deleted successfully' });
  } catch (err) {
    Logger.error('Failed to delete passkey', err, req);
    res.status(500).json({ error: 'Failed to delete passkey' });
  }
});

// -------------------------------------------------------------
// ANALYTICS & STATS
// -------------------------------------------------------------

// Admin Stats & Analytics
router.get('/stats', (req, res) => {
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
    Logger.error('Failed to load analytics', err, req);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

module.exports = router;
