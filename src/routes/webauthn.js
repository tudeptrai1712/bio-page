const express = require('express');
const router = express.Router();

const { db } = require('../db');
const { generateToken, setAuthCookie, requireAuth } = require('../auth');
const { setChallenge, getChallenge, delChallenge } = require('../redis');
const { authRateLimiter } = require('../middleware/rateLimit');
const { adminCacheControl } = require('../middleware/security');
const { Logger } = require('../logger');
const {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuth
} = require('../webauthn');

// 1. Generate Registration Options (Admin only)
router.get('/register-options', requireAuth, adminCacheControl, async (req, res) => {
  try {
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existingAuthenticators = db.prepare('SELECT credential_id, transports FROM authenticators WHERE user_id = ?').all(user.id);
    const options = await getRegistrationOptions(user, existingAuthenticators);

    // Save challenge in Redis (5 min TTL)
    await setChallenge(`reg:${user.id}`, options.challenge, 300);

    res.json(options);
  } catch (err) {
    Logger.error('Error generating registration options', err, req);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

// 2. Verify Registration Response & Save Passkey (Admin only)
router.post('/register-verify', requireAuth, authRateLimiter, async (req, res) => {
  try {
    const { registrationResponse, deviceName } = req.body;
    const userId = req.user.id;

    const expectedChallenge = await getChallenge(`reg:${userId}`);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Registration challenge expired. Please try again.' });
    }

    const verification = await verifyRegistration(registrationResponse, expectedChallenge);

    if (verification.verified && verification.registrationInfo) {
      const regInfo = verification.registrationInfo;
      const credential = regInfo.credential || {};
      const credentialID = credential.id || regInfo.credentialID;
      const rawPublicKey = credential.publicKey || regInfo.credentialPublicKey;
      const credentialPublicKey = rawPublicKey ? Buffer.from(rawPublicKey).toString('base64') : '';
      const counter = credential.counter ?? regInfo.counter ?? 0;
      const transports = credential.transports 
        ? JSON.stringify(credential.transports) 
        : (regInfo.transports ? JSON.stringify(regInfo.transports) : (registrationResponse.response?.transports ? JSON.stringify(registrationResponse.response.transports) : '[]'));

      db.prepare(`
        INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter, transports, device_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        credentialID,
        credentialPublicKey,
        counter,
        transports,
        deviceName || 'Biometric Key / Passkey'
      );

      await delChallenge(`reg:${userId}`);

      Logger.audit('PASSKEY_REGISTERED', req, { userId, deviceName: deviceName || 'Biometric Key' });

      res.json({ success: true, message: 'Passkey registered successfully!' });
    } else {
      res.status(400).json({ error: 'Verification failed' });
    }
  } catch (err) {
    Logger.error('Error verifying passkey registration', err, req);
    res.status(400).json({ error: err.message || 'Passkey verification failed' });
  }
});

// 3. Generate Authentication Options (Public - for login)
router.get('/auth-options', adminCacheControl, async (req, res) => {
  try {
    const authenticators = db.prepare('SELECT credential_id, transports FROM authenticators').all();
    const options = await getAuthenticationOptions(authenticators);

    // Save login challenge in Redis with session/temp ID
    const challengeKey = req.query.sessionKey || 'public_login';
    await setChallenge(`auth:${challengeKey}`, options.challenge, 300);

    res.json(options);
  } catch (err) {
    Logger.error('Error generating auth options', err, req);
    res.status(500).json({ error: 'Failed to generate authentication options' });
  }
});

// 4. Verify Authentication Response (Public - logs in with Passkey)
router.post('/auth-verify', authRateLimiter, async (req, res) => {
  try {
    const { authResponse, sessionKey } = req.body;
    const challengeKey = sessionKey || 'public_login';

    const expectedChallenge = await getChallenge(`auth:${challengeKey}`);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Login challenge expired. Please retry.' });
    }

    const credentialId = authResponse?.id;
    const authenticator = db.prepare('SELECT * FROM authenticators WHERE credential_id = ?').get(credentialId);
    if (!authenticator) {
      Logger.warn('[Auth] Unknown passkey credential attempted', req);
      return res.status(400).json({ error: 'Unrecognized passkey device.' });
    }

    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(authenticator.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const verification = await verifyAuth(authResponse, expectedChallenge, authenticator);

    if (verification.verified) {
      // Update counter and last_used_at
      const newCounter = verification.authenticationInfo?.newCounter 
        ?? verification.authenticationInfo?.counter 
        ?? (Number(authenticator.counter) + 1);

      db.prepare(`
        UPDATE authenticators
        SET counter = ?, last_used_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newCounter, authenticator.id);

      await delChallenge(`auth:${challengeKey}`);

      // Issue JWT session token with dynamic secure cookies
      const token = generateToken(user);
      setAuthCookie(res, token, req);

      Logger.audit('LOGIN_SUCCESS_PASSKEY', req, { userId: user.id, username: user.username, authenticatorId: authenticator.id });

      res.json({
        success: true,
        user: { id: user.id, username: user.username }
      });
    } else {
      Logger.warn('[Auth] Passkey authentication verification failed', req);
      res.status(400).json({ error: 'Passkey verification failed' });
    }
  } catch (err) {
    Logger.error('Error verifying passkey authentication', err, req);
    res.status(400).json({ error: err.message || 'Passkey authentication failed' });
  }
});

module.exports = router;
