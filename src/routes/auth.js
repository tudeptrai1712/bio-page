const express = require('express');
const router = express.Router();

const { db } = require('../db');
const {
  COOKIE_NAME,
  generateToken,
  hashPassword,
  comparePassword,
  requireAuth
} = require('../auth');

// Standard Password Login
router.post('/login', (req, res) => {
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
    user: { id: user.id, username: user.username }
  });
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true, message: 'Logged out successfully' });
});

// Current authenticated user session status
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// Change Password or Username
router.post('/change-password', requireAuth, (req, res) => {
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

module.exports = router;

