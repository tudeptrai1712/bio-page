document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const metaTitle = document.getElementById('meta-title');
  const metaDesc = document.getElementById('meta-description');
  const avatarContainer = document.getElementById('avatar-container');
  const nameText = document.getElementById('name-text');
  const profileHandle = document.getElementById('profile-handle');
  const profileTagline = document.getElementById('profile-tagline');
  const profileBio = document.getElementById('profile-bio');
  const socialsContainer = document.getElementById('socials-container');
  const linksContainer = document.getElementById('links-container');
  const footerText = document.getElementById('footer-text');
  const btnShare = document.getElementById('btn-share');
  const toastMsg = document.getElementById('toast-msg');
  const toastTextContent = document.getElementById('toast-text-content');

  // Platform icon mapper
  const socialIconMap = {
    github: 'fab fa-github',
    x: 'fab fa-x-twitter',
    twitter: 'fab fa-x-twitter',
    linkedin: 'fab fa-linkedin',
    youtube: 'fab fa-youtube',
    instagram: 'fab fa-instagram',
    facebook: 'fab fa-facebook',
    discord: 'fab fa-discord',
    telegram: 'fab fa-telegram',
    twitch: 'fab fa-twitch',
    tiktok: 'fab fa-tiktok',
    spotify: 'fab fa-spotify',
    threads: 'fab fa-threads',
    reddit: 'fab fa-reddit',
    medium: 'fab fa-medium',
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
    }, 2800);
  }

  // Material 3 Ripple Effect Handler
  function createRipple(e) {
    const target = e.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(target.clientWidth, target.clientHeight);
    const radius = diameter / 2;

    const rect = target.getBoundingClientRect();
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.classList.add('m3-ripple');

    const existingRipple = target.querySelector('.m3-ripple');
    if (existingRipple) existingRipple.remove();

    target.appendChild(circle);
  }

  document.querySelectorAll('.m3-ripple-surface').forEach(el => {
    el.addEventListener('click', createRipple);
  });

  // Record page view analytics
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

    // Apply SEO & Title
    if (profile.seo_title) {
      document.title = profile.seo_title;
      if (metaTitle) metaTitle.textContent = profile.seo_title;
    } else if (profile.name) {
      document.title = `${profile.name} | Bio`;
    }

    if (profile.seo_description && metaDesc) {
      metaDesc.setAttribute('content', profile.seo_description);
    }

    // Apply Theme & Accent Color
    if (profile.theme) {
      document.body.setAttribute('data-theme', profile.theme);
    }
    if (profile.accent_color) {
      document.documentElement.style.setProperty('--m3-sys-color-primary', profile.accent_color);
      document.documentElement.style.setProperty('--m3-glow-primary', `${profile.accent_color}55`);
    }

    // Custom Background (Image or Custom Gradient)
    if (profile.background_type === 'image' && profile.background_value) {
      document.body.style.backgroundImage = `url(${profile.background_value})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
    } else if (profile.background_type === 'custom' && profile.background_value) {
      document.body.style.background = profile.background_value;
    }

    // Profile Details
    nameText.textContent = profile.name || 'Anonymous';
    profileHandle.textContent = profile.handle ? (profile.handle.startsWith('@') ? profile.handle : `@${profile.handle}`) : '';
    profileTagline.textContent = profile.tagline || '';
    profileBio.textContent = profile.bio || '';
    if (profile.footer_text) {
      footerText.textContent = profile.footer_text;
    }

    // Avatar
    if (profile.avatar_url && profile.avatar_url.trim()) {
      avatarContainer.innerHTML = `
        <div class="avatar-ring"></div>
        <img src="${profile.avatar_url}" alt="${profile.name}" class="avatar-img" onerror="this.onerror=null; this.parentNode.innerHTML='<div class=\\'avatar-ring\\'></div><div class=\\'avatar-placeholder\\'>${(profile.name || 'A')[0].toUpperCase()}</div>';">
      `;
    } else {
      const initial = (profile.name || 'A').trim().charAt(0).toUpperCase();
      avatarContainer.innerHTML = `
        <div class="avatar-ring"></div>
        <div class="avatar-placeholder">${initial}</div>
      `;
    }

    // Render Social Links
    socialsContainer.innerHTML = '';
    if (socials && socials.length > 0) {
      socials.forEach((item, idx) => {
        let iconClass = item.icon;
        if (!iconClass || !iconClass.trim()) {
          const key = (item.platform || '').toLowerCase().trim();
          iconClass = socialIconMap[key] || 'fas fa-link';
        }

        let href = item.url;
        if (item.platform.toLowerCase() === 'email' && !href.startsWith('mailto:')) {
          href = `mailto:${href}`;
        }

        const a = document.createElement('a');
        a.className = 'social-chip m3-ripple-surface';
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('aria-label', item.platform || 'Social Link');
        a.title = item.platform || 'Link';
        a.style.animation = `m3Enter 0.4s var(--m3-motion-easing-spring) ${idx * 50}ms forwards`;
        a.innerHTML = `<i class="${iconClass}"></i>`;
        a.addEventListener('click', createRipple);
        socialsContainer.appendChild(a);
      });
    }

    // Render Custom Links with Staggered M3 Motion
    linksContainer.innerHTML = '';
    if (links && links.length > 0) {
      links.forEach((link, index) => {
        const a = document.createElement('a');
        a.className = `m3-card-link m3-ripple-surface ${link.is_highlighted ? 'highlighted' : ''}`;
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.opacity = '0';
        a.style.animation = `m3Enter 0.5s var(--m3-motion-easing-emphasized-decel) ${index * 80}ms forwards`;

        let iconHtml = '';
        if (link.icon && link.icon.startsWith('fa')) {
          iconHtml = `<i class="${link.icon}"></i>`;
        } else if (link.icon) {
          iconHtml = `<span>${link.icon}</span>`;
        } else {
          iconHtml = `<span>🔗</span>`;
        }

        a.innerHTML = `
          <div class="link-tonal-icon">${iconHtml}</div>
          <div class="link-content-box">
            <div class="link-headline">${escapeHtml(link.title)}</div>
            ${link.description ? `<div class="link-subhead">${escapeHtml(link.description)}</div>` : ''}
          </div>
          <div class="link-arrow-circle">
            <i class="fas fa-arrow-right"></i>
          </div>
        `;

        a.addEventListener('click', createRipple);

        // Click analytics listener
        a.addEventListener('click', () => {
          fetch(`/api/analytics/click/${link.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referrer: window.location.href })
          }).catch(() => {});
        });

        linksContainer.appendChild(a);
      });
    } else {
      linksContainer.innerHTML = '<p style="text-align:center; color: var(--m3-sys-color-on-surface-variant); font-size: 0.95rem;">No links added yet.</p>';
    }

    // Share button handler
    if (btnShare) {
      btnShare.addEventListener('click', async () => {
        const shareData = {
          title: profile.name || 'Bio Page',
          text: profile.tagline || profile.bio || 'Check out my bio page!',
          url: window.location.href
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
          } catch (err) {}
        } else {
          navigator.clipboard.writeText(window.location.href).then(() => {
            showToast('Bio link copied to clipboard! 📋✨');
          }).catch(() => {
            showToast('Unable to copy link.');
          });
        }
      });
    }

  } catch (err) {
    console.error('Error rendering bio page:', err);
    linksContainer.innerHTML = '<p style="text-align:center; color: #ef4444;">Failed to load bio page data. Please check server.</p>';
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
