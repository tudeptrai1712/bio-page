const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(dataDir, 'uploads');
const redisDir = path.join(dataDir, 'redis');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(redisDir)) {
  fs.mkdirSync(redisDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');

// Initialize tables
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS authenticators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      credential_id TEXT UNIQUE NOT NULL,
      credential_public_key TEXT NOT NULL,
      counter INTEGER DEFAULT 0,
      transports TEXT DEFAULT '',
      device_name TEXT DEFAULT 'Passkey / Biometric Device',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT DEFAULT 'Your Name',
      handle TEXT DEFAULT '@yourhandle',
      tagline TEXT DEFAULT 'Digital Creator & Developer',
      bio TEXT DEFAULT 'Welcome to my official bio page! Check out my work, social profiles, and recent projects below.',
      avatar_url TEXT DEFAULT '',
      banner_url TEXT DEFAULT '',
      theme TEXT DEFAULT 'midnight',
      accent_color TEXT DEFAULT '#6366f1',
      background_type TEXT DEFAULT 'preset',
      background_value TEXT DEFAULT 'midnight',
      seo_title TEXT DEFAULT 'My Bio Page',
      seo_description TEXT DEFAULT 'Personal bio, links, and portfolio',
      footer_text TEXT DEFAULT 'Built with Self-Hosted Bio Page',
      show_share_button INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS social_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT DEFAULT '',
      display_order INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT '🔗',
      is_highlighted INTEGER DEFAULT 0,
      display_order INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      clicks INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      event_type TEXT NOT NULL,
      target_id INTEGER,
      referrer TEXT DEFAULT '',
      user_agent TEXT DEFAULT ''
    );
  `);

  // Seed default admin if not exists
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount === 0) {
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(defaultPassword, salt);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(defaultUsername, hash);
    console.log(`[DB] Created default admin account: "${defaultUsername}" (Password: "${defaultPassword}")`);
  }

  // Seed default profile if not exists
  const profileCount = db.prepare('SELECT COUNT(*) AS count FROM profile').get().count;
  if (profileCount === 0) {
    db.prepare(`
      INSERT INTO profile (id, name, handle, tagline, bio, theme, accent_color)
      VALUES (1, 'Alex Morgan', '@alexmorgan', 'Full-Stack Developer & Creator 🚀', 'Building open-source tools and sharing knowledge about modern web tech. Feel free to explore my links below!', 'midnight', '#6366f1')
    `).run();
  }

  // Seed sample links if empty
  const linksCount = db.prepare('SELECT COUNT(*) AS count FROM links').get().count;
  if (linksCount === 0) {
    const insertLink = db.prepare(`
      INSERT INTO links (title, url, description, icon, is_highlighted, display_order, enabled)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    insertLink.run('Personal Portfolio', 'https://github.com', 'Check out my latest web projects and case studies', '💻', 1, 1);
    insertLink.run('Latest Blog Post', 'https://medium.com', 'How I built a high-performance bio page with Docker', '📝', 0, 2);
    insertLink.run('YouTube Channel', 'https://youtube.com', 'Tutorials, tech guides, and productivity workflows', '🎥', 0, 3);
    insertLink.run('Buy Me a Coffee', 'https://buymeacoffee.com', 'Support my open-source projects', '☕', 0, 4);
  }

  // Seed sample social links if empty
  const socialsCount = db.prepare('SELECT COUNT(*) AS count FROM social_links').get().count;
  if (socialsCount === 0) {
    const insertSocial = db.prepare(`
      INSERT INTO social_links (platform, url, icon, display_order, enabled)
      VALUES (?, ?, ?, ?, 1)
    `);

    insertSocial.run('github', 'https://github.com', 'fab fa-github', 1);
    insertSocial.run('x', 'https://x.com', 'fab fa-x-twitter', 2);
    insertSocial.run('linkedin', 'https://linkedin.com', 'fab fa-linkedin', 3);
    insertSocial.run('youtube', 'https://youtube.com', 'fab fa-youtube', 4);
    insertSocial.run('email', 'mailto:alex@example.com', 'fas fa-envelope', 5);
  }
}

initDatabase();

module.exports = {
  db,
  dataDir,
  uploadsDir
};
