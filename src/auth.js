const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { setCache, getCache } = require('./redis');
const { isRequestHttps } = require('./middleware/security');

const JWT_SECRET = process.env.JWT_SECRET || 'self-hosted-bio-secret-key-change-in-prod-12345';
const COOKIE_NAME = 'bio_admin_token';
const inMemoryBlacklist = new Set();

function generateToken(user) {
  const jti = crypto.randomBytes(16).toString('hex');
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      jti
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

async function blacklistToken(jti, expiresInSeconds = 7 * 24 * 60 * 60) {
  if (!jti) return;
  inMemoryBlacklist.add(jti);
  try {
    await setCache(`token:blacklist:${jti}`, true, expiresInSeconds);
  } catch (e) {}
}

async function isTokenBlacklisted(jti) {
  if (!jti) return false;
  if (inMemoryBlacklist.has(jti)) return true;
  try {
    const cached = await getCache(`token:blacklist:${jti}`);
    return !!cached;
  } catch (e) {
    return false;
  }
}

function hashPassword(password) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function setAuthCookie(res, token, req) {
  const isSecure = isRequestHttps(req);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password exceeds maximum length of 128 characters.' };
  }

  const commonPasswords = ['password', '12345678', 'admin123', 'admin1234', '123456789', 'qwerty1234'];
  if (commonPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: 'Password is too common and easily guessable.' };
  }

  return { valid: true };
}

async function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME] || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  if (decoded.jti && (await isTokenBlacklisted(decoded.jti))) {
    return res.status(401).json({ error: 'Session has been revoked. Please log in again.' });
  }

  req.user = decoded;
  next();
}

module.exports = {
  COOKIE_NAME,
  generateToken,
  verifyToken,
  blacklistToken,
  isTokenBlacklisted,
  hashPassword,
  comparePassword,
  setAuthCookie,
  validatePasswordStrength,
  requireAuth
};
