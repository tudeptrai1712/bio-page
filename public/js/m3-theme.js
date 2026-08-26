/**
 * Material 3 Expressive Dynamic Color Engine & Motion Physics System
 * Inspired by Android Dynamic Color (Monet) & Material 3 Expressive Motion
 */

(function(window) {
  // Convert HEX to RGB
  function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  // Convert RGB to HSL
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
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

  // Convert HSL to HEX
  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const rgb = [f(0), f(8), f(4)].map(x => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    });
    return `#${rgb.join('')}`;
  }

  // Generate Harmonized Tonal Palette (M3 Expressive / Android Dynamic Color)
  function generateTonalTokens(seedHex, isDark = true) {
    let rgb = hexToRgb(seedHex || '#818cf8');
    if (!rgb || isNaN(rgb.r)) rgb = { r: 129, g: 140, b: 248 };
    const { h, s } = rgbToHsl(rgb.r, rgb.g, rgb.b);

    const primaryHue = h;
    const secondaryHue = (h + 30) % 360;
    const tertiaryHue = (h + 300) % 360;
    const neutralHue = h;

    if (isDark) {
      // Dark Mode Tonal Map
      return {
        '--m3-sys-color-primary': hslToHex(primaryHue, Math.min(s, 85), 75),
        '--m3-sys-color-on-primary': hslToHex(primaryHue, Math.min(s, 90), 18),
        '--m3-sys-color-primary-container': hslToHex(primaryHue, Math.min(s, 75), 30),
        '--m3-sys-color-on-primary-container': hslToHex(primaryHue, Math.min(s, 95), 88),

        '--m3-sys-color-secondary': hslToHex(secondaryHue, Math.min(s, 65), 72),
        '--m3-sys-color-on-secondary': hslToHex(secondaryHue, Math.min(s, 80), 18),
        '--m3-sys-color-secondary-container': hslToHex(secondaryHue, Math.min(s, 60), 28),
        '--m3-sys-color-on-secondary-container': hslToHex(secondaryHue, Math.min(s, 85), 86),

        '--m3-sys-color-tertiary': hslToHex(tertiaryHue, Math.min(s, 70), 75),
        '--m3-sys-color-on-tertiary': hslToHex(tertiaryHue, Math.min(s, 80), 20),

        '--m3-sys-color-background': hslToHex(neutralHue, 18, 7),
        '--m3-sys-color-on-background': hslToHex(neutralHue, 12, 93),

        '--m3-sys-color-surface': hslToHex(neutralHue, 16, 10),
        '--m3-sys-color-surface-dim': hslToHex(neutralHue, 18, 6),
        '--m3-sys-color-surface-bright': hslToHex(neutralHue, 14, 18),

        '--m3-sys-color-surface-container-lowest': hslToHex(neutralHue, 20, 5),
        '--m3-sys-color-surface-container-low': hslToHex(neutralHue, 16, 9),
        '--m3-sys-color-surface-container': hslToHex(neutralHue, 14, 13),
        '--m3-sys-color-surface-container-high': hslToHex(neutralHue, 14, 17),
        '--m3-sys-color-surface-container-highest': hslToHex(neutralHue, 14, 22),

        '--m3-sys-color-on-surface': hslToHex(neutralHue, 10, 92),
        '--m3-sys-color-on-surface-variant': hslToHex(neutralHue, 12, 70),
        '--m3-sys-color-outline': `rgba(255, 255, 255, 0.12)`,
        '--m3-sys-color-outline-variant': `rgba(255, 255, 255, 0.06)`,
        '--m3-glow-primary': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`,

        // Layout compatibility variables
        '--card-bg': hslToHex(neutralHue, 14, 14),
        '--card-border': `rgba(255, 255, 255, 0.08)`,
        '--card-text': hslToHex(neutralHue, 10, 94),
        '--card-hover-bg': hslToHex(neutralHue, 14, 18),
        '--card-hover-border': hslToHex(primaryHue, Math.min(s, 85), 65),
        '--topbar-btn-bg': hslToHex(neutralHue, 14, 16),
        '--topbar-btn-color': hslToHex(neutralHue, 10, 95),
        '--bg-gradient': `radial-gradient(circle at 50% 0%, ${hslToHex(primaryHue, 40, 16)} 0%, ${hslToHex(neutralHue, 18, 7)} 80%)`
      };
    } else {
      // Light Mode Tonal Map
      return {
        '--m3-sys-color-primary': hslToHex(primaryHue, Math.min(s, 85), 45),
        '--m3-sys-color-on-primary': '#ffffff',
        '--m3-sys-color-primary-container': hslToHex(primaryHue, Math.min(s, 90), 92),
        '--m3-sys-color-on-primary-container': hslToHex(primaryHue, Math.min(s, 95), 18),

        '--m3-sys-color-secondary': hslToHex(secondaryHue, Math.min(s, 60), 40),
        '--m3-sys-color-on-secondary': '#ffffff',
        '--m3-sys-color-secondary-container': hslToHex(secondaryHue, Math.min(s, 70), 90),
        '--m3-sys-color-on-secondary-container': hslToHex(secondaryHue, Math.min(s, 90), 16),

        '--m3-sys-color-tertiary': hslToHex(tertiaryHue, Math.min(s, 65), 42),
        '--m3-sys-color-on-tertiary': '#ffffff',

        '--m3-sys-color-background': hslToHex(neutralHue, 20, 98),
        '--m3-sys-color-on-background': hslToHex(neutralHue, 15, 12),

        '--m3-sys-color-surface': '#ffffff',
        '--m3-sys-color-surface-dim': hslToHex(neutralHue, 15, 90),
        '--m3-sys-color-surface-bright': '#ffffff',

        '--m3-sys-color-surface-container-lowest': '#ffffff',
        '--m3-sys-color-surface-container-low': hslToHex(neutralHue, 20, 96),
        '--m3-sys-color-surface-container': hslToHex(neutralHue, 18, 93),
        '--m3-sys-color-surface-container-high': hslToHex(neutralHue, 16, 90),
        '--m3-sys-color-surface-container-highest': hslToHex(neutralHue, 16, 86),

        '--m3-sys-color-on-surface': hslToHex(neutralHue, 15, 14),
        '--m3-sys-color-on-surface-variant': hslToHex(neutralHue, 12, 38),
        '--m3-sys-color-outline': `rgba(0, 0, 0, 0.12)`,
        '--m3-sys-color-outline-variant': `rgba(0, 0, 0, 0.05)`,
        '--m3-glow-primary': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.20)`,

        // Layout compatibility variables
        '--card-bg': '#ffffff',
        '--card-border': `rgba(0, 0, 0, 0.06)`,
        '--card-text': hslToHex(neutralHue, 15, 14),
        '--card-hover-bg': hslToHex(neutralHue, 18, 96),
        '--card-hover-border': hslToHex(primaryHue, Math.min(s, 85), 55),
        '--topbar-btn-bg': '#ffffff',
        '--topbar-btn-color': hslToHex(neutralHue, 15, 14),
        '--bg-gradient': `linear-gradient(180deg, ${hslToHex(primaryHue, 35, 96)} 0%, ${hslToHex(neutralHue, 20, 94)} 100%)`
      };
    }
  }

  // Active theme state
  let currentSeed = '#818cf8';
  let currentMode = 'auto'; // 'auto' | 'dark' | 'light'

  function getEffectiveIsDark() {
    if (currentMode === 'dark') return true;
    if (currentMode === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function applyDynamicTokens(seedHex, mode = 'auto') {
    currentSeed = seedHex || currentSeed;
    currentMode = mode || currentMode;

    const isDark = getEffectiveIsDark();
    const tokens = generateTonalTokens(currentSeed, isDark);

    const root = document.documentElement;
    for (const [key, value] of Object.entries(tokens)) {
      root.style.setProperty(key, value);
    }

    document.body.setAttribute('data-color-mode', isDark ? 'dark' : 'light');
  }

  // Listen to OS Dark / Light mode change in real-time
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentMode === 'auto') {
        applyDynamicTokens(currentSeed, 'auto');
      }
    });
  }

  // ==========================================================================
  // MATERIAL 3 MOTION PHYSICS ENGINE (Interactive State Layers & Elastic Springs)
  // ==========================================================================

  function initMotionPhysics() {
    // 1. Fluid Dynamic Ripple (Coordinates-based state layer)
    document.addEventListener('click', (e) => {
      const target = e.target.closest('.m3-ripple-surface, .m3-action-btn, .topbar-icon-btn, .btn, .bio-link-card, .btn-icon-preset');
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
  }

  // Export to global namespace
  window.M3Theme = {
    applyDynamicTokens,
    generateTonalTokens,
    initMotionPhysics,
    getEffectiveIsDark: () => getEffectiveIsDark()
  };

  // Auto initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    initMotionPhysics();
  });

})(window);

