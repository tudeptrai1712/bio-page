/**
 * WebAuthn Admin Helpers (Registration & Passkey Management)
 * Protected asset - only served to authenticated administrators.
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

async function startRegistration(options) {
  if (window.SimpleWebAuthnBrowser && typeof window.SimpleWebAuthnBrowser.startRegistration === 'function') {
    try {
      return await window.SimpleWebAuthnBrowser.startRegistration(options);
    } catch (e) {
      if (e.name === 'NotAllowedError' || e.name === 'AbortError') {
        throw e;
      }
    }
  }

  if (!window.PublicKeyCredential || !navigator.credentials || !navigator.credentials.create) {
    throw new Error('WebAuthn is not supported on this browser or device.');
  }

  const formattedOpts = preFormatRegistrationOptions(options);
  const credential = await navigator.credentials.create({ publicKey: formattedOpts });

  if (!credential) {
    throw new Error('Passkey registration was cancelled.');
  }

  return formatRegistrationResponse(credential);
}

window.WebAuthnAdmin = {
  isSupported: () => !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create),
  startRegistration
};

