/**
 * Client-Side Authentication Controller for Login Portal
 * External JS file ensuring ASVS Level 3 CSP compliance (zero unsafe-inline).
 */

document.addEventListener('DOMContentLoaded', () => {
  let isPasswordAllowed = true;
  let isTotpActive = false;

  // Sync dynamic theme and passwordless mode from server profile
  fetch('/api/profile')
    .then(r => r.json())
    .then(data => {
      if (data && data.profile) {
        if (window.M3Theme) {
          window.M3Theme.applyDynamicTokens(data.profile.accent_color || '#818cf8', data.profile.color_mode || 'auto');
        }
        if (data.profile.allow_password_login === 0) {
          isPasswordAllowed = false;
          const form = document.getElementById('login-form');
          const divider = document.getElementById('login-divider');
          const subtitle = document.getElementById('login-subtitle');
          if (form) form.style.display = 'none';
          if (divider) divider.style.display = 'none';
          if (subtitle) subtitle.textContent = 'Passwordless Mode: Sign in with Passkey';
        }
      }
    })
    .catch(() => {});

  // Auto redirect if already logged in
  fetch('/api/auth/me')
    .then(res => {
      if (res.ok) window.location.href = '/admin';
    })
    .catch(() => {});

  const form = document.getElementById('login-form');
  const totpForm = document.getElementById('totp-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const totpUsernameInput = document.getElementById('totp-username');
  const totpCodeInput = document.getElementById('totp-code');
  const errorBox = document.getElementById('error-box');
  const errorText = document.getElementById('error-text');
  const btnSubmit = document.getElementById('btn-submit');
  const btnTotpSubmit = document.getElementById('btn-totp-submit');
  const btnPasskey = document.getElementById('btn-passkey-login');
  const btnToggleTotp = document.getElementById('btn-toggle-totp');
  const toggleTotpText = document.getElementById('toggle-totp-text');
  const loginDivider = document.getElementById('login-divider');

  // Toggle TOTP view
  if (btnToggleTotp) {
    btnToggleTotp.addEventListener('click', () => {
      isTotpActive = !isTotpActive;
      if (errorBox) errorBox.classList.remove('show');
      if (isTotpActive) {
        if (totpForm) totpForm.style.display = 'block';
        if (form) form.style.display = 'none';
        if (btnPasskey) btnPasskey.style.display = 'none';
        if (loginDivider) loginDivider.style.display = 'none';
        if (toggleTotpText) {
          toggleTotpText.textContent = isPasswordAllowed ? 'Back to Passkey / Password Login' : 'Back to Passkey Login';
        }
        if (totpCodeInput) totpCodeInput.focus();
      } else {
        if (totpForm) totpForm.style.display = 'none';
        if (btnPasskey) btnPasskey.style.display = 'flex';
        if (isPasswordAllowed) {
          if (form) form.style.display = 'block';
          if (loginDivider) loginDivider.style.display = 'flex';
        }
        if (toggleTotpText) toggleTotpText.textContent = 'Sign in with Authenticator App (TOTP)';
      }
    });
  }

  // TOTP Recovery Login
  if (totpForm) {
    totpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorBox) errorBox.classList.remove('show');
      btnTotpSubmit.disabled = true;
      btnTotpSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying Code...';

      try {
        const res = await fetch('/api/auth/totp/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: totpUsernameInput.value.trim(),
            code: totpCodeInput.value.trim()
          })
        });

        const data = await res.json();
        if (res.ok) {
          window.location.href = '/admin';
        } else {
          errorText.textContent = data.error || 'Invalid TOTP code';
          if (errorBox) errorBox.classList.add('show');
          btnTotpSubmit.disabled = false;
          btnTotpSubmit.innerHTML = '<span>Verify Code & Sign In</span> <i class="fas fa-arrow-right"></i>';
        }
      } catch (err) {
        errorText.textContent = 'Connection error. Please try again.';
        if (errorBox) errorBox.classList.add('show');
        btnTotpSubmit.disabled = false;
        btnTotpSubmit.innerHTML = '<span>Verify Code & Sign In</span> <i class="fas fa-arrow-right"></i>';
      }
    });
  }

  // Password login
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorBox) errorBox.classList.remove('show');
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: usernameInput.value.trim(),
            password: passwordInput.value
          })
        });

        const data = await res.json();
        if (res.ok) {
          window.location.href = '/admin';
        } else {
          errorText.textContent = data.error || 'Invalid credentials';
          if (errorBox) errorBox.classList.add('show');
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
        }
      } catch (err) {
        errorText.textContent = 'Connection error. Please try again.';
        if (errorBox) errorBox.classList.add('show');
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
      }
    });
  }

  // Passkey biometric login
  if (btnPasskey) {
    btnPasskey.addEventListener('click', async () => {
      if (!window.PublicKeyCredential || !navigator.credentials) {
        errorText.textContent = 'WebAuthn is not supported on this browser or device.';
        if (errorBox) errorBox.classList.add('show');
        return;
      }

      if (errorBox) errorBox.classList.remove('show');
      const originalText = btnPasskey.innerHTML;
      btnPasskey.disabled = true;
      btnPasskey.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Touch sensor / Scan biometric...';

      try {
        const sessionKey = 'login_' + Date.now();
        const optsRes = await fetch(`/api/auth/webauthn/auth-options?sessionKey=${sessionKey}`);
        if (!optsRes.ok) throw new Error('Failed to get authentication challenge');
        const options = await optsRes.json();

        let authResponse;
        if (window.SimpleWebAuthnBrowser && typeof window.SimpleWebAuthnBrowser.startAuthentication === 'function') {
          authResponse = await window.SimpleWebAuthnBrowser.startAuthentication(options);
        } else {
          throw new Error('Authentication library could not be loaded.');
        }

        const verifyRes = await fetch('/api/auth/webauthn/auth-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authResponse,
            sessionKey
          })
        });

        const verifyData = await verifyRes.json();
        if (verifyRes.ok) {
          window.location.href = '/admin';
        } else {
          errorText.textContent = verifyData.error || 'Passkey verification failed';
          if (errorBox) errorBox.classList.add('show');
        }
      } catch (err) {
        if (err.name !== 'NotAllowedError') {
          errorText.textContent = err.message || 'Passkey authentication cancelled or failed';
          if (errorBox) errorBox.classList.add('show');
        }
      } finally {
        btnPasskey.disabled = false;
        btnPasskey.innerHTML = originalText;
      }
    });
  }
});

