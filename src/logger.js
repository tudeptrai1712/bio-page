/**
 * Security Audit Logger for OWASP ASVS V7 Compliance
 * Logs security-relevant events with timestamps, client IP, user agent, and action status.
 * Automatically sanitizes sensitive data (passwords, tokens, secrets) and handles circular refs.
 */

function getClientIp(req) {
  if (!req) return 'unknown';
  return (
    req.headers?.['cf-connecting-ip'] ||
    (req.headers?.['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function getUserAgent(req) {
  if (!req) return 'unknown';
  return req.headers?.['user-agent'] || 'unknown';
}

function isExpressReq(obj) {
  return obj && (obj._readableState || obj.socket || obj.headers || obj.method);
}

function sanitizeMeta(meta, seen = new WeakSet()) {
  if (!meta || typeof meta !== 'object') return meta;
  if (seen.has(meta)) return '[Circular]';
  seen.add(meta);

  // If Express request object was passed, extract IP and safe summary
  if (isExpressReq(meta)) {
    return {
      ip: getClientIp(meta),
      method: meta.method,
      path: meta.path || meta.originalUrl
    };
  }

  const copy = Array.isArray(meta) ? [] : {};
  const sensitiveKeys = ['password', 'currentPassword', 'newPassword', 'token', 'secret', 'totp_secret', 'jwt'];

  for (const key of Object.keys(meta)) {
    if (sensitiveKeys.includes(key)) {
      copy[key] = '[REDACTED]';
    } else if (typeof meta[key] === 'object' && meta[key] !== null) {
      copy[key] = sanitizeMeta(meta[key], seen);
    } else {
      copy[key] = meta[key];
    }
  }
  return copy;
}

const Logger = {
  audit(action, req, details = {}) {
    const timestamp = new Date().toISOString();
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    const sanitized = sanitizeMeta(details);

    const logEntry = {
      timestamp,
      type: 'AUDIT',
      action,
      ip,
      userAgent,
      userId: req?.user?.id || null,
      username: req?.user?.username || sanitized.username || null,
      ...sanitized
    };

    console.log(`[AUDIT] ${timestamp} | ${action} | IP: ${ip} | User: ${logEntry.username || 'anonymous'} | ${JSON.stringify(sanitized)}`);
  },

  info(msg, meta = {}) {
    console.log(`[INFO] ${new Date().toISOString()} | ${msg} ${meta ? JSON.stringify(sanitizeMeta(meta)) : ''}`);
  },

  warn(msg, reqOrMeta = null, extraMeta = {}) {
    let meta = {};
    if (isExpressReq(reqOrMeta)) {
      meta = { ip: getClientIp(reqOrMeta), ...sanitizeMeta(extraMeta) };
    } else if (reqOrMeta && typeof reqOrMeta === 'object') {
      meta = sanitizeMeta(reqOrMeta);
    }
    console.warn(`[WARN] ${new Date().toISOString()} | ${msg} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`);
  },

  error(msg, err, req = null) {
    const ip = req ? getClientIp(req) : null;
    const errMsg = err?.message || err || 'Unknown error';
    console.error(`[ERROR] ${new Date().toISOString()} | ${msg} | ${errMsg} ${ip ? `| IP: ${ip}` : ''}`);
  }
};

module.exports = {
  Logger,
  getClientIp,
  getUserAgent
};

