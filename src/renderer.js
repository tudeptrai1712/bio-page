/**
 * Server-Side Renderer (SSR) for Self-Hosted Bio Page
 * Performs 100% of data processing, URL normalization, Monet color math,
 * and semantic HTML generation on the server.
 * Eliminates all inline scripts and styles for strict CSP Level 3 compliance.
 */

const { db } = require('./db');
const { getCache, setCache } = require('./redis');
const banksData = require('./data/banks.json');
const bankMap = new Map(banksData.map(b => [b.code.toUpperCase(), b]));

// -------------------------------------------------------------
// 1. SERVER-SIDE MONET DYNAMIC COLOR ENGINE
// -------------------------------------------------------------

function hexToRgb(hex) {
  hex = (hex || '#818cf8').replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const num = parseInt(hex, 16);
  if (isNaN(num)) return { r: 129, g: 140, b: 248 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const rgb = [f(0), f(8), f(4)].map(x => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  });
  return `#${rgb.join('')}`;
}

function generateCssVariables(seedHex, isDark) {
  const rgb = hexToRgb(seedHex);
  const { h, s } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const primaryHue = h;
  const secondaryHue = (h + 30) % 360;
  const tertiaryHue = (h + 300) % 360;
  const neutralHue = h;

  if (isDark) {
    return `
      --m3-sys-color-primary: ${hslToHex(primaryHue, Math.min(s, 85), 75)};
      --m3-sys-color-on-primary: ${hslToHex(primaryHue, Math.min(s, 90), 18)};
      --m3-sys-color-primary-container: ${hslToHex(primaryHue, Math.min(s, 75), 30)};
      --m3-sys-color-on-primary-container: ${hslToHex(primaryHue, Math.min(s, 95), 88)};
      --m3-sys-color-secondary: ${hslToHex(secondaryHue, Math.min(s, 65), 72)};
      --m3-sys-color-on-secondary: ${hslToHex(secondaryHue, Math.min(s, 80), 18)};
      --m3-sys-color-secondary-container: ${hslToHex(secondaryHue, Math.min(s, 60), 28)};
      --m3-sys-color-on-secondary-container: ${hslToHex(secondaryHue, Math.min(s, 85), 86)};
      --m3-sys-color-tertiary: ${hslToHex(tertiaryHue, Math.min(s, 70), 75)};
      --m3-sys-color-on-tertiary: ${hslToHex(tertiaryHue, Math.min(s, 80), 20)};
      --m3-sys-color-background: ${hslToHex(neutralHue, 18, 7)};
      --m3-sys-color-on-background: ${hslToHex(neutralHue, 12, 93)};
      --m3-sys-color-surface: ${hslToHex(neutralHue, 16, 10)};
      --m3-sys-color-surface-dim: ${hslToHex(neutralHue, 18, 6)};
      --m3-sys-color-surface-bright: ${hslToHex(neutralHue, 14, 18)};
      --m3-sys-color-surface-container-lowest: ${hslToHex(neutralHue, 20, 5)};
      --m3-sys-color-surface-container-low: ${hslToHex(neutralHue, 16, 9)};
      --m3-sys-color-surface-container: ${hslToHex(neutralHue, 14, 13)};
      --m3-sys-color-surface-container-high: ${hslToHex(neutralHue, 14, 17)};
      --m3-sys-color-surface-container-highest: ${hslToHex(neutralHue, 14, 22)};
      --m3-sys-color-on-surface: ${hslToHex(neutralHue, 10, 92)};
      --m3-sys-color-on-surface-variant: ${hslToHex(neutralHue, 12, 70)};
      --m3-sys-color-outline: rgba(255, 255, 255, 0.12);
      --m3-sys-color-outline-variant: rgba(255, 255, 255, 0.06);
      --m3-glow-primary: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35);
      --card-bg: ${hslToHex(neutralHue, 14, 14)};
      --card-border: rgba(255, 255, 255, 0.08);
      --card-text: ${hslToHex(neutralHue, 10, 94)};
      --card-hover-bg: ${hslToHex(neutralHue, 14, 18)};
      --card-hover-border: ${hslToHex(primaryHue, Math.min(s, 85), 65)};
      --topbar-btn-bg: ${hslToHex(neutralHue, 14, 16)};
      --topbar-btn-color: ${hslToHex(neutralHue, 10, 95)};
      --bg-gradient: radial-gradient(circle at 50% 0%, ${hslToHex(primaryHue, 40, 16)} 0%, ${hslToHex(neutralHue, 18, 7)} 80%);
    `;
  } else {
    return `
      --m3-sys-color-primary: ${hslToHex(primaryHue, Math.min(s, 85), 45)};
      --m3-sys-color-on-primary: #ffffff;
      --m3-sys-color-primary-container: ${hslToHex(primaryHue, Math.min(s, 90), 92)};
      --m3-sys-color-on-primary-container: ${hslToHex(primaryHue, Math.min(s, 95), 18)};
      --m3-sys-color-secondary: ${hslToHex(secondaryHue, Math.min(s, 60), 40)};
      --m3-sys-color-on-secondary: #ffffff;
      --m3-sys-color-secondary-container: ${hslToHex(secondaryHue, Math.min(s, 70), 90)};
      --m3-sys-color-on-secondary-container: ${hslToHex(secondaryHue, Math.min(s, 90), 16)};
      --m3-sys-color-tertiary: ${hslToHex(tertiaryHue, Math.min(s, 65), 42)};
      --m3-sys-color-on-tertiary: #ffffff;
      --m3-sys-color-background: ${hslToHex(neutralHue, 20, 98)};
      --m3-sys-color-on-background: ${hslToHex(neutralHue, 15, 12)};
      --m3-sys-color-surface: #ffffff;
      --m3-sys-color-surface-dim: ${hslToHex(neutralHue, 15, 90)};
      --m3-sys-color-surface-bright: #ffffff;
      --m3-sys-color-surface-container-lowest: #ffffff;
      --m3-sys-color-surface-container-low: ${hslToHex(neutralHue, 20, 96)};
      --m3-sys-color-surface-container: ${hslToHex(neutralHue, 18, 93)};
      --m3-sys-color-surface-container-high: ${hslToHex(neutralHue, 16, 90)};
      --m3-sys-color-surface-container-highest: ${hslToHex(neutralHue, 16, 86)};
      --m3-sys-color-on-surface: ${hslToHex(neutralHue, 15, 14)};
      --m3-sys-color-on-surface-variant: ${hslToHex(neutralHue, 12, 38)};
      --m3-sys-color-outline: rgba(0, 0, 0, 0.12);
      --m3-sys-color-outline-variant: rgba(0, 0, 0, 0.05);
      --m3-glow-primary: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.20);
      --card-bg: #ffffff;
      --card-border: rgba(0, 0, 0, 0.06);
      --card-text: ${hslToHex(neutralHue, 15, 14)};
      --card-hover-bg: ${hslToHex(neutralHue, 18, 96)};
      --card-hover-border: ${hslToHex(primaryHue, Math.min(s, 85), 55)};
      --topbar-btn-bg: #ffffff;
      --topbar-btn-color: ${hslToHex(neutralHue, 15, 14)};
      --bg-gradient: linear-gradient(180deg, ${hslToHex(primaryHue, 35, 96)} 0%, ${hslToHex(neutralHue, 20, 94)} 100%);
    `;
  }
}

