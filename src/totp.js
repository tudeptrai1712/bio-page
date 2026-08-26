const crypto = require('crypto');

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Convert Buffer to Base32 String
function bufferToBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

// Convert Base32 String to Buffer
function base32ToBuffer(base32) {
  const clean = base32.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_CHARS.indexOf(clean[i]);
    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

// Generate a random 20-byte base32 secret
function generateTotpSecret() {
  const buffer = crypto.randomBytes(20);
  return bufferToBase32(buffer);
}

// Generate HOTP code for a given counter
function generateHotp(secret, counter) {
  const key = typeof secret === 'string' ? base32ToBuffer(secret) : secret;
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}

// Generate current TOTP code
function generateTotp(secret, timeStep = 30) {
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  return generateHotp(secret, counter);
}

// Verify TOTP code with time drift window tolerance (+/- 1 step = +/- 30s)
function verifyTotp(token, secret, window = 1, timeStep = 30) {
  if (!token || !secret) return false;
  const cleanToken = token.toString().trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false;

  const currentCounter = Math.floor(Date.now() / 1000 / timeStep);

  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const calculatedCode = generateHotp(secret, currentCounter + errorWindow);
    if (crypto.timingSafeEqual(Buffer.from(calculatedCode), Buffer.from(cleanToken))) {
      return true;
    }
  }

  return false;
}

// Format otpauth:// URI for QR code generation
function getOtpAuthUrl(issuer, accountName, secret) {
  const encIssuer = encodeURIComponent(issuer || 'Bio Page');
  const encAccount = encodeURIComponent(accountName || 'admin');
  return `otpauth://totp/${encIssuer}:${encAccount}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = {
  generateTotpSecret,
  generateTotp,
  verifyTotp,
  getOtpAuthUrl
};

