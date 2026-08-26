/**
 * Security Headers, Cache Control, and Input Validation for OWASP ASVS L2 / L3
 */

function isRequestHttps(req) {
  return (
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    req.headers['cf-visitor']?.includes('"scheme":"https"') ||
    process.env.NODE_ENV === 'production'
  );
}

// -------------------------------------------------------------
// 1. HARDENED HTTP SECURITY HEADERS (ASVS V14)
// -------------------------------------------------------------
function securityHeadersMiddleware(req, res, next) {
  const isHttps = isRequestHttps(req);

  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
    "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ];

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), publickey-credentials-get=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
}

// -------------------------------------------------------------
// 2. NO-CACHE HEADERS FOR ADMIN & SENSITIVE DATA (ASVS V8)
// -------------------------------------------------------------
function adminCacheControl(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}

// -------------------------------------------------------------
// 3. ENFORCE JSON CONTENT-TYPE ON MUTATING APIS (ASVS V13)
// -------------------------------------------------------------
function enforceJsonContentType(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    // Skip if no body or multipart upload
    const contentType = req.headers['content-type'] || '';
    if (contentType.startsWith('multipart/form-data')) {
      return next();
    }
    if (req.body && Object.keys(req.body).length > 0 && !contentType.includes('application/json')) {
      return res.status(415).json({
        error: 'Unsupported Media Type. Content-Type must be application/json.'
      });
    }
  }
  next();
}

// -------------------------------------------------------------
// 4. URL SCHEME VALIDATOR (ASVS V5)
// -------------------------------------------------------------
const ALLOWED_URL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:', 'viber:'];

function isValidUrlScheme(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return true; // empty is allowed
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('#')) return true; // relative or hash

  // Reject explicit dangerous patterns
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return ALLOWED_URL_SCHEMES.includes(parsed.protocol);
  } catch (err) {
    // If it doesn't have a protocol yet, check if it looks like a domain or handle
    if (!trimmed.includes(':')) return true;
    return false;
  }
}

function sanitizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!isValidUrlScheme(trimmed)) return '';
  return trimmed;
}

module.exports = {
  isRequestHttps,
  securityHeadersMiddleware,
  adminCacheControl,
  enforceJsonContentType,
  isValidUrlScheme,
  sanitizeUrl
};

