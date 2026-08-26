const express = require('express');
const router = express.Router();

const { db } = require('../db');
const { requireAuth } = require('../auth');
const { invalidateProfileCache } = require('../redis');
const upload = require('../middleware/upload');

// Apply authentication middleware to all admin routes
router.use(requireAuth);

// -------------------------------------------------------------
// PROFILE & CUSTOMIZATION
// -------------------------------------------------------------

// Get admin profile
router.get('/profile', (req, res) => {
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  res.json(profile || {});
});

// Update profile details (auto-invalidates Redis cache)
router.put('/profile', async (req, res) => {
  const {
    name,
    handle,
    tagline,
    bio,
    avatar_url,
    banner_url,
    theme,
    accent_color,
    background_type,
    background_value,
    seo_title,
    seo_description,
    footer_text,
    contact_email,
    contact_phone,
    contact_whatsapp,
    contact_telegram,
    contact_signal,
    color_mode,
    show_share_button
  } = req.body;

  try {
    db.prepare(`
      UPDATE profile SET
        name = ?,
        handle = ?,
        tagline = ?,
        bio = ?,
        avatar_url = ?,
        banner_url = ?,
        theme = ?,
        accent_color = ?,
        background_type = ?,
        background_value = ?,
        seo_title = ?,
        seo_description = ?,
        footer_text = ?,
        contact_email = ?,
        contact_phone = ?,
        contact_whatsapp = ?,
        contact_telegram = ?,
        contact_signal = ?,
        color_mode = ?,
        show_share_button = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      name || '',
      handle || '',
      tagline || '',
      bio || '',
      avatar_url || '',
      banner_url || '',
      theme || 'classic-gray',
      accent_color || '#818cf8',
      background_type || 'preset',
      background_value || 'classic-gray',
      seo_title || 'My Bio Page',
      seo_description || '',
      footer_text || '',
      contact_email || '',
      contact_phone || '',
      contact_whatsapp || '',
      contact_telegram || '',
      contact_signal || '',
      color_mode || 'auto',
      show_share_button ? 1 : 0
    );

    // Invalidate Redis Cache
    await invalidateProfileCache();

    const updated = db.prepare('SELECT * FROM profile WHERE id = 1').get();
    res.json({ success: true, profile: updated });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile settings' });
  }
});

// File upload (Avatar / Banner)
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    fileUrl: fileUrl,
    filename: req.file.filename
  });
});

// -------------------------------------------------------------
// LINKS MANAGEMENT
// -------------------------------------------------------------

// Get all links
router.get('/links', (req, res) => {
  const links = db.prepare('SELECT * FROM links ORDER BY display_order ASC, id ASC').all();
  res.json(links || []);
});

// Create new link
router.post('/links', async (req, res) => {
  const { title, url, description, icon, is_highlighted, enabled } = req.body;

  if (!title || !url) {
    return res.status(400).json({ error: 'Title and URL are required' });
  }

  try {
    const maxOrderRow = db.prepare('SELECT MAX(display_order) as maxOrder FROM links').get();
    const nextOrder = (maxOrderRow.maxOrder || 0) + 1;

    const result = db.prepare(`
      INSERT INTO links (title, url, description, icon, is_highlighted, display_order, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      url,
      description || '',
      icon || '🔗',
      is_highlighted ? 1 : 0,
      nextOrder,
      enabled !== undefined ? (enabled ? 1 : 0) : 1
    );

    await invalidateProfileCache();

    const newLink = db.prepare('SELECT * FROM links WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, link: newLink });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create link' });
  }
});

// Update link
router.put('/links/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, url, description, icon, is_highlighted, enabled, display_order } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM links WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Link not found' });

    db.prepare(`
      UPDATE links SET
        title = ?,
        url = ?,
        description = ?,
        icon = ?,
        is_highlighted = ?,
        enabled = ?,
        display_order = ?
      WHERE id = ?
    `).run(
      title !== undefined ? title : existing.title,
      url !== undefined ? url : existing.url,
      description !== undefined ? description : existing.description,
      icon !== undefined ? icon : existing.icon,
      is_highlighted !== undefined ? (is_highlighted ? 1 : 0) : existing.is_highlighted,
      enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
      display_order !== undefined ? display_order : existing.display_order,
      id
    );

    await invalidateProfileCache();

    const updated = db.prepare('SELECT * FROM links WHERE id = ?').get(id);
    res.json({ success: true, link: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update link' });
  }
});

