const express = require('express');
const router = express.Router();

const { db } = require('../db');
const {
  getCache,
  setCache,
  incrRealtimeView,
  incrRealtimeClick
} = require('../redis');

// Get full bio page public profile (with Redis caching)
router.get('/profile', async (req, res) => {
  try {
    const cached = await getCache('bio:public_profile');
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const profile = db.prepare(`
      SELECT 
        name, handle, tagline, bio, avatar_url, banner_url,
        theme, accent_color, background_type, background_value,
        seo_title, seo_description, footer_text,
        contact_email, contact_phone, contact_whatsapp, contact_telegram, contact_signal,
        color_mode, show_share_button
      FROM profile WHERE id = 1
    `).get();
    const links = db.prepare('SELECT id, title, url, description, icon, is_highlighted, display_order FROM links WHERE enabled = 1 ORDER BY display_order ASC, id ASC').all();
    const socials = db.prepare('SELECT id, platform, url, icon, display_order FROM social_links WHERE enabled = 1 ORDER BY display_order ASC, id ASC').all();

    const responseData = {
      profile: profile || {},
      links: links || [],
      socials: socials || []
    };

    // Cache in Redis for 10 minutes (600s)
    await setCache('bio:public_profile', responseData, 600);

    res.setHeader('X-Cache', 'MISS');
    res.json(responseData);
  } catch (err) {
    console.error('Error fetching public profile:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// Record page view analytics
router.post('/analytics/view', async (req, res) => {
  try {
    const referrer = req.body.referrer || req.get('referrer') || '';
    const userAgent = req.get('user-agent') || '';

    // Atomic Redis increment
    incrRealtimeView();

    // Persistent storage in SQLite
    db.prepare(`
      INSERT INTO analytics (event_type, target_id, referrer, user_agent)
      VALUES ('view', NULL, ?, ?)
    `).run(referrer.slice(0, 500), userAgent.slice(0, 500));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record analytics' });
  }
});

// Record link click analytics
router.post('/analytics/click/:id', async (req, res) => {
  try {
    const linkId = parseInt(req.params.id, 10);
    if (isNaN(linkId)) return res.status(400).json({ error: 'Invalid link ID' });

    const referrer = req.body.referrer || req.get('referrer') || '';
    const userAgent = req.get('user-agent') || '';

    // Atomic Redis increment
    incrRealtimeClick(linkId);

    // Increment click count in SQLite
    db.prepare('UPDATE links SET clicks = clicks + 1 WHERE id = ?').run(linkId);

    // Record analytics event
    db.prepare(`
      INSERT INTO analytics (event_type, target_id, referrer, user_agent)
      VALUES ('click', ?, ?, ?)
    `).run(linkId, referrer.slice(0, 500), userAgent.slice(0, 500));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record click' });
  }
});

module.exports = router;

