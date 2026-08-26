const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
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

const dbPath = process.env.DB_PATH || path.join(dataDir, 'database.sqlite');
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
      tagline TEXT DEFAULT 'Digital Creator & Developer 🚀',
      bio TEXT DEFAULT 'Welcome to my official bio page! Check out my work, social profiles, and recent links below.',
      avatar_url TEXT DEFAULT '',
      banner_url TEXT DEFAULT '',
      theme TEXT DEFAULT 'classic-gray',
      accent_color TEXT DEFAULT '#818cf8',
      background_type TEXT DEFAULT 'preset',
      background_value TEXT DEFAULT 'classic-gray',
      seo_title TEXT DEFAULT 'My Bio Page',
      seo_description TEXT DEFAULT 'Personal bio and links',
      footer_text TEXT DEFAULT 'Built with Self-Hosted Bio Page',
      contact_email TEXT DEFAULT '',
      contact_phone TEXT DEFAULT '',
      contact_whatsapp TEXT DEFAULT '',
      contact_telegram TEXT DEFAULT '',
      contact_signal TEXT DEFAULT '',
      color_mode TEXT DEFAULT 'auto',
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
      icon TEXT DEFAULT 'fas fa-globe',
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

  // Migrations for contact and theme columns if missing
  try { db.exec("ALTER TABLE profile ADD COLUMN contact_email TEXT DEFAULT ''"); } catch(e){}
  try { db.exec("ALTER TABLE profile ADD COLUMN contact_phone TEXT DEFAULT ''"); } catch(e){}
  try { db.exec("ALTER TABLE profile ADD COLUMN contact_whatsapp TEXT DEFAULT ''"); } catch(e){}
  try { db.exec("ALTER TABLE profile ADD COLUMN contact_telegram TEXT DEFAULT ''"); } catch(e){}
  try { db.exec("ALTER TABLE profile ADD COLUMN contact_signal TEXT DEFAULT ''"); } catch(e){}
  try { db.exec("ALTER TABLE profile ADD COLUMN color_mode TEXT DEFAULT 'auto'"); } catch(e){}

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
      INSERT INTO profile (id, name, handle, tagline, bio, theme, accent_color, contact_email)
      VALUES (1, 'Your Name', '@yourhandle', 'Digital Creator & Developer 🚀', 'Welcome to my official bio page! Check out my work, social profiles, and recent links below.', 'classic-gray', '#818cf8', 'hello@example.com')
    `).run();
  }

  // Seed generic sample links if empty
  const linksCount = db.prepare('SELECT COUNT(*) AS count FROM links').get().count;
  if (linksCount === 0) {
    const insertLink = db.prepare(`
      INSERT INTO links (title, url, description, icon, is_highlighted, display_order, enabled)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    insertLink.run('Facebook', 'https://facebook.com', '', 'fab fa-facebook-f', 0, 1);
    insertLink.run('Instagram', 'https://instagram.com', '', 'fab fa-instagram', 0, 2);
    insertLink.run('Locket', 'https://locket.camera', '', 'fas fa-heart', 0, 3);
    insertLink.run('YouTube', 'https://youtube.com', '', 'fab fa-youtube', 0, 4);
  }
}

initDatabase();

module.exports = {
  db,
  dataDir,
  uploadsDir
};
