# ⚡ Self-Hosted Bio Page (with Admin Dashboard, Redis & WebAuthn)

[![Build & Publish Docker Image](https://github.com/tudeptrai1712/bio-page/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/tudeptrai1712/bio-page/actions/workflows/docker-publish.yml)
[![Docker Image](https://img.shields.io/badge/GHCR-ghcr.io%2Ftudeptrai1712%2Fbio--page-blue?logo=docker)](https://github.com/tudeptrai1712/bio-page/pkgs/container/bio-page)
[![Platform](https://img.shields.io/badge/platform-linux%2Famd64%20%7C%20linux%2Farm64-informational)](https://github.com/tudeptrai1712/bio-page/pkgs/container/bio-page)
[![Security: OWASP ASVS L2](https://img.shields.io/badge/Security-OWASP%20ASVS%20v4.0%20L2-success)](https://owasp.org/www-project-application-security-verification-standard/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A high-performance, modern, self-hosted link-in-bio page (alternative to Linktree / Bento) with an interactive **Admin Panel**, **Redis sub-millisecond caching & real-time analytics**, **Passwordless WebAuthn / Passkeys** (Touch ID, Windows Hello, Face ID, YubiKey), **TOTP 2FA / Fallback Recovery**, and **OWASP ASVS Level 2 Hardening** ready for **Cloudflare Tunnel** deployment.

Images are **automatically built for `amd64` and `arm64` via GitHub Actions** and published to the **GitHub Container Registry (GHCR)**.

> [!NOTE]
> ⚠️ **Vibecoding / Personal Project Notice**: This project is vibecoded primarily for personal purposes and experimentation. While fully functional and feature-packed, it's crafted with a fast-and-flexible vibe. Contributions and fixes are warmly welcomed!

---

## ✨ Features

- 🚀 **Pre-built Multi-Arch Images**: `linux/amd64` and `linux/arm64` published to GHCR.
- 🔒 **Interactive Admin Dashboard**: Full customization interface with dark/light themes, live link editing, and passkey manager.
- 🔑 **WebAuthn / Passkey Biometrics**: 1-click biometric sign-in via Windows Hello, Apple Touch ID / Face ID, Android Biometrics, or YubiKey hardware tokens.
- 🛡️ **Passwordless Mode**: Option to completely disable password sign-in and enforce Passkeys-only access with built-in lockout protection.
- 📱 **TOTP Authenticator & Fallback Recovery**: RFC 6238 TOTP support (Google Authenticator, Apple Passwords, 1Password, Authy) with QR code scanner and 6-digit fallback sign-in.
- ⚡ **Redis Acceleration & Security Isolation**: Sub-millisecond public caching with instant invalidation, and internal-only Docker network isolation.
- 🌐 **Comprehensive Social & Messaging Links**: Built-in formatters for Telegram, Signal, WhatsApp, Zalo, Threads, Facebook, GitHub, X/Twitter, LinkedIn, YouTube, Instagram, Discord, Spotify, Twitch, and more.
- 🛡️ **OWASP ASVS Level 2 + L3 Security Hardening**:
  - **Distributed Rate Limiting**: Anti-brute force sliding-window limiter on auth endpoints.
  - **Session Blacklisting**: Instant JWT `jti` revocation on logout and password reset.
  - **Hardened HTTP Headers**: Full CSP, HSTS, `Permissions-Policy`, `X-Frame-Options: SAMEORIGIN`, `nosniff`.
  - **File Upload Protection**: Magic byte signature verification (JPEG, PNG, GIF, WebP, ICO) and randomized safe filenames.
  - **Input Sanitization**: URL scheme whitelisting (`http:`, `https:`, `mailto:`, `tel:`, `viber:`) blocking XSS injection.
  - **Security Audit Logger**: Structured audit logging for all authentication and admin operations.
- ☁️ **Cloudflare Tunnel Ready**: Native `trust proxy` support for `CF-Connecting-IP` and `X-Forwarded-Proto` HTTPS cookie protection.
- 📊 **Built-in Analytics**: Real-time page view counters, link clicks tracking, and click-through rates (CTR).
- 🔄 **Zero-Downtime Auto-Updates**: Integrated Watchtower with modern Docker API support.

---

## 📋 Prerequisites

- **Docker & Docker Compose**: [Get Docker Desktop / Docker Engine](https://www.docker.com/)

---

## 🚀 Quick Start

> [!TIP]
> **You do NOT need to build the Docker image!** Pre-built multi-arch images are pulled automatically from GHCR. You just need to run `docker compose up -d`.

### Option 1: Using Pre-built Image from GHCR (Recommended)

1. **Clone the repository or download `docker-compose.prod.yml`**:
   ```bash
   git clone https://github.com/tudeptrai1712/bio-page.git
   cd bio-page
   ```

2. **Start the stack**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

*(Watchtower will automatically check for and pull newly published GitHub releases every 5 minutes.)*

---

### Option 2: Build Locally from Source

```bash
git clone https://github.com/tudeptrai1712/bio-page.git
cd bio-page
docker compose up -d --build
```

---

## ☁️ Deploying with Cloudflare Tunnel (cloudflared)

Deploying through Cloudflare Tunnel gives you free SSL, DDoS protection, and zero port forwarding on your router/firewall.

1. **Create your Tunnel in the Cloudflare Zero Trust Dashboard**:
   - Go to **Zero Trust Dashboard** -> **Networks** -> **Tunnels** -> **Create a Tunnel**.
   - Install the `cloudflared` connector on your server.

2. **Configure Public Hostname Routing**:
   - **Service**: `HTTP`
   - **URL**: `bio-page:3000` (if in the same Docker network) or `localhost:3000`.

3. **Configure Environment Variables in `docker-compose.prod.yml`**:
   Ensure `ORIGIN` and `RP_ID` match your public domain so WebAuthn / Passkeys function correctly:
   ```yaml
   environment:
     - ORIGIN=https://links.yourdomain.com
     - RP_ID=links.yourdomain.com
     - ADMIN_PASSWORD=your_secure_password
     - JWT_SECRET=your_custom_jwt_secret
   ```

4. **Start the stack**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

---

## 🌐 Accessing the App

- **Public Bio Page**: `http://localhost:3000` (or `https://links.yourdomain.com`)
- **Admin Dashboard**: `http://localhost:3000/login.html` (or `https://links.yourdomain.com/login.html`)
- **Default Credentials**:
  - **Username**: `admin`
  - **Password**: `admin123` *(Please change this upon first login!)*

---

## 🔑 Authentication & Security Features

### 1. WebAuthn Passkeys (Biometric Sign-In)
1. Log into the Admin Dashboard -> **Account & Passkeys** tab.
2. Under **WebAuthn & Passkeys**, click **"Register New Passkey"**.
3. Scan your fingerprint, Face ID, or insert your security key.
4. You can now log in instantly using **"Sign in with Passkey / Biometrics"**.

### 2. Passwordless Mode
In the **Sign-In Security Policy** section under **Account & Passkeys**, you can toggle **"Allow Password Sign-In"** off.
- The password form and divider are completely removed from `/login.html`.
- The system enforces a lockout prevention check, requiring at least one registered Passkey before password login can be disabled.

### 3. TOTP 2FA & Fallback Recovery
1. Under **Account & Passkeys**, click **"Setup Authenticator"**.
2. Scan the generated QR code using **Google Authenticator**, **1Password**, or **Apple Passwords**.
3. Enter the 6-digit confirmation code to activate.
4. On `/login.html`, you can sign in using **"Sign in with Authenticator App (TOTP)"** even if Passkeys or Passwords are lost.

---

## 🛡️ OWASP ASVS Security Architecture

| ASVS Category | Hardening Controls Implemented |
| :--- | :--- |
| **V1: Architecture** | `trust proxy` for Cloudflare Tunnel, internal Redis network isolation. |
| **V2: Authentication** | Distributed sliding-window rate limiting (max 5 auth attempts per 15 min), anti-brute force, password policy enforcement (min 8 chars, common-password rejection). |
| **V3: Session Management** | JWT `jti` token blacklisting in Redis on logout/password reset, dynamic `Secure` cookies, `HttpOnly`, `SameSite=Lax`, `Cache-Control: no-store` on admin endpoints. |
| **V4: Access Control** | Authentication enforced on all `/api/admin/*` routes, IDOR protection. |
| **V5: Validation** | URL scheme whitelisting (`http`, `https`, `mailto`, `tel`, `viber`), blocking `javascript:` and `data:` XSS vectors. |
| **V7: Logging & Errors** | Structured security audit logger (`Logger.audit`), generic error handling with zero stack trace or SQL leaks. |
| **V12: File Uploads** | Binary magic byte verification (JPEG, PNG, GIF, WebP, ICO), SVG script rejection, randomized safe filenames (`img_<hex>.ext`). |
| **V14: Configuration** | Strict `Content-Security-Policy`, HSTS (`Strict-Transport-Security`), `Permissions-Policy`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`. |

---

## 🔄 Resetting Admin Password via CLI

If you ever forget your password or need a manual CLI reset:

```bash
docker exec -it bio-page node -e "const bcrypt = require('bcryptjs'); const { db } = require('./src/db'); db.prepare('UPDATE users SET password_hash = ? WHERE id = 1').run(bcrypt.hashSync('MyNewSecretPassword', 10)); console.log('Password reset successfully!');"
```

---

## 📂 Persistent Data & Backups

All state is preserved in `./data`:
- `data/database.sqlite`: SQLite database (profile, links, social accounts, passkeys, TOTP secrets).
- `data/uploads/`: Uploaded avatar & media images.
- `data/redis/`: Redis appendonly persistence files.

To backup your instance, simply backup the `./data` directory.

---

## ⚙️ Configuration & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port exposed by the web server |
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |
| `ADMIN_USERNAME` | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | `admin123` | Initial admin password |
| `JWT_SECRET` | *(Random)* | Secret key for signing JWT session tokens |
| `RP_NAME` | `Bio Page Passkey` | WebAuthn Relying Party Name |
| `RP_ID` | `localhost` | WebAuthn domain (e.g. `links.yourdomain.com`) |
| `ORIGIN` | `http://localhost:3000` | WebAuthn Origin URL (e.g. `https://links.yourdomain.com`) |
| `DATA_DIR` | `/app/data` | Directory where SQLite and uploads are stored |

---

## 🤝 Contributing & Pull Requests

Feel free to open a **Pull Request** or issue! Whether it's adding new features, improving themes, optimizing caching, or fixing bugs, contributions are always welcome.

---

## 📄 License
MIT License. Free to use, self-host, and customize!
