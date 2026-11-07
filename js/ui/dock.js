// UI Dock, Header Bar, Engine Badges, and Version Update Manager
import { AppState } from '../state.js';
import { toggleWebXR } from '../scene.js';
import { unlockAudio } from '../audio/index.js';

let latestDetectedVersion = null;

export function initDock({ onSendPrompt, onToggleLiveMode, onToggleMic, appVersion }) {
  const dom = {
    promptInput: document.getElementById('prompt-input'),
    btnSend: document.getElementById('btn-send'),
    btnMic: document.getElementById('btn-mic'),
    btnLiveMode: document.getElementById('btn-live-mode'),
    btnXr: document.getElementById('btn-xr'),
    xrLabel: document.getElementById('xr-label'),
    engineBadge: document.getElementById('engine-badge'),
    updateBanner: document.getElementById('update-banner'),
    updateText: document.getElementById('update-text'),
    btnReloadUpdate: document.getElementById('btn-reload-update'),
    versionBadge: document.getElementById('app-version-badge')
  };

  // Text Prompt Send
  if (dom.btnSend && dom.promptInput) {
    dom.btnSend.onclick = () => {
      unlockAudio();
      const val = dom.promptInput.value.trim();
      if (val && onSendPrompt) onSendPrompt(val);
    };

    dom.promptInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        unlockAudio();
        const val = dom.promptInput.value.trim();
        if (val && onSendPrompt) onSendPrompt(val);
      }
    };
  }

  // Suggestion Chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => {
      unlockAudio();
      if (onSendPrompt) onSendPrompt(chip.dataset.query);
    };
  });

  // Mic Button (Push-to-Talk)
  if (dom.btnMic) {
    dom.btnMic.onclick = () => {
      unlockAudio();
      if (onToggleMic) onToggleMic();
    };
  }

  // Live Mode Button
  if (dom.btnLiveMode) {
    dom.btnLiveMode.onclick = () => {
      unlockAudio();
      if (onToggleLiveMode) onToggleLiveMode();
    };
  }

  // WebXR Toggle
  if (dom.btnXr) {
    dom.btnXr.onclick = async () => {
      unlockAudio();
      try {
        await toggleWebXR((isXR) => {
          if (dom.xrLabel) dom.xrLabel.textContent = isXR ? 'Exit XR' : 'AR';
        });
      } catch (err) {
        alert(err.message || 'WebXR error');
      }
    };
  }

  // Version Check & Live Update (Preserves WebLLM local model weights cache)
  function forceAppRefresh(targetVersion) {
    if ('caches' in window) {
      try {
        caches.keys().then(names => {
          // Explicitly preserve WebLLM / MLC AI model weight caches so users don't redownload models on updates
          const nonModelCaches = names.filter(n => {
            const lower = n.toLowerCase();
            return !lower.includes('webllm') && !lower.includes('mlc') && !lower.includes('model') && !lower.includes('weight');
          });
          Promise.all(nonModelCaches.map(name => caches.delete(name))).catch(() => {});
        });
      } catch (e) {}
    }
    const v = targetVersion || appVersion;
    window.location.href = window.location.origin + window.location.pathname + '?v=' + v;
  }

  async function checkAppVersion(manual = false) {
    try {
      const res = await fetch(`version.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.version && data.version !== appVersion) {
        latestDetectedVersion = data.version;
        if (dom.updateText) dom.updateText.textContent = `🚀 New update available (${data.version})!`;
        if (dom.updateBanner) dom.updateBanner.style.display = 'flex';
      } else {
        if (dom.updateBanner) dom.updateBanner.style.display = 'none';
        if (manual) {
          alert(`You are on the latest version (${appVersion})!`);
        }
      }
    } catch (e) {}
  }

  if (dom.btnReloadUpdate) {
    dom.btnReloadUpdate.onclick = () => forceAppRefresh(latestDetectedVersion);
  }
  if (dom.versionBadge) {
    dom.versionBadge.onclick = () => checkAppVersion(true);
  }

  checkAppVersion();
  setInterval(checkAppVersion, 30000);

  return {
    updateEngineBadge() {
      if (!dom.engineBadge) return;
      const isSmallScreen = window.innerWidth <= 540;
      if (AppState.engine === 'cloud') {
        if (AppState.geminiStatus === 'online') {
          dom.engineBadge.textContent = isSmallScreen ? '☁️ Gemini' : '☁️ Gemini 2.5 (Online)';
          dom.engineBadge.style.color = '#38bdf8';
          dom.engineBadge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
        } else {
          dom.engineBadge.textContent = isSmallScreen ? '⚠️ Offline' : '⚠️ Gemini (Offline)';
          dom.engineBadge.style.color = '#ef4444';
          dom.engineBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        }
      } else {
        const isReady = AppState.isModelReady;
        if (isSmallScreen) {
          dom.engineBadge.textContent = isReady ? '🏠 Qwen' : '🏠 Loading...';
        } else {
          dom.engineBadge.textContent = isReady ? '🏠 Qwen 2.5 (Ready)' : '🏠 Qwen 2.5 (Loading...)';
        }
        dom.engineBadge.style.color = isReady ? '#34d399' : '#f59e0b';
        dom.engineBadge.style.borderColor = isReady ? 'rgba(52, 211, 153, 0.4)' : 'rgba(245, 158, 11, 0.4)';
      }
    },

    updateLiveModeUI() {
      if (!dom.btnLiveMode) return;
      const isSmallScreen = window.innerWidth <= 540;
      const label = isSmallScreen ? '⚡ Live' : '⚡ Live Mode';
      if (AppState.isLiveMode) {
        dom.btnLiveMode.classList.add('active');
        dom.btnLiveMode.innerHTML = `<span class="live-pulse-dot"></span> <span>${label}: ON</span>`;
      } else {
        dom.btnLiveMode.classList.remove('active');
        dom.btnLiveMode.innerHTML = `<span class="live-pulse-dot"></span> <span>${label}: OFF</span>`;
      }
    }
  };
}
