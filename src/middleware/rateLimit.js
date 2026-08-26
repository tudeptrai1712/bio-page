/**
 * Distributed Sliding Window Rate Limiter for OWASP ASVS V2 & V13
 * Uses Redis atomic operations with memory store fallback.
 */

const { isRedisConnected, redisClient } = require('../redis');
const { getClientIp, Logger } = require('../logger');

const memoryRateStore = new Map();

// Periodic cleanup of expired in-memory entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryRateStore.entries()) {
    if (now > record.resetTime) {
      memoryRateStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function createRateLimiter({
  windowSeconds = 60,
  maxRequests = 60,
  keyPrefix = 'rl',
  message = 'Too many requests, please try again later.',
  statusCode = 429,
  keyGenerator = (req) => getClientIp(req)
}) {
  return async function rateLimitMiddleware(req, res, next) {
    const keyIdentifier = keyGenerator(req);
    const redisKey = `ratelimit:${keyPrefix}:${keyIdentifier}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // 1. Redis Path
    if (isRedisConnected() && redisClient) {
      try {
        const pipeline = redisClient.pipeline();
        const member = `${now}-${Math.random()}`;

        // Remove old entries outside sliding window
        pipeline.zremrangebyscore(redisKey, 0, now - windowMs);
        // Add current timestamp
        pipeline.zadd(redisKey, now, member);
        // Count hits in current window
        pipeline.zcard(redisKey);
        // Set TTL on the set
        pipeline.expire(redisKey, windowSeconds + 5);

        const results = await pipeline.exec();
        const currentCount = results[2][1];

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - currentCount));
        res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

        if (currentCount > maxRequests) {
          const retryAfter = Math.ceil(windowSeconds);
          res.setHeader('Retry-After', retryAfter);
          Logger.warn(`[RateLimit] Blocked request on ${req.path}`, { ip: keyIdentifier, keyPrefix, count: currentCount });
          return res.status(statusCode).json({
            error: message,
            retryAfter
          });
        }

        return next();
      } catch (err) {
        // Fallback to memory store on Redis error
      }
    }

    // 2. In-Memory Fallback Path
    const memKey = `${keyPrefix}:${keyIdentifier}`;
    let record = memoryRateStore.get(memKey);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      memoryRateStore.set(memKey, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', resetSeconds);
      Logger.warn(`[RateLimit] Blocked request in memory on ${req.path}`, { ip: keyIdentifier, keyPrefix, count: record.count });
      return res.status(statusCode).json({
        error: message,
        retryAfter: resetSeconds
      });
    }

    next();
  };
}

// -------------------------------------------------------------
// Preconfigured Limiters
// -------------------------------------------------------------

// Sensitive Auth Endpoints (5 attempts per 15 minutes per IP)
const authRateLimiter = createRateLimiter({
  windowSeconds: 15 * 60,
  maxRequests: 5,
  keyPrefix: 'auth',
  message: 'Too many login attempts. For security reasons, please wait 15 minutes before trying again.'
});

// Admin Management APIs (300 requests per minute)
const adminRateLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 300,
  keyPrefix: 'admin',
  message: 'Admin API request limit exceeded. Please slow down.'
});

// Public APIs & Analytics (120 requests per minute)
const publicRateLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 120,
  keyPrefix: 'public',
  message: 'Rate limit exceeded. Please try again shortly.'
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
  adminRateLimiter,
  publicRateLimiter
};

