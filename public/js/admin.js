document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  try {
    const meRes = await fetch('/api/auth/me');
    if (!meRes.ok) {
      window.location.href = '/login.html';
      return;
    }
    const meData = await meRes.json();
    if (meData.user) {
      document.getElementById('current-username').textContent = meData.user.username;
      document.getElementById('current-user-avatar').textContent = meData.user.username.charAt(0).toUpperCase();
    }
  } catch (err) {
    window.location.href = '/login.html';
    return;
  }

  // Common UI elements
  const toast = document.getElementById('admin-toast');
  const toastText = document.getElementById('toast-text');
  const tabHeading = document.getElementById('tab-heading');
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  function showToast(message, isError = false) {
    toastText.textContent = message;
    if (isError) {
      toast.style.borderColor = '#ef4444';
      toast.querySelector('i').className = 'fas fa-circle-xmark text-danger';
    } else {
      toast.style.borderColor = '#6366f1';
      toast.querySelector('i').className = 'fas fa-circle-check text-success';
    }
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // Tab switching
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      navItems.forEach(n => n.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const targetPane = document.getElementById(`tab-${tabId}`);
      if (targetPane) targetPane.classList.add('active');

      const titleMap = {
        links: 'Custom Links',
        profile: 'Profile Details',
        socials: 'Social Links',
        appearance: 'Appearance & Themes',
        analytics: 'Analytics & Insights',
        settings: 'Account & Passkeys'
      };
      tabHeading.textContent = titleMap[tabId] || 'Dashboard';

      if (tabId === 'analytics') loadAnalytics();
      if (tabId === 'settings') loadPasskeys();
    });
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  // -------------------------------------------------------------
  // 1. LINKS MANAGEMENT
  // -------------------------------------------------------------
  const adminLinksList = document.getElementById('admin-links-list');
  const modalLink = document.getElementById('modal-link');
  const modalLinkTitle = document.getElementById('modal-link-title');
  const formLinkModal = document.getElementById('form-link-modal');
  const modalLinkId = document.getElementById('modal-link-id');
  const modalLinkTitleInput = document.getElementById('modal-link-title-input');
  const modalLinkUrlInput = document.getElementById('modal-link-url-input');
  const modalLinkDescInput = document.getElementById('modal-link-desc-input');
  const modalLinkIconInput = document.getElementById('modal-link-icon-input');
  const modalLinkHighlightInput = document.getElementById('modal-link-highlight-input');

  let currentLinks = [];

  async function loadLinks() {
    try {
      const res = await fetch('/api/admin/links');
      if (!res.ok) throw new Error('Failed to load links');
      currentLinks = await res.json();
      renderLinks();
    } catch (err) {
      adminLinksList.innerHTML = '<p style="color: #ef4444;">Failed to load links.</p>';
    }
  }

  function renderLinks() {
    if (!currentLinks || currentLinks.length === 0) {
      adminLinksList.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <i class="fas fa-link-slash" style="font-size: 2.5rem; margin-bottom: 12px; display: block;"></i>
          <p>No links found. Click "Add New Link" above to get started!</p>
        </div>
      `;
      return;
    }

    adminLinksList.innerHTML = '';
    currentLinks.forEach((link, index) => {
      const row = document.createElement('div');
      row.className = 'link-item-row';
      row.dataset.id = link.id;

      let iconDisplay = link.icon || '🔗';
      if (iconDisplay.startsWith('fa')) {
        iconDisplay = `<i class="${iconDisplay}"></i>`;
      }

      row.innerHTML = `
        <div class="link-order-controls">
          <button class="btn-order btn-move-up" title="Move Up" ${index === 0 ? 'disabled style="opacity:0.3;cursor:default;"' : ''}><i class="fas fa-chevron-up"></i></button>
          <button class="btn-order btn-move-down" title="Move Down" ${index === currentLinks.length - 1 ? 'disabled style="opacity:0.3;cursor:default;"' : ''}><i class="fas fa-chevron-down"></i></button>
        </div>

        <div style="font-size: 1.3rem; width: 32px; text-align: center;">${iconDisplay}</div>

        <div class="link-item-info">
          <div class="link-item-title">
            <span>${escapeHtml(link.title)}</span>
            ${link.is_highlighted ? '<span style="color: #f59e0b; font-size: 0.75rem;"><i class="fas fa-star"></i> Featured</span>' : ''}
          </div>
          <div class="link-item-url">${escapeHtml(link.url)}</div>
        </div>

        <div class="badge-clicks" title="Total clicks">
          <i class="fas fa-arrow-pointer"></i> ${link.clicks || 0}
        </div>

        <div class="link-item-actions">
          <label class="switch" title="Toggle active/hidden">
            <input type="checkbox" class="toggle-link-enabled" ${link.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>

          <button class="btn btn-secondary btn-edit-link" style="padding: 8px 12px;" title="Edit Link">
            <i class="fas fa-pen-to-square"></i>
          </button>
          <button class="btn btn-danger btn-delete-link" style="padding: 8px 12px;" title="Delete Link">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;

      row.querySelector('.btn-move-up').addEventListener('click', () => moveLink(index, -1));
      row.querySelector('.btn-move-down').addEventListener('click', () => moveLink(index, 1));
      row.querySelector('.toggle-link-enabled').addEventListener('change', async (e) => {
        await updateLink(link.id, { enabled: e.target.checked });
      });
      row.querySelector('.btn-edit-link').addEventListener('click', () => openEditLinkModal(link));
      row.querySelector('.btn-delete-link').addEventListener('click', () => deleteLink(link.id, link.title));

      adminLinksList.appendChild(row);
    });
  }

  async function moveLink(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentLinks.length) return;

    const temp = currentLinks[index];
    currentLinks[index] = currentLinks[newIndex];
    currentLinks[newIndex] = temp;

    renderLinks();

    const orderIds = currentLinks.map(l => l.id);
    try {
      await fetch('/api/admin/links/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderIds })
      });
      showToast('Links reordered');
    } catch (err) {
      showToast('Failed to save order', true);
    }
  }

  const modalIconPreview = document.getElementById('modal-icon-preview');

  function updateModalIconPreview(val) {
    if (!modalIconPreview) return;
    const str = (val || '').trim();
    if (!str) {
      modalIconPreview.innerHTML = '<i class="fas fa-globe"></i>';
    } else if (str.startsWith('fa') || str.includes(' fa-')) {
      modalIconPreview.innerHTML = `<i class="${str}"></i>`;
    } else {
      modalIconPreview.innerHTML = `<span>${str}</span>`;
    }
  }

  if (modalLinkIconInput) {
    modalLinkIconInput.addEventListener('input', (e) => {
      updateModalIconPreview(e.target.value);
    });
  }

  // Quick icon presets
  document.querySelectorAll('.btn-icon-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const icon = btn.getAttribute('data-icon');
      const title = btn.getAttribute('data-title');
      if (modalLinkIconInput) {
        modalLinkIconInput.value = icon;
        updateModalIconPreview(icon);
      }
      if (modalLinkTitleInput && !modalLinkTitleInput.value.trim()) {
        modalLinkTitleInput.value = title;
      }
    });
  });

  // Modal open / close
  document.getElementById('btn-open-add-link').addEventListener('click', () => {
    modalLinkId.value = '';
    modalLinkTitle.textContent = 'Add New Link';
    modalLinkTitleInput.value = '';
    modalLinkUrlInput.value = '';
    modalLinkDescInput.value = '';
    modalLinkIconInput.value = 'fas fa-globe';
    updateModalIconPreview('fas fa-globe');
    modalLinkHighlightInput.checked = false;
    modalLink.classList.add('show');
  });

  function openEditLinkModal(link) {
    modalLinkId.value = link.id;
    modalLinkTitle.textContent = 'Edit Link';
    modalLinkTitleInput.value = link.title;
    modalLinkUrlInput.value = link.url;
    modalLinkDescInput.value = link.description || '';
    modalLinkIconInput.value = link.icon || 'fas fa-globe';
    updateModalIconPreview(link.icon || 'fas fa-globe');
    modalLinkHighlightInput.checked = !!link.is_highlighted;
    modalLink.classList.add('show');
  }

  function closeLinkModal() {
    modalLink.classList.remove('show');
  }

  document.getElementById('btn-close-link-modal').addEventListener('click', closeLinkModal);
  document.getElementById('btn-cancel-link-modal').addEventListener('click', closeLinkModal);

  formLinkModal.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = modalLinkId.value;
    const payload = {
      title: modalLinkTitleInput.value.trim(),
      url: modalLinkUrlInput.value.trim(),
      description: modalLinkDescInput.value.trim(),
      icon: modalLinkIconInput.value.trim() || '🔗',
      is_highlighted: modalLinkHighlightInput.checked
    };

    try {
      if (id) {
        await fetch(`/api/admin/links/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        showToast('Link updated successfully');
      } else {
        await fetch('/api/admin/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        showToast('New link added');
      }
      closeLinkModal();
      loadLinks();
    } catch (err) {
      showToast('Failed to save link', true);
    }
  });

  async function updateLink(id, payload) {
    try {
      await fetch(`/api/admin/links/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Updated link');
    } catch (err) {
      showToast('Failed to update link', true);
    }
  }

  async function deleteLink(id, title) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await fetch(`/api/admin/links/${id}`, { method: 'DELETE' });
      showToast('Link deleted');
      loadLinks();
    } catch (err) {
      showToast('Failed to delete link', true);
    }
  }

  // -------------------------------------------------------------
  // 2. PROFILE MANAGEMENT
  // -------------------------------------------------------------
  const profileNameInput = document.getElementById('profile-name-input');
  const profileHandleInput = document.getElementById('profile-handle-input');
  const profileTaglineInput = document.getElementById('profile-tagline-input');
  const profileBioInput = document.getElementById('profile-bio-input');
  const contactEmailInput = document.getElementById('contact-email-input');
  const contactPhoneInput = document.getElementById('contact-phone-input');
  const contactWhatsappInput = document.getElementById('contact-whatsapp-input');
  const contactTelegramInput = document.getElementById('contact-telegram-input');
  const contactSignalInput = document.getElementById('contact-signal-input');
  const contactZaloInput = document.getElementById('contact-zalo-input');
  const profileAvatarUrlInput = document.getElementById('profile-avatar-url-input');
  const profileFooterInput = document.getElementById('profile-footer-input');
  const seoTitleInput = document.getElementById('seo-title-input');
  const seoDescInput = document.getElementById('seo-desc-input');
  const avatarPreview = document.getElementById('profile-avatar-preview');
  const avatarFileInput = document.getElementById('avatar-file-input');

  let currentProfile = {};

  async function loadProfile() {
    try {
      const res = await fetch('/api/admin/profile');
      if (!res.ok) throw new Error('Failed to fetch profile');
      currentProfile = await res.json();

      profileNameInput.value = currentProfile.name || '';
      profileHandleInput.value = currentProfile.handle || '';
      if (profileTaglineInput) profileTaglineInput.value = currentProfile.tagline || '';
      profileBioInput.value = currentProfile.bio || '';
      
      if (contactEmailInput) contactEmailInput.value = currentProfile.contact_email || '';
      if (contactPhoneInput) contactPhoneInput.value = currentProfile.contact_phone || '';
      if (contactWhatsappInput) contactWhatsappInput.value = currentProfile.contact_whatsapp || '';
      if (contactTelegramInput) contactTelegramInput.value = currentProfile.contact_telegram || '';
      if (contactSignalInput) contactSignalInput.value = currentProfile.contact_signal || '';
      if (contactZaloInput) contactZaloInput.value = currentProfile.contact_zalo || '';

      profileAvatarUrlInput.value = currentProfile.avatar_url || '';
      profileFooterInput.value = currentProfile.footer_text || '';
      seoTitleInput.value = currentProfile.seo_title || '';
      seoDescInput.value = currentProfile.seo_description || '';

      updateAvatarPreview(currentProfile.avatar_url);

      selectThemeCard(currentProfile.theme || 'classic-gray');
      selectModeBtn(currentProfile.color_mode || 'auto');
      document.getElementById('accent-color-picker').value = currentProfile.accent_color || '#818cf8';
      document.getElementById('accent-color-input').value = currentProfile.accent_color || '#818cf8';
      document.getElementById('bg-type-select').value = currentProfile.background_type || 'preset';
      document.getElementById('bg-value-input').value = currentProfile.background_value || '';
      toggleBgValueField(currentProfile.background_type);

      if (window.M3Theme) {
        window.M3Theme.applyDynamicTokens(currentProfile.accent_color || '#818cf8', currentProfile.color_mode || 'auto');
      }

    } catch (err) {
      showToast('Error loading profile settings', true);
    }
  }

  function updateAvatarPreview(url) {
    if (url && url.trim()) {
      avatarPreview.src = url;
      avatarPreview.style.display = 'block';
    } else {
      avatarPreview.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👤</text></svg>';
    }
  }

  profileAvatarUrlInput.addEventListener('input', (e) => {
    updateAvatarPreview(e.target.value.trim());
  });

  avatarFileInput.addEventListener('change', async () => {
    if (!avatarFileInput.files || !avatarFileInput.files[0]) return;
    const file = avatarFileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      showToast('Uploading image...');
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.fileUrl) {
        profileAvatarUrlInput.value = data.fileUrl;
        updateAvatarPreview(data.fileUrl);
        showToast('Image uploaded successfully! Remember to save profile.');
      } else {
        showToast(data.error || 'Upload failed', true);
      }
    } catch (err) {
      showToast('Upload error', true);
    }
  });

  document.getElementById('btn-save-profile').addEventListener('click', async () => {
    const payload = {
      ...currentProfile,
      name: profileNameInput.value.trim(),
      handle: profileHandleInput.value.trim(),
      tagline: profileTaglineInput ? profileTaglineInput.value.trim() : '',
      bio: profileBioInput.value.trim(),
      contact_email: contactEmailInput ? contactEmailInput.value.trim() : '',
      contact_phone: contactPhoneInput ? contactPhoneInput.value.trim() : '',
      contact_whatsapp: contactWhatsappInput ? contactWhatsappInput.value.trim() : '',
      contact_telegram: contactTelegramInput ? contactTelegramInput.value.trim() : '',
      contact_signal: contactSignalInput ? contactSignalInput.value.trim() : '',
      contact_zalo: contactZaloInput ? contactZaloInput.value.trim() : '',
      avatar_url: profileAvatarUrlInput.value.trim(),
      footer_text: profileFooterInput.value.trim(),
      seo_title: seoTitleInput.value.trim(),
      seo_description: seoDescInput.value.trim()
    };

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        currentProfile = payload;
        showToast('Profile & Contact details saved! ✨');
      } else {
        showToast('Failed to save profile', true);
      }
    } catch (err) {
      showToast('Connection error', true);
    }
  });

  // -------------------------------------------------------------
  // 3. SOCIAL LINKS MANAGEMENT
  // -------------------------------------------------------------
  const popularPlatforms = [
    { key: 'telegram', label: 'Telegram', icon: 'fab fa-telegram', placeholder: 'https://t.me/username' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'fab fa-whatsapp', placeholder: 'https://wa.me/1234567890' },
    { key: 'signal', label: 'Signal', icon: 'fas fa-comment-dots', placeholder: 'https://signal.me/#p/+1234567890' },
    { key: 'zalo', label: 'Zalo', icon: 'fas fa-message', placeholder: 'https://zalo.me/username' },
    { key: 'github', label: 'GitHub', icon: 'fab fa-github', placeholder: 'https://github.com/username' },
    { key: 'x', label: 'X / Twitter', icon: 'fab fa-x-twitter', placeholder: 'https://x.com/username' },
    { key: 'facebook', label: 'Facebook', icon: 'fab fa-facebook-f', placeholder: 'https://facebook.com/username' },
    { key: 'instagram', label: 'Instagram', icon: 'fab fa-instagram', placeholder: 'https://instagram.com/username' },
    { key: 'threads', label: 'Threads', icon: 'fab fa-threads', placeholder: 'https://threads.net/@username' },
    { key: 'tiktok', label: 'TikTok', icon: 'fab fa-tiktok', placeholder: 'https://tiktok.com/@username' },
    { key: 'youtube', label: 'YouTube', icon: 'fab fa-youtube', placeholder: 'https://youtube.com/@channel' },
    { key: 'linkedin', label: 'LinkedIn', icon: 'fab fa-linkedin', placeholder: 'https://linkedin.com/in/username' },
    { key: 'discord', label: 'Discord', icon: 'fab fa-discord', placeholder: 'https://discord.gg/invite' },
    { key: 'spotify', label: 'Spotify', icon: 'fab fa-spotify', placeholder: 'https://open.spotify.com/user/...' },
    { key: 'twitch', label: 'Twitch', icon: 'fab fa-twitch', placeholder: 'https://twitch.tv/username' },
    { key: 'reddit', label: 'Reddit', icon: 'fab fa-reddit', placeholder: 'https://reddit.com/user/username' },
    { key: 'snapchat', label: 'Snapchat', icon: 'fab fa-snapchat', placeholder: 'https://snapchat.com/add/username' },
    { key: 'pinterest', label: 'Pinterest', icon: 'fab fa-pinterest', placeholder: 'https://pinterest.com/username' },
    { key: 'viber', label: 'Viber', icon: 'fab fa-viber', placeholder: 'viber://chat?number=...' },
    { key: 'medium', label: 'Medium', icon: 'fab fa-medium', placeholder: 'https://medium.com/@username' },
    { key: 'patreon', label: 'Patreon', icon: 'fab fa-patreon', placeholder: 'https://patreon.com/creator' },
    { key: 'email', label: 'Email', icon: 'fas fa-envelope', placeholder: 'mailto:you@example.com' },
    { key: 'website', label: 'Personal Website', icon: 'fas fa-globe', placeholder: 'https://yourwebsite.com' }
  ];

  const socialInputsContainer = document.getElementById('social-inputs-container');

  async function loadSocials() {
    try {
      const res = await fetch('/api/admin/socials');
      const existingSocials = await res.json();

      const map = {};
      (existingSocials || []).forEach(s => {
        map[s.platform.toLowerCase()] = s.url;
      });

      socialInputsContainer.innerHTML = '';
      popularPlatforms.forEach(p => {
        const val = map[p.key] || '';
        const group = document.createElement('div');
        group.className = 'form-group';
        group.innerHTML = `
          <label class="form-label">
            <i class="${p.icon}" style="margin-right: 6px;"></i> ${p.label}
          </label>
          <input type="text" class="form-control social-field" data-platform="${p.key}" data-icon="${p.icon}" value="${escapeHtml(val)}" placeholder="${p.placeholder}">
        `;
        socialInputsContainer.appendChild(group);
      });
    } catch (err) {
      showToast('Error loading social links', true);
    }
  }

  document.getElementById('btn-save-socials').addEventListener('click', async () => {
    const fields = document.querySelectorAll('.social-field');
    const socialsArray = [];

    fields.forEach(f => {
      const url = f.value.trim();
      if (url) {
        socialsArray.push({
          platform: f.getAttribute('data-platform'),
          icon: f.getAttribute('data-icon'),
          url: url,
          enabled: 1
        });
      }
    });

    try {
      const res = await fetch('/api/admin/socials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socials: socialsArray })
      });
      if (res.ok) {
        showToast('Social profiles updated! 🌐');
      } else {
        showToast('Failed to save social links', true);
      }
    } catch (err) {
      showToast('Connection error', true);
    }
  });

  // -------------------------------------------------------------
  // 4. APPEARANCE & THEMES
  // -------------------------------------------------------------
  const themeCards = document.querySelectorAll('.theme-card');
  const accentPicker = document.getElementById('accent-color-picker');
  const accentInput = document.getElementById('accent-color-input');
  const bgTypeSelect = document.getElementById('bg-type-select');
  const bgValueGroup = document.getElementById('bg-value-group');
  const bgValueInput = document.getElementById('bg-value-input');

  let selectedTheme = 'midnight';
  let selectedMode = 'auto';

  function selectModeBtn(mode) {
    selectedMode = mode || 'auto';
    document.querySelectorAll('.btn-mode-select').forEach(b => {
      if (b.getAttribute('data-mode') === selectedMode) {
        b.classList.add('active');
        b.classList.remove('btn-secondary');
        b.classList.add('btn-primary');
      } else {
        b.classList.remove('active');
        b.classList.add('btn-secondary');
        b.classList.remove('btn-primary');
      }
    });
    if (window.M3Theme) {
      window.M3Theme.applyDynamicTokens(accentInput.value.trim() || '#818cf8', selectedMode);
    }
  }

  document.querySelectorAll('.btn-mode-select').forEach(btn => {
    btn.addEventListener('click', () => {
      selectModeBtn(btn.getAttribute('data-mode'));
    });
  });

  function selectThemeCard(themeId, accent) {
    selectedTheme = themeId;
    themeCards.forEach(c => {
      if (c.getAttribute('data-theme-id') === themeId) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
    if (accent) {
      accentPicker.value = accent;
      accentInput.value = accent;
      if (window.M3Theme) {
        window.M3Theme.applyDynamicTokens(accent, selectedMode);
      }
    }
  }

  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      const themeId = card.getAttribute('data-theme-id');
      const accent = card.getAttribute('data-accent');
      selectThemeCard(themeId, accent);
    });
  });

  accentPicker.addEventListener('input', (e) => {
    accentInput.value = e.target.value;
    if (window.M3Theme) {
      window.M3Theme.applyDynamicTokens(e.target.value, selectedMode);
    }
  });

  accentInput.addEventListener('input', (e) => {
    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
      accentPicker.value = e.target.value;
      if (window.M3Theme) {
        window.M3Theme.applyDynamicTokens(e.target.value, selectedMode);
      }
    }
  });

  function toggleBgValueField(type) {
    if (type === 'preset') {
      bgValueGroup.style.display = 'none';
    } else {
      bgValueGroup.style.display = 'block';
    }
  }

  bgTypeSelect.addEventListener('change', (e) => {
    toggleBgValueField(e.target.value);
  });

  document.getElementById('btn-save-appearance').addEventListener('click', async () => {
    const payload = {
      ...currentProfile,
      theme: selectedTheme,
      accent_color: accentInput.value.trim() || '#818cf8',
      color_mode: selectedMode,
      background_type: bgTypeSelect.value,
      background_value: bgValueInput.value.trim()
    };

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        currentProfile = payload;
        showToast('Dynamic appearance settings saved! 🎨✨');
      } else {
        showToast('Failed to save appearance', true);
      }
    } catch (err) {
      showToast('Connection error', true);
    }
  });

  // -------------------------------------------------------------
  // 5. ANALYTICS
  // -------------------------------------------------------------
  async function loadAnalytics() {
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to load stats');
      const stats = await res.json();

      document.getElementById('stat-total-views').textContent = (stats.totalViews || 0).toLocaleString();
      document.getElementById('stat-total-clicks').textContent = (stats.totalClicks || 0).toLocaleString();

      const ctr = stats.totalViews > 0 ? ((stats.totalClicks / stats.totalViews) * 100).toFixed(1) : 0;
      document.getElementById('stat-avg-ctr').textContent = `${ctr}%`;

      const tableContainer = document.getElementById('analytics-table-container');
      if (!stats.linkStats || stats.linkStats.length === 0) {
        tableContainer.innerHTML = '<p style="color: var(--text-muted);">No link click data yet.</p>';
        return;
      }

      let html = `
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted);">
              <th style="padding: 12px 8px;">Link Title</th>
              <th style="padding: 12px 8px;">Destination URL</th>
              <th style="padding: 12px 8px; text-align: right;">Total Clicks</th>
            </tr>
          </thead>
          <tbody>
      `;

      stats.linkStats.forEach(l => {
        html += `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
            <td style="padding: 12px 8px; font-weight: 600;">
              ${l.icon || '🔗'} ${escapeHtml(l.title)}
            </td>
            <td style="padding: 12px 8px; color: var(--text-muted); font-size: 0.85rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(l.url)}
            </td>
            <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: var(--primary);">
              ${l.clicks || 0}
            </td>
          </tr>
        `;
      });

      html += '</tbody></table>';
      tableContainer.innerHTML = html;

    } catch (err) {
      console.error('Error loading analytics:', err);
    }
  }

  // -------------------------------------------------------------
  // 6. WEBAUTHN / PASSKEY MANAGEMENT GUI
  // -------------------------------------------------------------
  const passkeysContainer = document.getElementById('passkeys-list-container');
  const btnRegisterPasskey = document.getElementById('btn-register-passkey');

  async function loadPasskeys() {
    try {
      const res = await fetch('/api/admin/authenticators');
      if (!res.ok) throw new Error('Failed to load passkeys');
      const passkeys = await res.json();

      if (!passkeys || passkeys.length === 0) {
        passkeysContainer.innerHTML = `
          <div style="text-align: center; padding: 24px; color: var(--text-muted); background: var(--bg-input); border-radius: 12px; border: 1px dashed var(--border-color);">
            <i class="fas fa-fingerprint" style="font-size: 2rem; margin-bottom: 8px; display: block; color: var(--primary);"></i>
            <p style="font-size: 0.9rem;">No Passkeys registered yet.</p>
            <small>Click <strong>"Register New Passkey"</strong> above to enable instant biometric login for Touch ID, Windows Hello, or YubiKey.</small>
          </div>
        `;
        return;
      }

      let html = `
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted);">
              <th style="padding: 12px 8px;">Device Name</th>
              <th style="padding: 12px 8px;">Registered On</th>
              <th style="padding: 12px 8px;">Last Used</th>
              <th style="padding: 12px 8px; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
      `;

      passkeys.forEach(p => {
        const createdDate = new Date(p.created_at).toLocaleDateString();
        const lastUsedDate = p.last_used_at ? new Date(p.last_used_at).toLocaleDateString() : 'Never';

        html += `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
            <td style="padding: 12px 8px; font-weight: 600;">
              <i class="fas fa-key" style="color: var(--primary); margin-right: 6px;"></i> ${escapeHtml(p.device_name)}
            </td>
            <td style="padding: 12px 8px; color: var(--text-muted); font-size: 0.85rem;">
              ${createdDate}
            </td>
            <td style="padding: 12px 8px; color: var(--text-muted); font-size: 0.85rem;">
              ${lastUsedDate}
            </td>
            <td style="padding: 12px 8px; text-align: right;">
              <button class="btn btn-danger btn-delete-passkey" data-id="${p.id}" data-name="${escapeHtml(p.device_name)}" style="padding: 6px 10px; font-size: 0.8rem;">
                <i class="fas fa-trash"></i> Revoke
              </button>
            </td>
          </tr>
        `;
      });

      html += '</tbody></table>';
      passkeysContainer.innerHTML = html;

      // Bind delete handlers
      document.querySelectorAll('.btn-delete-passkey').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          deletePasskey(id, name);
        });
      });

    } catch (err) {
      passkeysContainer.innerHTML = '<p style="color: #ef4444;">Failed to load passkeys.</p>';
    }
  }

  // Register Passkey
  btnRegisterPasskey.addEventListener('click', async () => {
    if (!window.WebAuthnClient.isSupported()) {
      showToast('WebAuthn is not supported by your browser.', true);
      return;
    }

    const deviceName = prompt('Enter a nickname for this device/key:', 'My Biometric Passkey');
    if (deviceName === null) return; // Cancelled

    try {
      showToast('Requesting biometric registration...');
      const optsRes = await fetch('/api/auth/webauthn/register-options');
      if (!optsRes.ok) throw new Error('Failed to get registration options');
      const options = await optsRes.json();

      const formattedResponse = await window.WebAuthnClient.startRegistration(options);

      const verifyRes = await fetch('/api/auth/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationResponse: formattedResponse,
          deviceName: deviceName.trim() || 'Passkey Device'
        })
      });

      const verifyData = await verifyRes.json();
      if (verifyRes.ok) {
        showToast('Passkey registered successfully! 🔑✨');
        loadPasskeys();
      } else {
        showToast(verifyData.error || 'Failed to verify passkey', true);
      }
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        showToast(err.message || 'Passkey registration failed', true);
      }
    }
  });

  async function deletePasskey(id, name) {
    if (!confirm(`Are you sure you want to revoke passkey "${name}"? You will no longer be able to log in with this key.`)) return;

    try {
      const res = await fetch(`/api/admin/authenticators/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Passkey revoked successfully');
        loadPasskeys();
      } else {
        showToast('Failed to revoke passkey', true);
      }
    } catch (err) {
      showToast('Connection error', true);
    }
  }

  // -------------------------------------------------------------
  // 7. ACCOUNT CREDENTIALS UPDATE
  // -------------------------------------------------------------
  const formAccount = document.getElementById('form-account');
  formAccount.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('acc-current-password').value;
    const newUsername = document.getElementById('acc-new-username').value;
    const newPassword = document.getElementById('acc-new-password').value;

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newUsername, newPassword })
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Credentials updated successfully! 🔒');
        formAccount.reset();
        if (data.username) {
          document.getElementById('current-username').textContent = data.username;
        }
      } else {
        showToast(data.error || 'Failed to update credentials', true);
      }
    } catch (err) {
      showToast('Connection error', true);
    }
  });

  // Initial Load
  loadLinks();
  loadProfile();
  loadSocials();

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