// Delete link
router.delete('/links/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    db.prepare('DELETE FROM links WHERE id = ?').run(id);
    await invalidateProfileCache();
    res.json({ success: true, message: 'Link deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

// Reorder links
router.post('/links/reorder', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'Order must be an array of link IDs' });
  }

  const updateStmt = db.prepare('UPDATE links SET display_order = ? WHERE id = ?');
  const transaction = db.transaction((ids) => {
    ids.forEach((id, index) => {
      updateStmt.run(index + 1, id);
    });
  });

  try {
    transaction(order);
    await invalidateProfileCache();
    res.json({ success: true, message: 'Links reordered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder links' });
  }
});

// -------------------------------------------------------------
// SOCIAL LINKS MANAGEMENT
// -------------------------------------------------------------

// Get social links
router.get('/socials', (req, res) => {
  const socials = db.prepare('SELECT * FROM social_links ORDER BY display_order ASC, id ASC').all();
  res.json(socials || []);
});

// Batch update social links
router.post('/socials', async (req, res) => {
  const { socials } = req.body;

  if (!Array.isArray(socials)) {
    return res.status(400).json({ error: 'Socials must be an array' });
  }

  const transaction = db.transaction((items) => {
    db.prepare('DELETE FROM social_links').run();
    const insertStmt = db.prepare(`
      INSERT INTO social_links (platform, url, icon, display_order, enabled)
      VALUES (?, ?, ?, ?, ?)
    `);

    items.forEach((item, index) => {
      if (item.url && item.url.trim()) {
        insertStmt.run(
          item.platform || 'custom',
          item.url.trim(),
          item.icon || '',
          index + 1,
          item.enabled !== undefined ? (item.enabled ? 1 : 0) : 1
        );
      }
    });
  });

  try {
    transaction(socials);
    await invalidateProfileCache();
    const updated = db.prepare('SELECT * FROM social_links ORDER BY display_order ASC, id ASC').all();
    res.json({ success: true, socials: updated });
  } catch (err) {
    console.error('Error saving socials:', err);
    res.status(500).json({ error: 'Failed to update social links' });
  }
});

// -------------------------------------------------------------
// AUTHENTICATORS (PASSKEYS) MANAGEMENT
// -------------------------------------------------------------

// List registered passkeys
router.get('/authenticators', (req, res) => {
  try {
    const authenticators = db.prepare(`
      SELECT id, device_name, created_at, last_used_at
      FROM authenticators
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(req.user.id);
    res.json(authenticators || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch authenticators' });
  }
});

// Delete / Revoke passkey
router.delete('/authenticators/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    db.prepare('DELETE FROM authenticators WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true, message: 'Passkey deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete passkey' });
  }
});

// -------------------------------------------------------------
// ANALYTICS & STATS
// -------------------------------------------------------------

// Admin Stats & Analytics
router.get('/stats', (req, res) => {
  try {
    const totalViews = db.prepare("SELECT COUNT(*) as count FROM analytics WHERE event_type = 'view'").get().count;
    const totalClicks = db.prepare("SELECT COUNT(*) as count FROM analytics WHERE event_type = 'click'").get().count;

    const linkStats = db.prepare(`
      SELECT id, title, url, icon, clicks, enabled
      FROM links
      ORDER BY clicks DESC, display_order ASC
    `).all();

    const recentViews = db.prepare(`
      SELECT DATE(timestamp) as date, COUNT(*) as count
      FROM analytics
      WHERE event_type = 'view' AND timestamp >= datetime('now', '-7 days')
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `).all();

    const recentClicks = db.prepare(`
      SELECT DATE(timestamp) as date, COUNT(*) as count
      FROM analytics
      WHERE event_type = 'click' AND timestamp >= datetime('now', '-7 days')
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `).all();

    res.json({
      totalViews,
      totalClicks,
      linkStats,
      recentViews,
      recentClicks
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

module.exports = router;

