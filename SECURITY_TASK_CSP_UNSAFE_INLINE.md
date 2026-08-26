# Security Task: Remove CSP `unsafe-inline` for Level 3 Compliance

## Objective
Migrate from CSP `'unsafe-inline'` to external script files to achieve OWASP ASVS Level 3+ compliance and improve XSS protection.

## Current Issue
**File:** `src/middleware/security.js` (Line 23)
```javascript
"script-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com"
```

The `'unsafe-inline'` directive allows ANY inline `<script>` tag to execute, defeating CSP's purpose. If an attacker injects malicious inline code through XSS, it bypasses CSP protection. Level 3 compliance requires removing this.

## Required Changes

### 1. Extract Inline Scripts to External Files
- **`public/login.html`** (Lines 335-524): Move entire `<script>` block to **`public/js/login.js`**
- **`src/views/admin/admin.html`**: Extract inline styles/scripts to **`src/views/admin/admin-init.js`**
- Update HTML to reference external files: `<script src="/js/login.js"></script>`

### 2. Update CSP Header
- **`src/middleware/security.js`**: Remove `'unsafe-inline'` from both `script-src` and `style-src`
- **For styles:** Use `'self'` + CDN sources only (inline styles must also be removed or use nonces)
- Result: `"script-src 'self' https://unpkg.com https://cdnjs.cloudflare.com"`

### 3. Preserve Functionality
- All login forms, WebAuthn passkey flows, TOTP authentication must work identically
- Admin panel theme switching and real-time updates must remain functional
- No breaking changes to UX

### 4. Testing
- Verify CSP headers in DevTools (no CSP violations in console)
- Test login with password, passkey, and TOTP
- Test admin dashboard functionality
- Ensure dark/light theme switching works

## Deliverables
- ✅ New external JS files created
- ✅ CSP header updated (no `unsafe-inline`)
- ✅ All inline code migrated
- ✅ Full test coverage (no regressions)
