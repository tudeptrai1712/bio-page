const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const { uploadsDir } = require('./db');
const { Logger } = require('./logger');
const { requireAuth, requireAuthOrRedirect } = require('./auth');
const {
  securityHeadersMiddleware,
  adminCacheControl,
  enforceJsonContentType
} = require('./middleware/security');
const { renderPublicBioPage } = require('./renderer');

// Route modules
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const webauthnRoutes = require('./routes/webauthn');
const adminRoutes = require('./routes/admin');

const app = express();

// Enable Trust Proxy for Cloudflare Tunnel / Reverse Proxies (ASVS V1)
app.set('trust proxy', true);

// Disable X-Powered-By header (prevents server fingerprinting)
app.disable('x-powered-by');

// Hardened HTTP Security Headers Middleware (ASVS V14)
app.use(securityHeadersMiddleware);

// Path Guard: Block access to internal, database, dotfiles, or sensitive file paths (ASVS V4/V5)
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
    normalizedPath.startsWith('/src') ||
    normalizedPath.endsWith('.lock') ||
    normalizedPath.endsWith('.yml') ||
    normalizedPath.endsWith('.yaml')
  ) {
    Logger.warn('[Guard] Blocked unauthorized internal path access attempt', { path: req.path, ip: req.ip });
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
});

// Core Parsers with strict size limits (ASVS V13)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Lightweight Health Check Endpoint (for Docker & Cloudflare Tunnel healthchecks)
app.get('/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// -------------------------------------------------------------
// SERVER-SIDE RENDERED PUBLIC BIO PAGE (100% Server Processing)
// -------------------------------------------------------------
app.get(['/', '/index.html'], async (req, res, next) => {
  try {
    const { html, fromCache } = await renderPublicBioPage();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// PROTECTED ADMIN DASHBOARD & ASSETS (Zero Public Leakage)
// -------------------------------------------------------------

// Admin Dashboard HTML - Authenticated access only
app.get(['/admin', '/admin.html'], requireAuthOrRedirect, adminCacheControl, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin', 'admin.html'));
});

// Admin Dashboard JavaScript - Authenticated access only
app.get('/admin/admin.js', requireAuth, adminCacheControl, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin', 'admin.js'));
});

// Admin WebAuthn Registration Module - Authenticated access only
app.get('/admin/webauthn-admin.js', requireAuth, adminCacheControl, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin', 'webauthn-admin.js'));
});

// Enforce JSON Content-Type for mutating requests
app.use('/api', enforceJsonContentType);

// Uploads Static Serving with hardened download headers (ASVS V12)
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  next();
}, express.static(uploadsDir, { dotfiles: 'deny' }));

// Public Static Files (Only public CSS, icons, login screen, and main.js)
app.use(express.static(path.join(__dirname, '..', 'public'), { dotfiles: 'deny' }));

// API Route Mounts
app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth/webauthn', webauthnRoutes);
app.use('/api/admin', adminRoutes);

// Centralized Generic Error Handler (ASVS V7 - Prevents Stack Trace & SQL Leaks)
app.use((err, req, res, next) => {
  Logger.error('Unhandled Server Exception', err, req);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'An unexpected error occurred. Please try again.' });
});

module.exports = app;
