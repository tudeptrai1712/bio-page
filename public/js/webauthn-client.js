/**
 * WebAuthn Browser Client Helpers
 * Handles Base64URL conversions and navigator.credentials calls for Passkeys
 */

function bufferToBase64URL(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  const base64 = window.btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64URLToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64.padEnd(base64.length + padLen, '=');
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert registration options received from server
function preFormatRegistrationOptions(options) {
  const formatted = { ...options };
  formatted.challenge = base64URLToBuffer(options.challenge);
  formatted.user.id = base64URLToBuffer(options.user.id);

  if (options.excludeCredentials) {
    formatted.excludeCredentials = options.excludeCredentials.map(cred => ({
      ...cred,
      id: base64URLToBuffer(cred.id)
    }));
  }

  return formatted;
}

// Convert registration response to send back to server
function formatRegistrationResponse(credential) {
  return {
    id: credential.id,
    rawId: bufferToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
      attestationObject: bufferToBase64URL(credential.response.attestationObject),
      transports: credential.response.getTransports ? credential.response.getTransports() : []
    },
    clientExtensionResults: credential.getClientExtensionResults()
  };
}

// Convert authentication options received from server
function preFormatAuthenticationOptions(options) {
  const formatted = { ...options };
  formatted.challenge = base64URLToBuffer(options.challenge);

  if (options.allowCredentials) {
    formatted.allowCredentials = options.allowCredentials.map(cred => ({
      ...cred,
      id: base64URLToBuffer(cred.id)
    }));
  }

  return formatted;
}

// Convert authentication response to send back to server
function formatAuthenticationResponse(credential) {
  return {
    id: credential.id,
    rawId: bufferToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
      authenticatorData: bufferToBase64URL(credential.response.authenticatorData),
      signature: bufferToBase64URL(credential.response.signature),
      userHandle: credential.response.userHandle ? bufferToBase64URL(credential.response.userHandle) : null
    },
    clientExtensionResults: credential.getClientExtensionResults()
  };
}

window.WebAuthnClient = {
  isSupported: () => window.PublicKeyCredential !== undefined,
  preFormatRegistrationOptions,
  formatRegistrationResponse,
  preFormatAuthenticationOptions,
  formatAuthenticationResponse
};

