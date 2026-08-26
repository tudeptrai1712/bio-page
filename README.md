# ⚡ Self-Hosted Bio Page (with Admin Dashboard, Redis & WebAuthn)

[![Build & Publish Docker Image](https://github.com/tudeptrai1712/bio-page/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/tudeptrai1712/bio-page/actions/workflows/docker-publish.yml)
[![Docker Image](https://img.shields.io/badge/GHCR-ghcr.io%2Ftudeptrai1712%2Fbio--page-blue?logo=docker)](https://github.com/tudeptrai1712/bio-page/pkgs/container/bio-page)
[![Platform](https://img.shields.io/badge/platform-linux%2Famd64%20%7C%20linux%2Farm64-informational)](https://github.com/tudeptrai1712/bio-page/pkgs/container/bio-page)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A high-performance, modern, self-hosted link-in-bio page (alternative to Linktree / Bento) with an interactive **Admin Panel**, **Redis sub-millisecond caching & real-time analytics**, and passwordless **WebAuthn / Passkeys** (Touch ID, Windows Hello, Face ID, YubiKey) authentication.

Images are **automatically built for `amd64` and `arm64` via GitHub Actions** and published to the **GitHub Container Registry (GHCR)**.

---

## ✨ Features

- 🚀 **Pre-built Container Images**: Multi-arch images (`linux/amd64`, `linux/arm64`) automatically built and published to GHCR.
- 🔒 **Interactive Admin Dashboard**: Password-protected and Passkey-protected web management panel (`/login.html`).
- 🔑 **WebAuthn / Passkey Biometrics**: Log in in 1-click using Windows Hello, Apple Touch ID / Face ID, Android Biometrics, or YubiKey hardware tokens.
- ⚡ **Redis Acceleration**: Sub-millisecond caching of public bio data with instant cache invalidation upon editing, plus atomic click/view counters.
- 🎨 **Instant Theme Customizer**: Preset themes (*Midnight, Glass Blue, Neon Sunset, Cyberpunk, Emerald, Clean Light*) + custom hex accent colors and wallpaper support.
- 🔗 **Link Manager**: Add, edit, delete, toggle visibility, highlight cards, and reorder via 1-click move buttons.
- 👤 **Profile & Media Uploads**: Custom display name, handle, tagline, bio, and avatar photo uploads.
- 🌐 **Social Network Bar**: 1-click toggles for GitHub, X/Twitter, LinkedIn, YouTube, Instagram, Discord, Telegram, Email, and more.
- 📊 **Built-in Analytics**: Real-time page view counters, link clicks tracking, and click-through rates (CTR).
- 🐳 **Docker Ready**: One-command deployment with pre-built images and persistent volume storage (`./data`).
- 🔄 **Auto-Updates with Watchtower**: Zero-downtime automated container updates on new image releases.
- 📱 **Mobile-First & Ultra-Fast**: Responsive, accessible, and lightweight.

---

## 📋 Prerequisites

- **Docker & Docker Compose**: [Get Docker Desktop / Docker Engine](https://www.docker.com/)

*(Optional if running directly on host without containers: Node.js 18+ and Redis server)*

---

## 🚀 Quick Start

### Option 1: Using Pre-built Image from GHCR (Recommended & Fastest)

> [!TIP]
> **No build step required!** You do **not** need to build the Docker image locally. Pre-built multi-arch images (`amd64`/`arm64`) are automatically pulled from GitHub Container Registry (`ghcr.io`). Simply start the container with `docker compose up -d`.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/tudeptrai1712/bio-page.git
   cd bio-page
   ```

2. **Start the containers** (Pulls pre-built image & Redis instantly):
   ```bash
   docker compose up -d
   ```

   *Or run with automated updates via Watchtower:*
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

*(Watchtower will automatically check for and pull newly published GitHub releases every 5 minutes.)*

---

### Option 2: Build Locally from Source (Optional)

If you made modifications to the source code and want to compile/build your own image locally:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/tudeptrai1712/bio-page.git
   cd bio-page
   ```

2. **Build and start the containers**:
   ```bash
   docker compose up -d --build
   ```

---

### Option 3: Quick Docker Run (Single Container with External Redis)

```bash
docker run -d \
  --name bio-page \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e REDIS_URL=redis://your-redis-host:6379 \
  -e ADMIN_PASSWORD=your_secure_password \
  ghcr.io/tudeptrai1712/bio-page:latest
```

---

## 🌐 Accessing the App

- **Public Bio Page**: [http://localhost:3000](http://localhost:3000)
- **Admin Dashboard**: [http://localhost:3000/login.html](http://localhost:3000/login.html)
- **Default Credentials**:
  - **Username**: `admin`
  - **Password**: `admin123` *(Please change this upon first login!)*

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

To backup or migrate your instance, simply backup or copy the `./data` directory.

---

## 🤖 Automated CI/CD (GitHub Actions)

This repository includes an automated workflow (`.github/workflows/docker-publish.yml`) that:
- Triggers on every push to `main`/`master`, release publication, and version tags (`v*.*.*`).
- Builds multi-platform Docker images for **`linux/amd64`** and **`linux/arm64`**.
- Pushes directly to the GitHub Container Registry: `ghcr.io/tudeptrai1712/bio-page:latest`.

---

## ⚙️ Configuration & Environment Variables

You can configure options in `docker-compose.yml`, `docker-compose.prod.yml`, or a `.env` file:

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
| `DATA_DIR` | `/app/data` | Directory where SQLite and uploads are stored |

---

## 📄 License
MIT License. Free to use, self-host, and customize!
