// UI Dock, Header Bar, Engine Badges, and Version Update Manager
import { AppState } from '../state.js';
import { toggleWebXR, enterVR, enterAR, toggleFullscreen } from '../scene.js';
import { unlockAudio } from '../audio/index.js';

let latestDetectedVersion = null;

export function initDock({ onSendPrompt, onToggleLiveMode, onToggleMic, onTurnAvatar, appVersion, onShowGPUAlert, onOpenSettings }) {
  const dom = {
    promptInput: document.getElementById('prompt-input'),
    btnSend: document.getElementById('btn-send'),
    btnMic: document.getElementById('btn-mic'),
    btnLiveMode: document.getElementById('btn-live-mode'),
    btnTurnAvatar: document.getElementById('btn-turn-avatar'),
    btnVr: document.getElementById('btn-vr'),
    vrLabel: document.getElementById('vr-label'),
    btnAr: document.getElementById('btn-ar'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
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

  // Turn Avatar 180° Button
  if (dom.btnTurnAvatar) {
    dom.btnTurnAvatar.onclick = () => {
      unlockAudio();
      if (onTurnAvatar) onTurnAvatar();
    };
  }

  // Meta Quest 3 Full 360° VR Immersion (Synchronous gesture invocation)
  if (dom.btnVr) {
    dom.btnVr.onclick = () => {
      unlockAudio();
      enterVR((isVR) => {
        if (dom.vrLabel) dom.vrLabel.textContent = isVR ? 'Exit VR' : '360° VR';
      }).catch((err) => {
        console.warn('WebXR VR entry rejected:', err);
      });
    };
  }

  // Meta Quest 3 Mixed Reality Passthrough (Synchronous gesture invocation)
  if (dom.btnAr) {
    dom.btnAr.onclick = () => {
      unlockAudio();
      enterAR((isAR) => {
        if (dom.xrLabel) dom.xrLabel.textContent = isAR ? 'Exit AR' : 'AR';
      }).catch((err) => {
        console.warn('WebXR AR entry rejected:', err);
      });
    };
  }

  // Fullscreen 2D Window Expansion
  if (dom.btnFullscreen) {
    dom.btnFullscreen.onclick = () => {
      toggleFullscreen();
    };
  }

  // WebXR Toggle (Legacy fallback)
  if (dom.btnXr) {
    dom.btnXr.onclick = async () => {
      unlockAudio();
      try {
        await toggleWebXR((isXR) => {
          if (dom.xrLabel) dom.xrLabel.textContent = isXR ? 'Exit XR' : 'VR';
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
  if (dom.engineBadge) {
    dom.engineBadge.style.cursor = 'pointer';
    dom.engineBadge.title = 'Click to configure or view AI Engine status';
    dom.engineBadge.onclick = () => {
      unlockAudio();
      if (AppState.engine === 'local' && AppState.modelStatusText === 'WebGPU unavailable' && onShowGPUAlert) {
        onShowGPUAlert();
      } else if (onOpenSettings) {
        onOpenSettings();
      }
    };
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
        if (AppState.modelStatusText === 'WebGPU unavailable') {
          dom.engineBadge.textContent = isSmallScreen ? '⚠️ WebGPU' : '⚠️ WebGPU Off (Use Gemini)';
          dom.engineBadge.style.color = '#f59e0b';
          dom.engineBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        } else if (isSmallScreen) {
          dom.engineBadge.textContent = isReady ? '🏠 Qwen' : '🏠 Loading...';
          dom.engineBadge.style.color = isReady ? '#34d399' : '#f59e0b';
          dom.engineBadge.style.borderColor = isReady ? 'rgba(52, 211, 153, 0.4)' : 'rgba(245, 158, 11, 0.4)';
        } else {
          dom.engineBadge.textContent = isReady ? '🏠 Qwen 2.5 (Ready)' : '🏠 Qwen 2.5 (Loading...)';
          dom.engineBadge.style.color = isReady ? '#34d399' : '#f59e0b';
          dom.engineBadge.style.borderColor = isReady ? 'rgba(52, 211, 153, 0.4)' : 'rgba(245, 158, 11, 0.4)';
        }
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
