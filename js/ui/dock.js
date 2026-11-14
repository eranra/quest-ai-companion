// UI Dock, Header Bar, Engine Badges, and Version Update Manager
import { AppState } from '../state.js';
import { toggleWebXR, enterVR, enterAR, toggleFullscreen } from '../scene.js';
import { unlockAudio } from '../audio/index.js';
import { triggerAvatarGesture, moveAvatar, setFreestyleMode, motionState } from '../avatars/rig.js';

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

  // Avatar Direct Motion & Gestures Combo Box & Buttons (Android, Mobile & Desktop)
  const gestureSelect = document.getElementById('select-avatar-gesture');
  if (gestureSelect) {
    gestureSelect.onchange = (e) => {
      unlockAudio();
      const val = e.target.value;
      if (!val) return;
      const [type, action] = val.split(':');
      if (type === 'gesture') {
        triggerAvatarGesture(action);
      } else if (type === 'move') {
        moveAvatar(action, 'walk', 0.8);
      }
      setTimeout(() => {
        gestureSelect.selectedIndex = 0;
      }, 350);
    };
  }

  document.querySelectorAll('.motion-btn').forEach(btn => {
    btn.onclick = () => {
      unlockAudio();
      if (btn.dataset.gesture) {
        triggerAvatarGesture(btn.dataset.gesture);
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 600);
      } else if (btn.dataset.move) {
        moveAvatar(btn.dataset.move, 'walk', 0.8);
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 600);
      } else if (btn.dataset.freestyle) {
        const nextState = !motionState.freestyle;
        setFreestyleMode(nextState);
        btn.textContent = nextState ? '🎲 Freestyle: ON' : '🎲 Freestyle: OFF';
        btn.classList.toggle('active', nextState);
      }
    };
  });

  // Desktop Keyboard Shortcuts (Arrow keys / WASD for locomotion, G for Wave, J for Jump)
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        moveAvatar('left', 'walk', 0.5);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        moveAvatar('right', 'walk', 0.5);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        moveAvatar('forward', 'walk', 0.5);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        moveAvatar('backward', 'walk', 0.5);
      } else if (e.key === 'j' || e.key === 'J') {
        triggerAvatarGesture('jump', 1.2);
      } else if (e.key === 'g' || e.key === 'G') {
        triggerAvatarGesture('wave', 3.0);
      }
    });
  }

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

  // Consolidated WebXR 360° VR Immersion (Synchronous gesture invocation)
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

  // Consolidated with 360° VR
  if (dom.btnAr) {
    dom.btnAr.onclick = () => {
      unlockAudio();
      enterVR((isVR) => {
        if (dom.vrLabel) dom.vrLabel.textContent = isVR ? 'Exit VR' : '360° VR';
      }).catch((err) => {
        console.warn('WebXR entry rejected:', err);
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
  async function forceAppRefresh(targetVersion) {
    if ('caches' in window) {
      try {
        const names = await caches.keys();
        // Explicitly preserve WebLLM, Transformers.js, ONNX, and Piper VITS voice caches so users don't redownload models on updates
        const nonModelCaches = names.filter(n => {
          const lower = n.toLowerCase();
          return !lower.includes('webllm') && 
                 !lower.includes('mlc') && 
                 !lower.includes('model') && 
                 !lower.includes('weight') && 
                 !lower.includes('transformers') && 
                 !lower.includes('huggingface') && 
                 !lower.includes('vits') && 
                 !lower.includes('onnx');
        });
        await Promise.all(nonModelCaches.map(name => caches.delete(name)));
      } catch (e) {}
    }
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      } catch (e) {}
    }
    try { sessionStorage.clear(); } catch (e) {}
    const v = targetVersion || appVersion || 'v0.6.3';
    window.location.replace(`${window.location.origin}${window.location.pathname}?v=${encodeURIComponent(v)}&_ts=${Date.now()}`);
  }

  function isRemoteNewer(remote, local) {
    if (!remote || !local) return false;
    const parse = v => String(v).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const [rMaj, rMin, rPat] = parse(remote);
    const [lMaj, lMin, lPat] = parse(local);
    if (rMaj > lMaj) return true;
    if (rMaj === lMaj && rMin > lMin) return true;
    if (rMaj === lMaj && rMin === lMin && rPat > lPat) return true;
    return false;
  }

  async function checkAppVersion(manual = false) {
    try {
      const res = await fetch(`version.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const normRemote = String(data.version || '').replace(/^v/i, '').trim();
      const normLocal = String(appVersion || '').replace(/^v/i, '').trim();

      if (normRemote && normLocal && isRemoteNewer(normRemote, normLocal)) {
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
      } else if (AppState.engine === 'remote') {
        const isOnline = AppState.remoteServerStatus === 'online';
        const isUpgrading = AppState.remoteServerStatus === 'upgrading';
        if (isUpgrading) {
          dom.engineBadge.textContent = isSmallScreen ? '🔄 Upgrading' : '🔄 PC Server (Upgrading...)';
          dom.engineBadge.style.color = '#f59e0b';
          dom.engineBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        } else if (isOnline) {
          dom.engineBadge.textContent = isSmallScreen ? '🖥️ PC Server' : '🖥️ PC Server (Online)';
          dom.engineBadge.style.color = '#10b981';
          dom.engineBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        } else {
          dom.engineBadge.textContent = isSmallScreen ? '🖥️ Offline' : '🖥️ PC Server (Offline)';
          dom.engineBadge.style.color = '#ef4444';
          dom.engineBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        }
      } else {
        const isReady = AppState.isModelReady;
        const modelLabel = AppState.localModel === 'instant-companion'
          ? 'Instant AI'
          : (AppState.localModel.includes('Qwen') ? 'Qwen 2.5' : 'SmolLM2');
        if (isSmallScreen) {
          dom.engineBadge.textContent = isReady ? `🏠 ${modelLabel}` : '🏠 Loading...';
        } else {
          dom.engineBadge.textContent = isReady ? `🏠 ${modelLabel} (WASM Ready)` : `🏠 ${modelLabel} (Loading...)`;
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
    },

    updateMicUI(isListening) {
      if (!dom.btnMic) return;
      const active = (isListening !== undefined) ? !!isListening : !!AppState.isListening;
      if (active) {
        dom.btnMic.classList.add('listening');
      } else {
        dom.btnMic.classList.remove('listening');
      }
    }
  };
}
