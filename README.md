# ⚡ Self-Hosted Bio Page (with Admin Dashboard, Redis & WebAuthn)

A high-performance, modern, self-hosted link-in-bio page (alternative to Linktree / Bento) with an interactive **Admin Panel**, **Redis sub-millisecond caching & real-time analytics**, and passwordless **WebAuthn / Passkeys** (Touch ID, Windows Hello, Face ID, YubiKey) authentication.

---

## ✨ Features

- 🔒 **Interactive Admin Dashboard**: Password-protected and Passkey-protected web management panel (`/login.html`).
- 🔑 **WebAuthn / Passkey Biometrics**: Log in in 1-click using Windows Hello, Apple Touch ID / Face ID, Android Biometrics, or YubiKey hardware tokens.
- ⚡ **Redis Acceleration**: Sub-millisecond caching of public bio data with instant cache invalidation upon editing, plus atomic click/view counters.
- 🎨 **Instant Theme Customizer**: Preset themes (*Midnight, Glass Blue, Neon Sunset, Cyberpunk, Emerald, Clean Light*) + custom hex accent colors and wallpaper support.
- 🔗 **Link Manager**: Add, edit, delete, toggle visibility, highlight cards, and reorder via 1-click move buttons.
- 👤 **Profile & Media Uploads**: Custom display name, handle, tagline, bio, and avatar photo uploads.
- 🌐 **Social Network Bar**: 1-click toggles for GitHub, X/Twitter, LinkedIn, YouTube, Instagram, Discord, Telegram, Email, and more.
- 📊 **Built-in Analytics**: Real-time page view counters, link clicks tracking, and click-through rates (CTR).
- 🐳 **Docker Compose Ready**: One-command deployment with persistent volume storage (`./data`).
- 📱 **Mobile-First & Ultra-Fast**: Responsive, accessible, and lightweight.

---

## 📋 Prerequisites

- **Docker & Docker Compose** (Recommended): [Get Docker Desktop](https://www.docker.com/)

*(Optional if running directly on host: Node.js 18+ and Redis server)*

---

## 🚀 Quick Start with Docker (Recommended)

1. **Clone or navigate to the project directory**:
   ```bash
   cd "bio page"
   ```

2. **Start the containers (App + Redis)**:
   ```bash
   docker compose up -d --build
   ```

3. **Open your browser**:
   - **Public Bio Page**: [http://localhost:3000](http://localhost:3000)
   - **Admin Dashboard**: [http://localhost:3000/login.html](http://localhost:3000/login.html)

4. **Default Admin Login**:
   - **Username**: `admin`
   - **Password**: `admin123`

---

## 🔑 Setting Up WebAuthn Passkeys (Biometric Sign-In)

1. Log into the Admin Dashboard at [http://localhost:3000/login.html](http://localhost:3000/login.html).
2. Go to the **Account & Keys** tab in the sidebar.
3. Under **WebAuthn & Passkeys (Biometrics)**, click **"Register New Passkey"**.
4. Enter a nickname for your device (e.g. *"MacBook Touch ID"*, *"Windows Hello"*).
5. Complete the biometric scan or tap your security key when prompted by your browser.
6. Now you can log in on `/login.html` instantly with **"Sign in with Passkey / Biometrics"**!

---

## 🔄 Resetting / Overriding Admin Password

If you ever forget your admin password or need to reset it via CLI:

```bash
# Set a new password directly (e.g. "MyNewSecretPassword")
docker exec -it bio-page node -e "const bcrypt = require('bcryptjs'); const { db } = require('./src/db'); db.prepare('UPDATE users SET password_hash = ? WHERE id = 1').run(bcrypt.hashSync('MyNewSecretPassword', 10)); console.log('Password reset successfully!');"
```

---

## 📂 Persistent Data & Backups

All data is stored inside `./data`:
- `data/database.sqlite`: SQLite database (profile, links, social accounts, passkey public keys).
- `data/uploads/`: Uploaded avatar & media images.
- `data/redis/`: Redis appendonly persistence files.

To backup or migrate your instance, copy the `./data` directory.

---

## ⚙️ Configuration & Environment Variables

You can configure options in `docker-compose.yml` or a `.env` file:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port exposed by the web server |
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |
| `ADMIN_USERNAME` | `admin` | Initial admin username (used during first setup) |
| `ADMIN_PASSWORD` | `admin123` | Initial admin password (used during first setup) |
| `JWT_SECRET` | *(Random)* | Secret key for signing session tokens |
| `RP_NAME` | `Bio Page Passkey` | WebAuthn Relying Party Name |
| `RP_ID` | `localhost` | WebAuthn RP ID domain (e.g. `yourdomain.com`) |
| `ORIGIN` | `http://localhost:3000` | WebAuthn Origin URL (e.g. `https://yourdomain.com`) |

---

## 📄 License
MIT License. Free to use, self-host, and customize!