function generateThemeCss(accentColor, colorMode, bgType, bgValue) {
  let customBgCss = '';
  if (bgType === 'image' && bgValue) {
    customBgCss = `body { background-image: url('${bgValue.replace(/'/g, "\\'")}'); background-size: cover; background-position: center; }`;
  } else if (bgType === 'custom' && bgValue) {
    customBgCss = `body { background: ${bgValue}; }`;
  }

  if (colorMode === 'dark') {
    return `:root { ${generateCssVariables(accentColor, true)} } \n${customBgCss}`;
  }
  if (colorMode === 'light') {
    return `:root { ${generateCssVariables(accentColor, false)} } \n${customBgCss}`;
  }

  return `
    :root { ${generateCssVariables(accentColor, true)} }
    @media (prefers-color-scheme: light) {
      :root { ${generateCssVariables(accentColor, false)} }
    }
    ${customBgCss}
  `;
}

// -------------------------------------------------------------
// 2. SERVER-SIDE URL NORMALIZATION & ICON RESOLUTION
// -------------------------------------------------------------

const ICON_MAP = {
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

function normalizeSocialUrl(platform, rawVal) {
  if (!rawVal || typeof rawVal !== 'string') return '';
  const v = rawVal.trim();
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('mailto:') || v.startsWith('tel:') || v.startsWith('viber:')) {
    return v;
  }
  switch ((platform || '').toLowerCase()) {
    case 'email': return `mailto:${v}`;
    case 'phone': return `tel:${v}`;
    case 'whatsapp': return `https://wa.me/${v.replace(/[^0-9]/g, '')}`;
    case 'telegram': return `https://t.me/${v.replace('@', '')}`;
    case 'signal': return `https://signal.me/#p/${v}`;
    case 'zalo': return `https://zalo.me/${v.replace(/[^0-9]/g, '')}`;
    case 'github': return `https://github.com/${v.replace('@', '')}`;
    case 'x':
    case 'twitter': return `https://x.com/${v.replace('@', '')}`;
    case 'instagram': return `https://instagram.com/${v.replace('@', '')}`;
    case 'threads': return `https://threads.net/@${v.replace('@', '')}`;
    case 'tiktok': return `https://tiktok.com/@${v.replace('@', '')}`;
    case 'youtube': return `https://youtube.com/${v.startsWith('@') ? v : '@' + v}`;
    case 'facebook': return `https://facebook.com/${v}`;
    case 'linkedin': return `https://linkedin.com/in/${v.replace('@', '')}`;
    case 'discord': return v.startsWith('invite/') ? `https://discord.gg/${v.replace('invite/', '')}` : `https://discord.gg/${v}`;
    default: return `https://${v}`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function maskAccountNumber(acc) {
  if (!acc) return '';
  const s = String(acc).trim();
  if (s.length <= 4) return s;
  if (s.length <= 6) return s.slice(0, 2) + '••••' + s.slice(-2);
  const startLen = s.length >= 9 ? 4 : 3;
  const endLen = 3;
  const maskLen = Math.max(s.length - startLen - endLen, 3);
  return s.slice(0, startLen) + '•'.repeat(maskLen) + s.slice(-endLen);
}

// -------------------------------------------------------------
// 3. SERVER-SIDE TEMPLATE RENDERER
// -------------------------------------------------------------

async function renderPublicBioPage() {
  // Check Redis SSR Cache
  const cachedHtml = await getCache('bio:ssr_html');
  if (cachedHtml) {
    return { html: cachedHtml, fromCache: true };
  }

  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get() || {};
  const links = db.prepare('SELECT * FROM links WHERE enabled = 1 ORDER BY display_order ASC, id ASC').all() || [];
  const socials = db.prepare('SELECT * FROM social_links WHERE enabled = 1 ORDER BY display_order ASC, id ASC').all() || [];

  const displayName = escapeHtml(profile.name || '');
  const rawHandle = profile.handle || '@username';
  const handleFormatted = escapeHtml(rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`);
  const initial = rawHandle.replace('@', '').trim().charAt(0).toUpperCase() || 'U';
  const bioText = escapeHtml(profile.bio || profile.tagline || '');
  const customFooterText = escapeHtml(profile.footer_text || '');
  const seoTitle = escapeHtml(profile.seo_title || `${displayName || handleFormatted} | Bio Page`);
  const seoDesc = escapeHtml(profile.seo_description || 'Personal links, contact details, and portfolio');

  // Avatar Area (uses id for client-side error handling instead of inline onerror attribute)
  let avatarHtml = '';
  if (profile.avatar_url && profile.avatar_url.trim()) {
    avatarHtml = `<img src="${escapeHtml(profile.avatar_url.trim())}" alt="${handleFormatted}" class="avatar-image" id="profile-avatar-img">`;
  } else {
    avatarHtml = `<div class="avatar-fallback">${initial}</div>`;
  }

  // Direct Contact & Social Links Bar
  const renderedPlatforms = new Set();
  let contactPillsHtml = '';

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
      const normalizedUrl = normalizeSocialUrl(c.key, c.val);
      contactPillsHtml += `
        <a href="${escapeHtml(normalizedUrl)}" target="_blank" rel="noopener noreferrer" class="contact-icon-pill m3-ripple-surface" title="${c.label}: ${escapeHtml(c.val)}" aria-label="${c.label}">
          <i class="${c.icon}"></i>
        </a>
      `;
    }
  });

  socials.forEach(s => {
    const platKey = (s.platform || 'custom').toLowerCase();
    if (s.url && s.url.trim() && !renderedPlatforms.has(platKey)) {
      renderedPlatforms.add(platKey);
      const normalizedUrl = normalizeSocialUrl(platKey, s.url);
      const iconClass = s.icon || ICON_MAP[platKey] || 'fas fa-globe';
      const label = platKey.charAt(0).toUpperCase() + platKey.slice(1);
      contactPillsHtml += `
        <a href="${escapeHtml(normalizedUrl)}" target="_blank" rel="noopener noreferrer" class="contact-icon-pill m3-ripple-surface" title="${label}: ${escapeHtml(s.url)}" aria-label="${label}">
          <i class="${escapeHtml(iconClass)}"></i>
        </a>
      `;
    }
  });

  // Custom Link Cards
  let linkCardsHtml = '';
  links.forEach((link, idx) => {
    let iconClass = link.icon;
    let isEmoji = false;
    if (!iconClass || !iconClass.trim()) {
      const lower = link.title.toLowerCase().trim();
      iconClass = ICON_MAP[lower] || 'fas fa-globe';
    } else if (!iconClass.startsWith('fa') && !iconClass.includes(' ')) {
      isEmoji = true;
    }

    const iconHtml = isEmoji ? `<span>${escapeHtml(iconClass)}</span>` : `<i class="${escapeHtml(iconClass)}"></i>`;
    const safeUrl = escapeHtml(link.url);
    const safeTitle = escapeHtml(link.title);
    const safeDesc = link.description ? `<div class="card-subtitle-area">${escapeHtml(link.description)}</div>` : '';
    const isHighlighted = link.is_highlighted ? 'highlighted' : '';

    linkCardsHtml += `
      <div class="bio-link-card m3-ripple-surface ${isHighlighted}" style="animation: m3Enter 0.5s var(--m3-motion-spring-expressive) ${idx * 60}ms forwards;" data-link-id="${link.id}" data-url="${safeUrl}" data-title="${safeTitle}">
        <div class="card-icon-area">${iconHtml}</div>
        <div class="card-title-area">
          <div class="card-main-title">${safeTitle}</div>
          ${safeDesc}
        </div>
        <div class="card-action-dots" title="Options" aria-label="Link options">
          <i class="fas fa-ellipsis-vertical"></i>
        </div>
        <div class="card-context-menu">
          <button class="ctx-menu-item btn-ctx-copy" data-url="${safeUrl}">
            <i class="fas fa-copy"></i> <span>Copy link</span>
          </button>
          <button class="ctx-menu-item btn-ctx-share" data-url="${safeUrl}" data-title="${safeTitle}">
            <i class="fas fa-share"></i> <span>Share link</span>
          </button>
        </div>
      </div>
    `;
  });

  // -------------------------------------------------------------
  // Donation Dropdown Section
  // -------------------------------------------------------------
  let donationSectionHtml = '';
  const isDonationEnabled = profile.donations_enabled !== 0;
  const isVietqrEnabled = isDonationEnabled && profile.donation_vietqr_enabled !== 0 && !!(profile.donation_vietqr_acc && profile.donation_vietqr_acc.trim());
  const isPaypalEnabled = isDonationEnabled && profile.donation_paypal_enabled !== 0 && !!(profile.donation_paypal_username && profile.donation_paypal_username.trim());
  const isMomoEnabled = isDonationEnabled && profile.donation_momo_enabled !== 0 && !!((profile.donation_momo_url && profile.donation_momo_url.trim()) || (profile.donation_momo_title && profile.donation_momo_title.trim()));

  if (isDonationEnabled && (isVietqrEnabled || isPaypalEnabled || isMomoEnabled)) {
    const defaultMethod = isVietqrEnabled ? 'vietqr' : (isPaypalEnabled ? 'paypal' : 'momo');
    const bankCode = (profile.donation_vietqr_bank || 'MB').toUpperCase();
    const bankObj = bankMap.get(bankCode);
    const bankDisplay = bankObj ? `${bankObj.short_name} (${bankObj.code})` : bankCode;

    const rawPaypalAmounts = (profile.donation_paypal_amounts || '5,10,25,50')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const paypalAmounts = rawPaypalAmounts.length > 0 ? rawPaypalAmounts : ['5', '10', '25', '50'];
    const initialPaypalAmt = paypalAmounts.includes('25') ? '25' : (paypalAmounts[0] || '25');

    const vietqrInitialUrl = `https://vietqr.app/img?acc=${encodeURIComponent(profile.donation_vietqr_acc || '')}&bank=${encodeURIComponent(profile.donation_vietqr_bank || 'MB')}&amount=0&des=${encodeURIComponent(profile.donation_vietqr_default_des || 'Donate')}&template=${encodeURIComponent(profile.donation_vietqr_template || 'compact')}${profile.donation_vietqr_holder ? '&holder=' + encodeURIComponent(profile.donation_vietqr_holder) : ''}`;

    let momoUrl = (profile.donation_momo_url || '').trim();
    if (momoUrl && !momoUrl.startsWith('http://') && !momoUrl.startsWith('https://')) {
      momoUrl = 'https://' + momoUrl;
    }

    const shouldMaskAcc = !!profile.donation_vietqr_mask_acc;
    const rawAcc = (profile.donation_vietqr_acc || '').trim();
    const maskedAcc = shouldMaskAcc ? maskAccountNumber(rawAcc) : rawAcc;

    donationSectionHtml = `
      <!-- Donation Drop-down Section -->
      <section class="bio-donation-section" aria-label="Support and Donations">
        <div class="bio-donation-card" id="bio-donation-card">
          <button class="bio-donation-toggle m3-ripple-surface" id="btn-donation-toggle" type="button" aria-expanded="false" aria-controls="donation-accordion-content">
            <div class="donation-toggle-left">
              <div class="donation-toggle-icon">
                <i class="fas fa-hand-holding-dollar"></i>
              </div>
              <div class="donation-toggle-info">
                <div class="donation-toggle-title">${escapeHtml(profile.donation_title || 'Support & Donations')}</div>
                <div class="donation-toggle-desc">${escapeHtml(profile.donation_desc || 'Tip or donate via VietQR, PayPal, or MoMo')}</div>
              </div>
            </div>
            <div class="donation-toggle-chevron">
              <i class="fas fa-chevron-down" id="donation-chevron-icon"></i>
            </div>
          </button>

          <div class="donation-accordion-content" id="donation-accordion-content">
            <div class="donation-content-inner">
              <!-- Method Switcher Tabs -->
              <div class="donation-methods-tabs" role="tablist">
                ${isVietqrEnabled ? `
                  <button type="button" class="donation-tab-btn ${defaultMethod === 'vietqr' ? 'active' : ''}" data-target="vietqr" role="tab" aria-selected="${defaultMethod === 'vietqr'}">
                    <i class="fas fa-qrcode"></i> <span>VietQR</span>
                  </button>
                ` : ''}
                ${isPaypalEnabled ? `
                  <button type="button" class="donation-tab-btn ${defaultMethod === 'paypal' ? 'active' : ''}" data-target="paypal" role="tab" aria-selected="${defaultMethod === 'paypal'}">
                    <i class="fab fa-paypal"></i> <span>PayPal</span>
                  </button>
                ` : ''}
                ${isMomoEnabled ? `
                  <button type="button" class="donation-tab-btn ${defaultMethod === 'momo' ? 'active' : ''}" data-target="momo" role="tab" aria-selected="${defaultMethod === 'momo'}">
                    <i class="fas fa-wallet"></i> <span>${escapeHtml(profile.donation_momo_title || 'MoMo')}</span>
                  </button>
                ` : ''}
              </div>

              <!-- Panels Container -->
              <div class="donation-panels-container">
                ${isVietqrEnabled ? `
                  <div class="donation-panel ${defaultMethod === 'vietqr' ? 'active' : ''}" id="panel-donation-vietqr" role="tabpanel"
                       data-bank="${escapeHtml(profile.donation_vietqr_bank || 'MB')}"
                       data-acc="${escapeHtml(rawAcc)}"
                       data-masked-acc="${escapeHtml(maskedAcc)}"
                       data-is-masked="${shouldMaskAcc ? '1' : '0'}"
                       data-holder="${escapeHtml(profile.donation_vietqr_holder || '')}"
                       data-template="${escapeHtml(profile.donation_vietqr_template || 'compact')}"
                       data-default-des="${escapeHtml(profile.donation_vietqr_default_des || 'Donate')}">
                    
                    <div class="vietqr-layout">
                      <div class="vietqr-qr-container">
                        <div class="vietqr-img-wrapper" id="vietqr-img-box">
                          <img id="vietqr-live-img"
                               src="${vietqrInitialUrl}"
                               alt="VietQR Payment Code"
                               class="vietqr-image"
                               loading="lazy">
                        </div>
                        <div class="vietqr-quick-actions">
                          <button type="button" class="btn-qr-action m3-ripple-surface" id="btn-copy-acc" data-acc="${escapeHtml(rawAcc)}" title="Copy full account number">
                            <i class="fas fa-copy"></i> <span>Copy Acc</span>
                          </button>
                          <button type="button" class="btn-qr-action m3-ripple-surface" id="btn-copy-all-vietqr" title="Copy all transfer details">
                            <i class="fas fa-file-invoice"></i> <span>Copy Details</span>
                          </button>
                        </div>
                      </div>

                      <div class="vietqr-controls-container">
                        <div class="bank-details-card">
                          <div class="bank-detail-row">
                            <span class="detail-label">Bank:</span>
                            <span class="detail-val font-semibold" id="display-vietqr-bank">${escapeHtml(bankDisplay)}</span>
                          </div>
                          <div class="bank-detail-row">
                            <span class="detail-label">Account No:</span>
                            <span class="detail-val font-mono font-semibold" id="display-vietqr-acc-box">
                              <span id="vietqr-acc-num-text">${escapeHtml(maskedAcc)}</span>
                              ${shouldMaskAcc ? `
                                <button type="button" class="btn-toggle-mask-acc" id="btn-toggle-mask-acc" title="Show / Hide account number" aria-label="Show or hide account number">
                                  <i class="fas fa-eye" id="icon-mask-acc"></i>
                                </button>
                              ` : ''}
                            </span>
                          </div>
                          ${profile.donation_vietqr_holder ? `
                          <div class="bank-detail-row">
                            <span class="detail-label">Holder:</span>
                            <span class="detail-val uppercase font-semibold" id="display-vietqr-holder">${escapeHtml(profile.donation_vietqr_holder)}</span>
                          </div>` : ''}
                        </div>

                        <div class="vietqr-input-group">
                          <label class="vietqr-field-label">Amount (VND):</label>
                          <div class="quick-amounts-bar" id="vietqr-quick-amounts">
                            <button type="button" class="amount-chip" data-amount="10000">10,000 VND</button>
                            <button type="button" class="amount-chip" data-amount="20000">20,000 VND</button>
                            <button type="button" class="amount-chip" data-amount="50000">50,000 VND</button>
                            <button type="button" class="amount-chip" data-amount="100000">100,000 VND</button>
                            <button type="button" class="amount-chip" data-amount="200000">200,000 VND</button>
                          </div>
                          <div class="custom-amount-wrapper">
                            <input type="number" id="input-vietqr-amount" class="donation-input" placeholder="Enter custom amount (VND)" min="0" step="1000">
                            <span class="input-currency-badge">VND</span>
                          </div>
                        </div>

                        <div class="vietqr-input-group">
                          <label class="vietqr-field-label" for="input-vietqr-msg">Transfer Note / Message:</label>
                          <input type="text" id="input-vietqr-msg" class="donation-input" value="${escapeHtml(profile.donation_vietqr_default_des || 'Donate')}" placeholder="Message or your name" maxlength="100">
                        </div>
                      </div>
                    </div>
                  </div>
                ` : ''}

                ${isPaypalEnabled ? `
                  <div class="donation-panel ${defaultMethod === 'paypal' ? 'active' : ''}" id="panel-donation-paypal" role="tabpanel"
                       data-paypal-user="${escapeHtml(profile.donation_paypal_username || '')}"
                       data-paypal-currency="${escapeHtml(profile.donation_paypal_currency || 'USD')}">
                    
                    <div class="paypal-container">
                      <div class="paypal-header-info">
                        <div class="paypal-icon-badge">
                          <i class="fab fa-paypal"></i>
                        </div>
                        <div class="paypal-recipient-info">
                          <div class="paypal-recipient-label">Send via PayPal to:</div>
                          <div class="paypal-recipient-tag">paypal.me/${escapeHtml(profile.donation_paypal_username)}</div>
                        </div>
                      </div>

                      <div class="paypal-amounts-section">
                        <label class="vietqr-field-label">Choose or enter amount (${escapeHtml(profile.donation_paypal_currency || 'USD')}):</label>
                        <div class="quick-amounts-bar" id="paypal-quick-amounts">
                          ${paypalAmounts.map((amt) => {
                            const isInitial = amt === initialPaypalAmt;
                            return `<button type="button" class="amount-chip ${isInitial ? 'active' : ''}" data-amount="${escapeHtml(amt)}">${escapeHtml(amt)} ${escapeHtml(profile.donation_paypal_currency || 'USD')}</button>`;
                          }).join('')}
                        </div>

                        <div class="custom-amount-wrapper">
                          <input type="number" id="input-paypal-custom" class="donation-input" placeholder="Custom amount" min="1" step="any" value="${escapeHtml(initialPaypalAmt)}">
                          <span class="input-currency-badge">${escapeHtml(profile.donation_paypal_currency || 'USD')}</span>
                        </div>
                      </div>

                      <div class="paypal-action-row">
                        <a id="btn-paypal-checkout"
                           href="https://paypal.me/${encodeURIComponent(profile.donation_paypal_username)}/${encodeURIComponent(initialPaypalAmt)}${encodeURIComponent(profile.donation_paypal_currency || 'USD')}"
                           target="_blank"
                           rel="noopener noreferrer"
                           class="btn-paypal-main m3-ripple-surface">
                          <i class="fab fa-paypal"></i>
                          <span id="paypal-btn-text">Send ${escapeHtml(initialPaypalAmt)} ${escapeHtml(profile.donation_paypal_currency || 'USD')} via PayPal</span>
                        </a>
                        <button type="button" class="btn-paypal-copy m3-ripple-surface" id="btn-copy-paypal" title="Copy PayPal Link">
                          <i class="fas fa-copy"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ` : ''}

                ${isMomoEnabled ? `
                  <div class="donation-panel ${defaultMethod === 'momo' ? 'active' : ''}" id="panel-donation-momo" role="tabpanel">
                    <div class="momo-container">
                      ${momoUrl ? `
                        <a href="${escapeHtml(momoUrl)}" target="_blank" rel="noopener noreferrer" class="momo-header-card m3-ripple-surface" title="Open ${escapeHtml(profile.donation_momo_title || 'MoMo')}">
                          <div class="momo-icon-badge">
                            <i class="fas fa-wallet"></i>
                          </div>
                          <div class="momo-title-info">
                            <div class="momo-title-text">${escapeHtml(profile.donation_momo_title || 'MoMo')}</div>
                            <div class="momo-desc-text">${escapeHtml(profile.donation_momo_desc || 'Scan or transfer via MoMo')}</div>
                          </div>
                          <div class="momo-arrow-icon">
                            <i class="fas fa-arrow-up-right-from-square"></i>
                          </div>
                        </a>
                      ` : `
                        <div class="momo-header-info">
                          <div class="momo-icon-badge">
                            <i class="fas fa-wallet"></i>
                          </div>
                          <div class="momo-title-info">
                            <div class="momo-title-text">${escapeHtml(profile.donation_momo_title || 'MoMo')}</div>
                            <div class="momo-desc-text">${escapeHtml(profile.donation_momo_desc || 'Scan or transfer via MoMo')}</div>
                          </div>
                        </div>
                      `}

                      <div class="momo-action-row">
                        ${momoUrl ? `
                          <a href="${escapeHtml(momoUrl)}" target="_blank" rel="noopener noreferrer" class="btn-momo-main m3-ripple-surface">
                            <i class="fas fa-arrow-up-right-from-square"></i> <span>Open ${escapeHtml(profile.donation_momo_title || 'MoMo')}</span>
                          </a>
                          <button type="button" class="btn-momo-copy m3-ripple-surface" id="btn-copy-momo" data-val="${escapeHtml(momoUrl)}" title="Copy Link">
                            <i class="fas fa-copy"></i> <span>Copy Link</span>
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // Final Compiled HTML (External stylesheet only, Zero inline styles, Zero inline scripts)
  const compiledHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${seoTitle}</title>
  <meta name="description" content="${seoDesc}">
  <meta property="og:title" content="${seoTitle}">
  <meta property="og:description" content="${seoDesc}">
  <meta property="og:type" content="website">
  
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>✨</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/api/theme.css">
</head>
<body>
  <div class="bg-blob-1"></div>

  <main class="bio-wrapper">
    <!-- Top Action Nav -->
    <nav class="topbar-nav" aria-label="Page controls">
      <a href="/login.html" class="topbar-icon-btn m3-ripple-surface" title="Admin Dashboard" aria-label="Admin Dashboard">
        <i class="fas fa-asterisk"></i>
      </a>
      <button class="topbar-icon-btn m3-ripple-surface" id="btn-share" title="Share profile" aria-label="Share profile">
        <i class="fas fa-arrow-up-from-bracket"></i>
      </button>
    </nav>

    <!-- Profile Header -->
    <section class="profile-center">
      <div class="avatar-circle-wrapper" id="avatar-container">
        ${avatarHtml}
      </div>
      
      ${displayName ? `<h1 class="profile-display-name">${displayName}</h1>` : ''}
      <div class="profile-username">${handleFormatted}</div>
      
      <!-- Direct Contact Details -->
      <div class="contact-details-bar">
        ${contactPillsHtml}
      </div>

      ${bioText ? `<div class="profile-bio-text">${bioText}</div>` : ''}
    </section>

    <!-- Links List -->
    <section class="links-list-container" aria-label="Custom and Social links">
      ${linkCardsHtml}
    </section>

    ${donationSectionHtml}

    <!-- Footer -->
    <footer class="bio-page-footer">
      ${customFooterText ? `<p class="bio-custom-footer">${customFooterText}</p>` : ''}
      <p class="bio-permanent-footer">
        Build with <a href="https://github.com/tudeptrai1712/bio-page" target="_blank" rel="noopener noreferrer" class="permanent-footer-link"><i class="fab fa-github"></i> tudeptrai1712/bio-page</a>
      </p>
    </footer>
  </main>

  <!-- M3 Floating Toast Notification -->
  <div class="bio-toast" id="toast-msg">
    <i class="fas fa-check-circle" style="color: var(--m3-sys-color-primary);"></i>
    <span id="toast-text-content">Link copied to clipboard!</span>
  </div>

  <script src="/js/main.js"></script>
</body>
</html>`;

  // Save SSR HTML in Redis for 10 minutes
  await setCache('bio:ssr_html', compiledHtml, 600);

  return { html: compiledHtml, fromCache: false };
}

module.exports = {
  generateThemeCss,
  renderPublicBioPage
};
