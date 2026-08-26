document.addEventListener('DOMContentLoaded', async () => {
  const metaTitle = document.getElementById('meta-title');
  const metaDesc = document.getElementById('meta-description');
  const avatarContainer = document.getElementById('avatar-container');
  const profileName = document.getElementById('profile-name');
  const profileHandle = document.getElementById('profile-handle');
  const profileBio = document.getElementById('profile-bio');
  const contactDetailsBar = document.getElementById('contact-details-bar');
  const linksContainer = document.getElementById('links-container');
  const footerText = document.getElementById('footer-text');
  const btnShare = document.getElementById('btn-share');
  const toastMsg = document.getElementById('toast-msg');
  const toastTextContent = document.getElementById('toast-text-content');

  // Platform icon mapper
  const iconMap = {
    facebook: 'fab fa-facebook-f',
    instagram: 'fab fa-instagram',
    telegram: 'fab fa-telegram',
    whatsapp: 'fab fa-whatsapp',
    signal: 'fas fa-comment-dots',
    zalo: 'fas fa-message',
    youtube: 'fab fa-youtube',
    tiktok: 'fab fa-tiktok',
    x: 'fab fa-x-twitter',
    twitter: 'fab fa-x-twitter',
    threads: 'fab fa-threads',
    github: 'fab fa-github',
    linkedin: 'fab fa-linkedin',
    discord: 'fab fa-discord',
    spotify: 'fab fa-spotify',
    twitch: 'fab fa-twitch',
    snapchat: 'fab fa-snapchat',
    reddit: 'fab fa-reddit',
    pinterest: 'fab fa-pinterest',
    viber: 'fab fa-viber',
    wechat: 'fab fa-weixin',
    medium: 'fab fa-medium',
    patreon: 'fab fa-patreon',
    locket: 'fas fa-heart',
    email: 'fas fa-envelope',
    website: 'fas fa-globe',
    phone: 'fas fa-phone'
  };

  // M3 Expressive Toast
  function showToast(text) {
    if (toastTextContent) toastTextContent.textContent = text;
    toastMsg.classList.add('show');
    setTimeout(() => {
      toastMsg.classList.remove('show');
    }, 2600);
  }

  // Close open dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.card-action-dots') && !e.target.closest('.card-context-menu')) {
      document.querySelectorAll('.card-context-menu.open').forEach(menu => menu.classList.remove('open'));
    }
  });

  // Track page view
  fetch('/api/analytics/view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referrer: document.referrer })
  }).catch(() => {});

  try {
    const res = await fetch('/api/profile');
    if (!res.ok) throw new Error('Failed to load profile');
    const data = await res.json();
    const { profile, links, socials } = data;

    // Apply M3 Dynamic Color Tokens (Android Monet Engine)
    if (window.M3Theme) {
      window.M3Theme.applyDynamicTokens(profile.accent_color || '#818cf8', profile.color_mode || 'auto');
    }

    // Apply SEO & Title
    if (profile.seo_title) {
      document.title = profile.seo_title;
      if (metaTitle) metaTitle.textContent = profile.seo_title;
    } else if (profile.handle || profile.name) {
      document.title = `${profile.handle || profile.name} | Links`;
    }

    if (profile.seo_description && metaDesc) {
      metaDesc.setAttribute('content', profile.seo_description);
    }

    // Custom Background (Image or Custom Gradient)
    if (profile.background_type === 'image' && profile.background_value) {
      document.body.style.backgroundImage = `url(${profile.background_value})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
    } else if (profile.background_type === 'custom' && profile.background_value) {
      document.body.style.background = profile.background_value;
    }

    // Display Name & Handle
    if (profileName) {
      profileName.textContent = profile.name || '';
      if (!profile.name || !profile.name.trim()) {
        profileName.style.display = 'none';
      } else {
        profileName.style.display = 'block';
      }
    }

    const handleStr = profile.handle || '@username';
    profileHandle.textContent = handleStr.startsWith('@') ? handleStr : `@${handleStr}`;

    // Bio
    if (profileBio) {
      profileBio.textContent = profile.bio || profile.tagline || '';
      if (!profile.bio && !profile.tagline) profileBio.style.display = 'none';
    }

    // Footer
    if (profile.footer_text && footerText) {
      footerText.textContent = profile.footer_text;
    }

    // Avatar
    if (profile.avatar_url && profile.avatar_url.trim()) {
      avatarContainer.innerHTML = `<img src="${profile.avatar_url}" alt="${handleStr}" class="avatar-image" onerror="this.onerror=null; this.parentNode.innerHTML='<div class=\\'avatar-fallback\\'>${handleStr.replace('@','').charAt(0).toUpperCase()}</div>';">`;
    } else {
      const initial = handleStr.replace('@','').trim().charAt(0).toUpperCase() || 'U';
      avatarContainer.innerHTML = `<div class="avatar-fallback">${initial}</div>`;
    }

    // Direct Contacts & Social Networks Bar
    contactDetailsBar.innerHTML = '';
    const renderedPlatforms = new Set();

    // Helper to normalize URLs based on platform type
    function normalizeSocialUrl(platform, rawVal) {
      const v = rawVal.trim();
      if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('mailto:') || v.startsWith('tel:') || v.startsWith('viber:')) {
        return v;
      }
      switch (platform.toLowerCase()) {
        case 'email':
          return `mailto:${v}`;
        case 'phone':
          return `tel:${v}`;
        case 'whatsapp':
          return `https://wa.me/${v.replace(/[^0-9]/g, '')}`;
        case 'telegram':
          return `https://t.me/${v.replace('@', '')}`;
        case 'signal':
          return `https://signal.me/#p/${v}`;
        case 'zalo':
          return `https://zalo.me/${v.replace(/[^0-9]/g, '')}`;
        case 'github':
          return `https://github.com/${v.replace('@', '')}`;
        case 'x':
        case 'twitter':
          return `https://x.com/${v.replace('@', '')}`;
        case 'instagram':
          return `https://instagram.com/${v.replace('@', '')}`;
        case 'threads':
          return `https://threads.net/@${v.replace('@', '')}`;
        case 'tiktok':
          return `https://tiktok.com/@${v.replace('@', '')}`;
        case 'youtube':
          return `https://youtube.com/${v.startsWith('@') ? v : '@' + v}`;
        case 'facebook':
          return `https://facebook.com/${v}`;
        case 'linkedin':
          return `https://linkedin.com/in/${v.replace('@', '')}`;
        case 'discord':
          return v.startsWith('invite/') ? `https://discord.gg/${v.replace('invite/', '')}` : `https://discord.gg/${v}`;
        default:
          return `https://${v}`;
      }
    }

    // 1. Render Direct Contacts from Profile tab
    const directContacts = [
      { key: 'email', val: profile.contact_email, icon: 'fas fa-envelope', label: 'Email' },
      { key: 'phone', val: profile.contact_phone, icon: 'fas fa-phone', label: 'Phone' },
      { key: 'whatsapp', val: profile.contact_whatsapp, icon: 'fab fa-whatsapp', label: 'WhatsApp' },
      { key: 'telegram', val: profile.contact_telegram, icon: 'fab fa-telegram', label: 'Telegram' },
      { key: 'signal', val: profile.contact_signal, icon: 'fas fa-comment-dots', label: 'Signal' },
      { key: 'zalo', val: profile.contact_zalo, icon: 'fas fa-message', label: 'Zalo' }
    ];

    directContacts.forEach(c => {
      if (c.val && c.val.trim()) {
        renderedPlatforms.add(c.key.toLowerCase());
        const a = document.createElement('a');
        a.className = 'contact-icon-pill m3-ripple-surface';
        a.href = normalizeSocialUrl(c.key, c.val);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title = `${c.label}: ${c.val}`;
        a.setAttribute('aria-label', c.label);
        a.innerHTML = `<i class="${c.icon}"></i>`;
        contactDetailsBar.appendChild(a);
      }
    });

    // 2. Render Social Links from Social Links tab
    if (socials && Array.isArray(socials)) {
      socials.forEach(s => {
        const platKey = (s.platform || 'custom').toLowerCase();
        if (s.url && s.url.trim() && !renderedPlatforms.has(platKey)) {
          renderedPlatforms.add(platKey);
          const iconClass = s.icon || iconMap[platKey] || 'fas fa-globe';
          const label = platKey.charAt(0).toUpperCase() + platKey.slice(1);
          const a = document.createElement('a');
          a.className = 'contact-icon-pill m3-ripple-surface';
          a.href = normalizeSocialUrl(platKey, s.url);
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.title = `${label}: ${s.url}`;
          a.setAttribute('aria-label', label);
          a.innerHTML = `<i class="${iconClass}"></i>`;
          contactDetailsBar.appendChild(a);
        }
      });
    }

    // Links Rendering (matching user reference card design)
    linksContainer.innerHTML = '';
    if (links && links.length > 0) {
      links.forEach((link, idx) => {
        const card = document.createElement('div');
        card.className = `bio-link-card m3-ripple-surface ${link.is_highlighted ? 'highlighted' : ''}`;
        card.style.animation = `m3Enter 0.5s var(--m3-motion-spring-expressive) ${idx * 60}ms forwards`;
        card.style.opacity = '0';

        // Detect icon
        let iconClass = link.icon;
        let isEmoji = false;
        if (!iconClass || !iconClass.trim()) {
          const lower = link.title.toLowerCase().trim();
          iconClass = iconMap[lower] || 'fas fa-globe';
        } else if (!iconClass.startsWith('fa') && !iconClass.includes(' ')) {
          isEmoji = true;
        }

        const iconHtml = isEmoji ? `<span>${iconClass}</span>` : `<i class="${iconClass}"></i>`;

        card.innerHTML = `
          <div class="card-icon-area">${iconHtml}</div>
          <div class="card-title-area">${escapeHtml(link.title)}</div>
          <div class="card-action-dots" title="Options">
            <i class="fas fa-ellipsis-vertical"></i>
          </div>

          <!-- 3-dots Dropdown Context Menu -->
          <div class="card-context-menu">
            <button class="menu-item-btn btn-menu-copy">
              <i class="fas fa-copy"></i> Copy Link
            </button>
            <button class="menu-item-btn btn-menu-share">
              <i class="fas fa-share"></i> Share
            </button>
            <button class="menu-item-btn btn-menu-open">
              <i class="fas fa-external-link-alt"></i> Open
            </button>
          </div>
        `;

        // Click card to open destination URL
        card.addEventListener('click', (e) => {
          if (e.target.closest('.card-action-dots') || e.target.closest('.card-context-menu')) {
            return;
          }
          fetch(`/api/analytics/click/${link.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referrer: window.location.href })
          }).catch(() => {});
          window.open(link.url, '_blank', 'noopener,noreferrer');
        });

        // 3-dots menu button toggle
        const dotsBtn = card.querySelector('.card-action-dots');
        const menu = card.querySelector('.card-context-menu');

        dotsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = menu.classList.contains('open');
          document.querySelectorAll('.card-context-menu.open').forEach(m => m.classList.remove('open'));
          if (!isOpen) menu.classList.add('open');
        });

        // Copy action
        card.querySelector('.btn-menu-copy').addEventListener('click', (e) => {
          e.stopPropagation();
          menu.classList.remove('open');
          navigator.clipboard.writeText(link.url).then(() => {
            showToast('Link copied to clipboard! 📋');
          });
        });

        // Share action
        card.querySelector('.btn-menu-share').addEventListener('click', (e) => {
          e.stopPropagation();
          menu.classList.remove('open');
          if (navigator.share) {
            navigator.share({ title: link.title, url: link.url }).catch(() => {});
          } else {
            navigator.clipboard.writeText(link.url).then(() => showToast('Link copied! 📋'));
          }
        });

        // Open action
        card.querySelector('.btn-menu-open').addEventListener('click', (e) => {
          e.stopPropagation();
          menu.classList.remove('open');
          window.open(link.url, '_blank', 'noopener,noreferrer');
        });

        linksContainer.appendChild(card);
      });

      // Re-init dynamic motion physics on rendered elements
      if (window.M3Theme && window.M3Theme.initMotionPhysics) {
        window.M3Theme.initMotionPhysics();
      }
    } else {
      linksContainer.innerHTML = '<p style="text-align:center; color: var(--m3-sys-color-on-surface-variant); font-size: 0.95rem;">No links found.</p>';
    }

    // Top Share Button
    if (btnShare) {
      btnShare.addEventListener('click', async () => {
        const shareData = {
          title: profile.handle || profile.name || 'Bio Page',
          text: `Check out ${profile.handle || profile.name}'s bio page!`,
          url: window.location.href
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
          } catch (err) {}
        } else {
          navigator.clipboard.writeText(window.location.href).then(() => {
            showToast('Profile link copied! 📋✨');
          });
        }
      });
    }

  } catch (err) {
    console.error('Error rendering bio page:', err);
    linksContainer.innerHTML = '<p style="text-align:center; color: #ef4444;">Failed to load bio page data.</p>';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
