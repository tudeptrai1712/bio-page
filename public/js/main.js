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

  // Avatar image error fallback
  const avatarImg = document.getElementById('profile-avatar-img');
  if (avatarImg) {
    avatarImg.addEventListener('error', function() {
      const handle = this.getAttribute('alt') || 'U';
      const initial = handle.replace('@', '').trim().charAt(0).toUpperCase() || 'U';
      if (this.parentNode) {
        this.parentNode.innerHTML = `<div class="avatar-fallback">${initial}</div>`;
      }
    });
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

  // -------------------------------------------------------------
  // DONATION DROP-DOWN MENU CONTROLLER
  // -------------------------------------------------------------
  const donationCard = document.getElementById('bio-donation-card');
  const btnDonationToggle = document.getElementById('btn-donation-toggle');

  if (donationCard && btnDonationToggle) {
    btnDonationToggle.addEventListener('click', () => {
      const isOpen = donationCard.classList.contains('open');
      if (isOpen) {
        donationCard.classList.remove('open');
        btnDonationToggle.setAttribute('aria-expanded', 'false');
      } else {
        donationCard.classList.add('open');
        btnDonationToggle.setAttribute('aria-expanded', 'true');
      }
    });

    // Method Switcher Tabs
    const tabButtons = donationCard.querySelectorAll('.donation-tab-btn');
    const tabPanels = donationCard.querySelectorAll('.donation-panel');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        tabButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        tabPanels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const activePanel = document.getElementById(`panel-donation-${target}`);
        if (activePanel) activePanel.classList.add('active');
      });
    });

    // --- 1. VietQR Slot Controller ---
    const panelVietqr = document.getElementById('panel-donation-vietqr');
    if (panelVietqr) {
      const liveImg = document.getElementById('vietqr-live-img');
      const inputAmount = document.getElementById('input-vietqr-amount');
      const inputMsg = document.getElementById('input-vietqr-msg');
      const quickAmountChips = panelVietqr.querySelectorAll('.amount-chip');
      const btnCopyAcc = document.getElementById('btn-copy-acc');
      const btnCopyAll = document.getElementById('btn-copy-all-vietqr');

      const bank = panelVietqr.getAttribute('data-bank') || 'MB';
      const acc = panelVietqr.getAttribute('data-acc') || '';
      const holder = panelVietqr.getAttribute('data-holder') || '';
      const template = panelVietqr.getAttribute('data-template') || 'compact';

      let vietqrTimer = null;
      function updateVietqr() {
        const rawAmt = inputAmount ? inputAmount.value.trim() : '';
        const amt = parseInt(rawAmt, 10) || 0;
        const msg = inputMsg ? inputMsg.value.trim() : (panelVietqr.getAttribute('data-default-des') || 'Donate');

        let url = `https://vietqr.app/img?acc=${encodeURIComponent(acc)}&bank=${encodeURIComponent(bank)}&amount=${amt}&des=${encodeURIComponent(msg)}&template=${encodeURIComponent(template)}`;
        if (holder) {
          url += `&holder=${encodeURIComponent(holder)}`;
        }
        if (liveImg) {
          liveImg.src = url;
        }
      }

      function debounceUpdateVietqr() {
        clearTimeout(vietqrTimer);
        vietqrTimer = setTimeout(updateVietqr, 350);
      }

      if (quickAmountChips) {
        quickAmountChips.forEach(chip => {
          chip.addEventListener('click', () => {
            const amt = chip.getAttribute('data-amount');
            quickAmountChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            if (inputAmount) inputAmount.value = amt;
            updateVietqr();
          });
        });
      }

      if (inputAmount) {
        inputAmount.addEventListener('input', () => {
          const val = inputAmount.value.trim();
          quickAmountChips.forEach(c => {
            if (c.getAttribute('data-amount') === val) {
              c.classList.add('active');
            } else {
              c.classList.remove('active');
            }
          });
          debounceUpdateVietqr();
        });
      }

      if (inputMsg) {
        inputMsg.addEventListener('input', debounceUpdateVietqr);
      }

      if (btnCopyAcc) {
        btnCopyAcc.addEventListener('click', () => {
          const accNum = btnCopyAcc.getAttribute('data-acc') || acc;
          navigator.clipboard.writeText(accNum).then(() => {
            showToast('Đã sao chép số tài khoản! 📋');
          });
        });
      }

      if (btnCopyAll) {
        btnCopyAll.addEventListener('click', () => {
          const rawAmt = inputAmount ? inputAmount.value.trim() : '';
          const amt = parseInt(rawAmt, 10) || 0;
          const msg = inputMsg ? inputMsg.value.trim() : '';
          const bankDisplay = document.getElementById('display-vietqr-bank')?.textContent || bank;
          let text = `Ngân hàng: ${bankDisplay}\nSố tài khoản: ${acc}`;
          if (holder) text += `\nChủ tài khoản: ${holder}`;
          if (amt > 0) text += `\nSố tiền: ${amt.toLocaleString('vi-VN')} VNĐ`;
          if (msg) text += `\nNội dung: ${msg}`;

          navigator.clipboard.writeText(text).then(() => {
            showToast('Đã sao chép thông tin chuyển khoản! 📋');
          });
        });
      }
    }

    // --- 2. PayPal Slot Controller ---
    const panelPaypal = document.getElementById('panel-donation-paypal');
    if (panelPaypal) {
      const paypalUser = panelPaypal.getAttribute('data-paypal-user') || '';
      const paypalCurrency = panelPaypal.getAttribute('data-paypal-currency') || 'USD';
      const inputPaypalCustom = document.getElementById('input-paypal-custom');
      const paypalChips = panelPaypal.querySelectorAll('.amount-chip');
      const btnPaypalCheckout = document.getElementById('btn-paypal-checkout');
      const paypalBtnText = document.getElementById('paypal-btn-text');
      const btnCopyPaypal = document.getElementById('btn-copy-paypal');

      function updatePaypal(amount) {
        const cleanAmt = String(amount || '').trim();
        let targetUrl = `https://paypal.me/${encodeURIComponent(paypalUser)}`;
        let btnLabel = `Donate via PayPal`;

        if (cleanAmt && parseFloat(cleanAmt) > 0) {
          targetUrl += `/${encodeURIComponent(cleanAmt)}${encodeURIComponent(paypalCurrency)}`;
          btnLabel = `Send ${cleanAmt} ${paypalCurrency} via PayPal`;
        }

        if (btnPaypalCheckout) {
          btnPaypalCheckout.href = targetUrl;
        }
        if (paypalBtnText) {
          paypalBtnText.textContent = btnLabel;
        }
      }

      if (paypalChips) {
        paypalChips.forEach(chip => {
          chip.addEventListener('click', () => {
            const amt = chip.getAttribute('data-amount');
            paypalChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            if (inputPaypalCustom) inputPaypalCustom.value = amt;
            updatePaypal(amt);
          });
        });
      }

      if (inputPaypalCustom) {
        inputPaypalCustom.addEventListener('input', () => {
          const val = inputPaypalCustom.value.trim();
          paypalChips.forEach(c => {
            if (c.getAttribute('data-amount') === val) {
              c.classList.add('active');
            } else {
              c.classList.remove('active');
            }
          });
          updatePaypal(val);
        });
      }

      if (btnCopyPaypal) {
        btnCopyPaypal.addEventListener('click', () => {
          const currentUrl = btnPaypalCheckout ? btnPaypalCheckout.href : `https://paypal.me/${paypalUser}`;
          navigator.clipboard.writeText(currentUrl).then(() => {
            showToast('PayPal link copied to clipboard! 📋');
          });
        });
      }
    }

    // --- 3. MoMo / Fixed Slot Controller ---
    const panelMomo = document.getElementById('panel-donation-momo');
    if (panelMomo) {
      const btnCopyMomo = document.getElementById('btn-copy-momo');
      if (btnCopyMomo) {
        btnCopyMomo.addEventListener('click', () => {
          const val = btnCopyMomo.getAttribute('data-val') || document.getElementById('momo-target-val')?.textContent || '';
          if (val) {
            navigator.clipboard.writeText(val).then(() => {
              showToast('Đã sao chép thông tin MoMo! 📋');
            });
          }
        });
      }
    }
  }

  // Material 3 Ripple Motion Effect
  document.addEventListener('click', (e) => {
    const target = e.target.closest('.m3-ripple-surface, .topbar-icon-btn, .btn, .bio-link-card, .contact-icon-pill');
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const circle = document.createElement('span');
    const diameter = Math.max(target.clientWidth, target.clientHeight) * 1.5;
    const radius = diameter / 2;

    circle.style.position = 'absolute';
    circle.style.pointerEvents = 'none';
    circle.style.borderRadius = '50%';
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
