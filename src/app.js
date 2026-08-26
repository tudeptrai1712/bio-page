const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const { uploadsDir } = require('./db');

// Route modules
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const webauthnRoutes = require('./routes/webauthn');
const adminRoutes = require('./routes/admin');

const app = express();

// Disable X-Powered-By header (prevents server fingerprinting)
app.disable('x-powered-by');

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Guard: Block attempts to access internal files, dotfiles, database files, or source code
app.use((req, res, next) => {
  const normalizedPath = decodeURIComponent(req.path).toLowerCase();
  if (
    normalizedPath.includes('.sqlite') ||
    normalizedPath.includes('.db') ||
    normalizedPath.includes('.env') ||
    normalizedPath.includes('.git') ||
    normalizedPath.includes('.aof') ||
    normalizedPath.includes('.rdb') ||
    normalizedPath.includes('.log') ||
    normalizedPath.includes('.bak') ||
    normalizedPath.includes('..') ||
    normalizedPath.startsWith('/data') ||
    normalizedPath.startsWith('/src')
  ) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
});

// Core Parsers
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Static File Serving (with dotfiles denied)
app.use('/uploads', express.static(uploadsDir, { dotfiles: 'deny', maxAge: '1d' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { dotfiles: 'deny' }));

// API Routes
app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth/webauthn', webauthnRoutes);
app.use('/api/admin', adminRoutes);

// Generic Error Handler (prevents stack trace leaks to client)
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err.message);
  res.status(err.status || 500).json({ error: 'Internal Server Error' });
});

module.exports = app;


