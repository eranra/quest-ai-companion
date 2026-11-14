// Universal Floating Tooltip System for Interactive UI Controls
let tooltipEl = null;
let showTimeout = null;

export function initTooltips() {
  if (typeof document === 'undefined') return;

  tooltipEl = document.getElementById('floating-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'floating-tooltip';
    tooltipEl.className = 'floating-tooltip';
    document.body.appendChild(tooltipEl);
  }

  // Pre-seed known tooltips for elements
  const DEFAULT_TOOLTIPS = {
    'btn-live-mode': '⚡ Live Mode: Hands-free continuous speech. Speak anytime to converse.',
    'btn-vr': '🥽 360° VR: Enter full WebXR immersive 360° VR on Meta Quest 3.',
    'btn-spaces': '🏛️ 3D Spaces: Switch between Grand Study Hall, Zen Garden, Penthouse, Cafe, and Passthrough.',
    'btn-ambient-music': '🎵 Ambient Music: Calming generative soundscapes, volume slider & automotive playlist.',
    'btn-avatars': '👤 Avatars: Choose 3D companion avatar (Maya, Alex, Echo, Spark, Pip, Ollie).',
    'btn-turn-avatar': '🔄 Turn Avatar: Rotate avatar 180° to face front or back.',
    'btn-focus-mode': '🧘 Pure Immersive View: Enjoy unobstructed 360° environment with avatar hidden.',
    'btn-fullscreen': '⛶ Fullscreen: Expand 2D window to fill the entire screen.',
    'btn-settings': '⚙️ Settings: Configure AI engine, model catalog, voice parameters & diagnostics.',
    'btn-mic': '🎙️ Talk / Push-to-Talk: Click to speak, or interrupt while companion is speaking.',
    'btn-send': '📤 Send: Submit prompt to AI companion.',
    'btn-speech-bubble-toggle': '💬 Subtitles: Minimize or expand conversation bubble.',
    'select-avatar-gesture': '🎭 Gestures: Choose an animation (Wave, Dance, Balance, Cheer, Bow, Think, Clap, Jump) or Walk.',
    'btn-motion-freestyle': '🎲 Freestyle: Toggle autonomous companion movement & periodic gestures.',
    'app-version-badge': '🚀 Version & Updates: View version info and check for app updates.',
    'engine-badge': '⚡ Engine: Current active AI inference model and execution backend.'
  };

  function registerTooltips() {
    const targets = document.querySelectorAll('button, .icon-btn, .btn-live, select, .chip, .version-pill, .engine-badge, [title], [data-tooltip]');
    targets.forEach(el => {
      let text = el.getAttribute('data-tooltip') || el.getAttribute('title');
      if (!text && el.id && DEFAULT_TOOLTIPS[el.id]) {
        text = DEFAULT_TOOLTIPS[el.id];
      }
      if (!text) return;

      el.setAttribute('data-floating-tooltip', text);
      if (el.hasAttribute('title')) {
        el.removeAttribute('title');
      }

      el.addEventListener('mouseenter', () => showTooltip(el, text));
      el.addEventListener('mouseleave', hideTooltip);
      el.addEventListener('click', hideTooltip);
      el.addEventListener('focus', () => showTooltip(el, text));
      el.addEventListener('blur', hideTooltip);
    });
  }

  function showTooltip(el, text) {
    if (showTimeout) clearTimeout(showTimeout);
    showTimeout = setTimeout(() => {
      if (!tooltipEl) return;
      tooltipEl.textContent = text;
      tooltipEl.classList.add('visible');

      const rect = el.getBoundingClientRect();
      const tipRect = tooltipEl.getBoundingClientRect();

      let top = rect.top - tipRect.height - 8;
      let left = rect.left + (rect.width / 2) - (tipRect.width / 2);

      // Boundary clamping: if too close to top, show below
      if (top < 10) {
        top = rect.bottom + 8;
      }
      // Clamping horizontally
      if (left < 10) left = 10;
      if (left + tipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tipRect.width - 10;
      }

      tooltipEl.style.top = `${Math.round(top)}px`;
      tooltipEl.style.left = `${Math.round(left)}px`;
    }, 120);
  }

  function hideTooltip() {
    if (showTimeout) clearTimeout(showTimeout);
    if (tooltipEl) {
      tooltipEl.classList.remove('visible');
    }
  }

  registerTooltips();
  window.addEventListener('resize', hideTooltip);
  window.addEventListener('scroll', hideTooltip, true);
}
