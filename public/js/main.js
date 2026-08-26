/**
 * Pure Client-Side Interaction & Event Controller
 * The server processes all data, URL normalization, Monet color tokens, and SSR HTML.
 * The client strictly handles interactive UI state layers, ripples, and user events.
 */

document.addEventListener('DOMContentLoaded', () => {
  const toastMsg = document.getElementById('toast-msg');
  const toastTextContent = document.getElementById('toast-text-content');
  const btnShare = document.getElementById('btn-share');

  // Floating Toast Notification
  function showToast(text) {
    if (toastTextContent) toastTextContent.textContent = text;
    if (toastMsg) {
      toastMsg.classList.add('show');
      setTimeout(() => toastMsg.classList.remove('show'), 2500);
    }
  }

  // Close context menus when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.card-action-dots') && !e.target.closest('.card-context-menu')) {
      document.querySelectorAll('.card-context-menu.open').forEach(menu => menu.classList.remove('open'));
    }
  });

  // Track page view analytics on load
  fetch('/api/analytics/view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referrer: document.referrer })
  }).catch(() => {});

  // Topbar Share Button
  if (btnShare) {
    btnShare.addEventListener('click', async (e) => {
      e.stopPropagation();
      const shareUrl = window.location.href;
      const shareTitle = document.title || 'Bio Page';

      if (navigator.share && window.isSecureContext) {
        try {
          await navigator.share({ title: shareTitle, url: shareUrl });
          return;
        } catch (err) {}
      }

      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Profile link copied to clipboard! 📋');
      }).catch(() => {
        showToast('Link: ' + shareUrl);
      });
    });
  }

  // Link Cards Click & Context Menu Handlers
  document.querySelectorAll('.bio-link-card').forEach(card => {
    const linkId = card.getAttribute('data-link-id');
    const destUrl = card.getAttribute('data-url');
    const title = card.getAttribute('data-title');
    const dotsBtn = card.querySelector('.card-action-dots');
    const menu = card.querySelector('.card-context-menu');
    const copyBtn = card.querySelector('.btn-ctx-copy');
    const shareBtn = card.querySelector('.btn-ctx-share');

    // Context menu toggle
    if (dotsBtn && menu) {
      dotsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const isOpen = menu.classList.contains('open');
        document.querySelectorAll('.card-context-menu.open').forEach(m => m.classList.remove('open'));
        if (!isOpen) menu.classList.add('open');
      });
    }

    // Context menu: Copy link
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (menu) menu.classList.remove('open');
        navigator.clipboard.writeText(destUrl).then(() => {
          showToast('Link copied to clipboard! 📋');
        });
      });
    }

    // Context menu: Share link
    if (shareBtn) {
      shareBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (menu) menu.classList.remove('open');
        if (navigator.share && window.isSecureContext) {
          try {
            await navigator.share({ title, url: destUrl });
            return;
          } catch (err) {}
        }
        navigator.clipboard.writeText(destUrl).then(() => {
          showToast('Link copied to clipboard! 📋');
        });
      });
    }

    // Card click: Track analytics and navigate
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-dots') || e.target.closest('.card-context-menu')) {
        return;
      }
      if (linkId) {
        fetch(`/api/analytics/click/${linkId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referrer: document.referrer })
        }).catch(() => {});
      }
      window.open(destUrl, '_blank', 'noopener,noreferrer');
    });
  });

  // Material 3 Ripple Motion Effect
  document.addEventListener('click', (e) => {
    const target = e.target.closest('.m3-ripple-surface, .topbar-icon-btn, .btn, .bio-link-card, .contact-icon-pill');
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const circle = document.createElement('span');
    const diameter = Math.max(target.clientWidth, target.clientHeight) * 1.5;
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.classList.add('m3-ripple-layer');

    const prev = target.querySelector('.m3-ripple-layer');
    if (prev) prev.remove();

    target.appendChild(circle);
    setTimeout(() => circle.remove(), 650);
  });
});
