const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let redisClient = null;
let isRedisConnected = false;

try {
  redisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 5) {
        return null; // Stop reconnecting after 5 attempts to avoid log spam
      }
      return Math.min(times * 1000, 3000);
    },
    lazyConnect: true
  });

  redisClient.connect().then(() => {
    isRedisConnected = true;
    console.log('[Redis] Connected to Redis successfully! ⚡');
  }).catch((err) => {
    console.warn('[Redis] Redis not reachable on startup. Running in fallback mode:', err.message);
    isRedisConnected = false;
  });

  redisClient.on('connect', () => {
    isRedisConnected = true;
    console.log('[Redis] Redis connection established.');
  });

  redisClient.on('error', (err) => {
    isRedisConnected = false;
  });
} catch (err) {
  console.warn('[Redis] Failed to initialize Redis client:', err.message);
}

// Memory fallback store if Redis is unavailable
const memoryFallback = new Map();

// Helper functions
async function getCache(key) {
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      // Fallback
    }
  }
  return memoryFallback.get(key) || null;
}

async function setCache(key, value, ttlSeconds = 300) {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    } catch (err) {
      // Fallback
    }
  }
  memoryFallback.set(key, value);
  setTimeout(() => memoryFallback.delete(key), ttlSeconds * 1000);
}

async function delCache(key) {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.del(key);
    } catch (err) {}
  }
  memoryFallback.delete(key);
}

// Invalidate public profile & SSR HTML cache
async function invalidateProfileCache() {
  await Promise.all([
    delCache('bio:public_profile'),
    delCache('bio:ssr_html')
  ]);
}

// WebAuthn challenge store (5 minutes TTL)
async function setChallenge(challengeKey, challenge, ttlSeconds = 300) {
  await setCache(`webauthn:challenge:${challengeKey}`, challenge, ttlSeconds);
}

async function getChallenge(challengeKey) {
  return await getCache(`webauthn:challenge:${challengeKey}`);
}

async function delChallenge(challengeKey) {
  await delCache(`webauthn:challenge:${challengeKey}`);
}

// Real-time counter increments
async function incrRealtimeView() {
  if (isRedisConnected && redisClient) {
    try {
      return await redisClient.incr('bio:counters:views');
    } catch (err) {}
  }
  return 0;
}

async function incrRealtimeClick(linkId) {
  if (isRedisConnected && redisClient) {
    try {
      return await redisClient.hincrby('bio:counters:clicks', String(linkId), 1);
    } catch (err) {}
  }
  return 0;
}

module.exports = {
  redisClient,
  isRedisConnected: () => isRedisConnected,
  getCache,
  setCache,
  delCache,
  invalidateProfileCache,
  setChallenge,
  getChallenge,
  delChallenge,
  incrRealtimeView,
  incrRealtimeClick
};

