const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');

const RP_NAME = process.env.RP_NAME || 'Bio Page Passkey';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || 'http://localhost:3000';

// Generate registration options for an admin user
async function getRegistrationOptions(user, existingAuthenticators = []) {
  const excludeCredentials = existingAuthenticators.map(auth => ({
    id: auth.credential_id,
    transports: auth.transports ? JSON.parse(auth.transports) : undefined
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(String(user.id)),
    userName: user.username,
    userDisplayName: user.username,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred'
    }
  });

  return options;
}

// Verify registration response from browser
async function verifyRegistration(response, expectedChallenge) {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false
  });

  return verification;
}

// Generate authentication options (for login)
async function getAuthenticationOptions(authenticators = []) {
  const allowCredentials = authenticators.map(auth => ({
    id: auth.credential_id,
    transports: auth.transports ? JSON.parse(auth.transports) : undefined
  }));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    userVerification: 'preferred'
  });

  return options;
}

// Verify authentication response from browser
async function verifyAuth(response, expectedChallenge, authenticator) {
  const pubKeyBuffer = Buffer.from(authenticator.credential_public_key, 'base64');
  const transports = authenticator.transports ? JSON.parse(authenticator.transports) : undefined;
  const credentialId = authenticator.credential_id;
  const counter = Number(authenticator.counter) || 0;

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    // Modern SimpleWebAuthn (v10+)
    credential: {
      id: credentialId,
      publicKey: new Uint8Array(pubKeyBuffer),
      counter: counter,
      transports: transports
    },
    // Legacy SimpleWebAuthn (v9 fallback)
    authenticator: {
      credentialID: credentialId,
      credentialPublicKey: pubKeyBuffer,
      counter: counter,
      transports: transports
    },
    requireUserVerification: false
  });

  return verification;
}

module.exports = {
  RP_NAME,
  RP_ID,
  ORIGIN,
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuth
};

