const express = require('express');
const router = express.Router();

const { db } = require('../db');
const {
  COOKIE_NAME,
  generateToken,
  hashPassword,
  comparePassword,
  blacklistToken,
  setAuthCookie,
  validatePasswordStrength,
  requireAuth
} = require('../auth');
const { authRateLimiter } = require('../middleware/rateLimit');
const { adminCacheControl } = require('../middleware/security');
const { Logger } = require('../logger');
const {
  generateTotpSecret,
  verifyTotp,
  getOtpAuthUrl
} = require('../totp');
const { setCache, getCache, delCache } = require('../redis');

// Standard Password Login (Protected by Auth Rate Limiter - ASVS V2/V13)
router.post('/login', authRateLimiter, (req, res) => {
  const profile = db.prepare('SELECT allow_password_login FROM profile WHERE id = 1').get();
  if (profile && profile.allow_password_login === 0) {
    Logger.warn('[Auth] Password login rejected (passwordless mode enabled)', req);
    return res.status(403).json({
      error: 'Password sign-in is disabled on this server. Please use your Passkey / Biometrics to sign in.'
    });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !comparePassword(password, user.password_hash)) {
    Logger.warn('[Auth] Failed password login attempt', req, { username });
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = generateToken(user);
  setAuthCookie(res, token, req);

  Logger.audit('LOGIN_SUCCESS_PASSWORD', req, { userId: user.id, username: user.username });

  res.json({
    success: true,
    user: { id: user.id, username: user.username }
  });
});

// Logout with Token Revocation (ASVS V3)
router.post('/logout', requireAuth, async (req, res) => {
  if (req.user?.jti) {
    await blacklistToken(req.user.jti);
  }
  res.clearCookie(COOKIE_NAME, { path: '/' });
  Logger.audit('LOGOUT', req, { userId: req.user?.id, username: req.user?.username });
  res.json({ success: true, message: 'Logged out successfully' });
});

// Current authenticated user session status (ASVS V8 No-Cache)
router.get('/me', requireAuth, adminCacheControl, (req, res) => {
  const user = db.prepare('SELECT id, username, created_at, totp_enabled FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// Change Password or Username (ASVS V2 Password Strength & Session Revocation)
router.post('/change-password', requireAuth, authRateLimiter, async (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !comparePassword(currentPassword, user.password_hash)) {
    Logger.warn('[Auth] Failed password change attempt (invalid current password)', req);
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const updatedUsername = (newUsername && newUsername.trim()) ? newUsername.trim() : user.username;
  let updatedHash = user.password_hash;

  if (newPassword && newPassword.trim()) {
    const strengthCheck = validatePasswordStrength(newPassword.trim());
    if (!strengthCheck.valid) {
      return res.status(400).json({ error: strengthCheck.error });
    }
    updatedHash = hashPassword(newPassword.trim());
  }

  try {
    db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(
      updatedUsername,
      updatedHash,
      user.id
    );

    // Revoke previous JWT session token (ASVS V3)
    if (req.user?.jti) {
      await blacklistToken(req.user.jti);
    }

    const newToken = generateToken({ id: user.id, username: updatedUsername });
    setAuthCookie(res, newToken, req);

    Logger.audit('CREDENTIALS_CHANGED', req, { userId: user.id, newUsername: updatedUsername });

    res.json({ success: true, message: 'Credentials updated successfully', username: updatedUsername });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username is already taken' });
    }
    Logger.error('Failed to update credentials', err, req);
    res.status(500).json({ error: 'Failed to update credentials' });
  }
});

// -------------------------------------------------------------
// TOTP 2FA / RECOVERY AUTHENTICATION (ASVS V2)
// -------------------------------------------------------------

// Check if TOTP is configured on the server
router.get('/totp/status', adminCacheControl, (req, res) => {
  try {
    const user = db.prepare('SELECT totp_enabled FROM users WHERE id = 1').get();
    res.json({ enabled: !!(user && user.totp_enabled === 1) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch TOTP status' });
  }
});

// Generate TOTP Setup Secret & QR Code Data (ASVS V2)
router.post('/totp/setup-generate', requireAuth, adminCacheControl, async (req, res) => {
  try {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.id);
    const profile = db.prepare('SELECT name, handle FROM profile WHERE id = 1').get();
    const issuer = (profile && profile.name) ? profile.name : 'Bio Page';
    const accountName = user ? user.username : 'admin';

    const secret = generateTotpSecret();
    const otpauthUrl = getOtpAuthUrl(issuer, accountName, secret);

    // Save pending secret in cache for 10 minutes
    await setCache(`totp:setup:${req.user.id}`, secret, 600);

    res.json({
      success: true,
      secret,
      otpauthUrl,
      accountName,
      issuer
    });
  } catch (err) {
    Logger.error('Error generating TOTP setup', err, req);
    res.status(500).json({ error: 'Failed to generate TOTP setup' });
  }
});

// Verify & Activate TOTP
router.post('/totp/setup-verify', requireAuth, authRateLimiter, async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Verification code is required' });
  }

  try {
    const pendingSecret = await getCache(`totp:setup:${req.user.id}`);
    if (!pendingSecret) {
      return res.status(400).json({ error: 'Setup session expired. Please generate a new QR code.' });
    }

    const isValid = verifyTotp(code, pendingSecret);
    if (!isValid) {
      Logger.warn('[TOTP] Verification failed during setup', req);
      return res.status(400).json({ error: 'Invalid 6-digit code. Please check your authenticator app.' });
    }

    // Save secret and enable TOTP
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?').run(pendingSecret, req.user.id);
    await delCache(`totp:setup:${req.user.id}`);

    Logger.audit('TOTP_ACTIVATED', req, { userId: req.user.id });

    res.json({ success: true, message: 'Authenticator App (TOTP) successfully activated! 🛡️' });
  } catch (err) {
    Logger.error('Error verifying TOTP setup', err, req);
    res.status(500).json({ error: 'Failed to verify TOTP code' });
  }
});

// Disable TOTP
router.post('/totp/disable', requireAuth, (req, res) => {
  try {
    db.prepare('UPDATE users SET totp_secret = "", totp_enabled = 0 WHERE id = ?').run(req.user.id);
    Logger.audit('TOTP_DISABLED', req, { userId: req.user.id });
    res.json({ success: true, message: 'Authenticator App (TOTP) disabled.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disable TOTP' });
  }
});

// Fallback / Recovery Login with TOTP (Rate limited)
router.post('/totp/login', authRateLimiter, (req, res) => {
  const { username, code } = req.body;
  if (!code) {
    return res.status(400).json({ error: '6-digit TOTP code is required' });
  }

  try {
    let user;
    if (username && username.trim()) {
      user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
    } else {
      user = db.prepare('SELECT * FROM users ORDER BY id ASC LIMIT 1').get();
    }

    if (!user || !user.totp_enabled || !user.totp_secret) {
      Logger.warn('[Auth] TOTP login rejected (TOTP not enabled for user)', req, { username });
      return res.status(400).json({ error: 'TOTP is not configured for this account' });
    }

    const isValid = verifyTotp(code, user.totp_secret);
    if (!isValid) {
      Logger.warn('[Auth] Failed TOTP login attempt (invalid code)', req, { username });
      return res.status(401).json({ error: 'Invalid or expired 6-digit code' });
    }

    const token = generateToken(user);
    setAuthCookie(res, token, req);

    Logger.audit('LOGIN_SUCCESS_TOTP', req, { userId: user.id, username: user.username });

    res.json({
      success: true,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    Logger.error('Error during TOTP login', err, req);
    res.status(500).json({ error: 'TOTP authentication failed' });
  }
});

module.exports = router;
