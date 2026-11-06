// Main Application Entry Point - Quest AI Companion
import { AppState } from './state.js';
import { initScene, toggleWebXR, avatarGroup, applyAvatarTransform } from './scene.js';
import { buildAvatar } from './avatars/index.js';
import { generateAIResponse, abortActiveGeneration } from './ai.js';
import {
  unlockAudio,
  speakReply,
  stopSpeaking,
  initSpeechRecognition,
  startListening,
  stopListening,
  setLiveMode
} from './audio.js';

const APP_VERSION = 'v0.1.5';

// DOM References
const dom = {
  container3d: document.getElementById('canvas-container'),
  statusPill: document.getElementById('status-pill'),
  statusText: document.getElementById('status-text'),
  speechBubble: document.getElementById('speech-bubble'),
  speechText: document.getElementById('speech-text'),
  promptInput: document.getElementById('prompt-input'),
  btnSend: document.getElementById('btn-send'),
  btnMic: document.getElementById('btn-mic'),
  btnLiveMode: document.getElementById('btn-live-mode'),
  btnXr: document.getElementById('btn-xr'),
  xrLabel: document.getElementById('xr-label'),
  engineBadge: document.getElementById('engine-badge'),
  btnAvatars: document.getElementById('btn-avatars'),
  btnSettings: document.getElementById('btn-settings'),
  modalAvatars: document.getElementById('modal-avatars'),
  modalSettings: document.getElementById('modal-settings'),
  btnCloseAvatars: document.getElementById('btn-close-avatars'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  btnConfirmAvatar: document.getElementById('btn-confirm-avatar'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  cfgGeminiKey: document.getElementById('cfg-gemini-key'),
  cfgEngineSelect: document.getElementById('cfg-engine-select'),
  cfgVoiceSelect: document.getElementById('cfg-voice-select'),
  btnTestVoice: document.getElementById('btn-test-voice'),
  sliderScale: document.getElementById('slider-scale'),
  sliderDist: document.getElementById('slider-dist'),
  valScale: document.getElementById('val-scale'),
  valDist: document.getElementById('val-dist'),
  updateBanner: document.getElementById('update-banner'),
  updateText: document.getElementById('update-text'),
  btnReloadUpdate: document.getElementById('btn-reload-update'),
  xrHud: document.getElementById('xr-controller-hud')
};

function updateStatus(text, type = '') {
  dom.statusText.textContent = text;
  dom.statusPill.className = 'status-pill' + (type ? ' ' + type : '');
}

function updateEngineBadge() {
  if (AppState.engine === 'cloud') {
    dom.engineBadge.textContent = 'Gemini 2.5 Flash';
    dom.engineBadge.style.color = '#38bdf8';
    dom.engineBadge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
  } else {
    dom.engineBadge.textContent = 'Local WebLLM (GPU)';
    dom.engineBadge.style.color = '#34d399';
    dom.engineBadge.style.borderColor = 'rgba(52, 211, 153, 0.4)';
  }
}

function updateLiveModeUI() {
  if (AppState.isLiveMode) {
    dom.btnLiveMode.classList.add('active');
    dom.btnLiveMode.innerHTML = `<span class="live-pulse-dot"></span> ⚡ Live Mode: ON`;
  } else {
    dom.btnLiveMode.classList.remove('active');
    dom.btnLiveMode.innerHTML = `<span class="live-pulse-dot"></span> ⚡ Live Mode: OFF`;
  }
}

// -------------------------------------------------------------
// Voice & Conversational Exchange
// -------------------------------------------------------------
async function handleUserSpeech(userText) {
  if (!userText || !userText.trim()) return;
  userText = userText.trim();

  dom.promptInput.value = '';
  dom.promptInput.blur();
  updateStatus('Thinking...', 'thinking');
  dom.speechText.textContent = `You: "${userText}"\n\nThinking...`;

  try {
    const reply = await generateAIResponse(userText);
    speakReply(reply, () => {
      // In Live Mode, return to active listening automatically
      if (AppState.isLiveMode) {
        startListening();
      }
    });
  } catch (err) {
    console.error('Conversation Error:', err);
    dom.speechText.textContent = `Error: ${err.message}`;
    updateStatus('Ready');
    if (AppState.isLiveMode) {
      setTimeout(startListening, 1500);
    }
  }
}

// -------------------------------------------------------------
// Voice Synthesis Voice Selection Helper
// -------------------------------------------------------------
function populateVoiceList() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  dom.cfgVoiceSelect.innerHTML = '';
  
  const savedVoice = localStorage.getItem('quest_voice_name') || '';

  voices.forEach(voice => {
    if (voice.lang.startsWith('en')) {
      const opt = document.createElement('option');
      opt.value = voice.name;
      opt.textContent = `${voice.name} (${voice.lang})`;
      if (voice.name === savedVoice) opt.selected = true;
      dom.cfgVoiceSelect.appendChild(opt);
    }
  });
}

// -------------------------------------------------------------
// Avatar Selection Handling
// -------------------------------------------------------------
function syncAvatarCards() {
  document.querySelectorAll('.avatar-card').forEach(card => {
    if (card.dataset.avatarId === AppState.avatarId) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

// -------------------------------------------------------------
// Version Check & Live Update (ai-yard-guardian pattern)
// -------------------------------------------------------------
async function checkAppVersion() {
  try {
    const res = await fetch(`version.json?_t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.version && data.version !== APP_VERSION) {
      dom.updateText.textContent = `New update available: ${data.version}!`;
      dom.updateBanner.style.display = 'flex';
    }
  } catch (e) {}
}

// -------------------------------------------------------------
// Initialize App
// -------------------------------------------------------------
function initApp() {
  // 1. Initialize Scene & Renderer
  initScene(dom.container3d, dom.xrHud);

  // 2. Load Saved Avatar
  buildAvatar(AppState.avatarId, avatarGroup);
  applyAvatarTransform();

  // 3. Sync UI Status
  updateEngineBadge();
  updateLiveModeUI();
  syncAvatarCards();

  // Populate Voice dropdown
  if ('speechSynthesis' in window) {
    populateVoiceList();
    window.speechSynthesis.onvoiceschanged = populateVoiceList;
  }

  // 4. Initialize Speech Recognition with Gemini Live & Barge-in support
  initSpeechRecognition({
    onFinalSpeech: (text) => handleUserSpeech(text),
    onInterimSpeech: (interim) => {
      dom.speechText.textContent = `Listening: "${interim}..."`;
    },
    onStatusChange: (text, type) => updateStatus(text, type)
  });

  // If live mode was previously enabled, start listening
  if (AppState.isLiveMode) {
    setLiveMode(true);
  }

  // -----------------------------------------------------------
  // Event Listeners
  // -----------------------------------------------------------
  // Live Mode Toggle (Gemini Live style hands-free chat)
  dom.btnLiveMode.onclick = () => {
    unlockAudio();
    const nextMode = !AppState.isLiveMode;
    setLiveMode(nextMode);
    updateLiveModeUI();
    if (nextMode) {
      speakReply(`Live conversation active. Just start speaking anytime, and you can interrupt me whenever you want.`);
    } else {
      updateStatus('Ready');
    }
  };

  // Push to talk manual mic button
  dom.btnMic.onclick = () => {
    unlockAudio();
    if (AppState.isSpeaking) {
      stopSpeaking();
    }
    if (AppState.isListening) {
      stopListening();
      updateStatus('Ready');
    } else {
      startListening();
    }
  };

  // Text Prompt Send
  dom.btnSend.onclick = () => {
    unlockAudio();
    handleUserSpeech(dom.promptInput.value);
  };
  dom.promptInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      unlockAudio();
      handleUserSpeech(dom.promptInput.value);
    }
  };

  // Quick Chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => {
      unlockAudio();
      handleUserSpeech(chip.dataset.query);
    };
  });

  // WebXR Toggle
  dom.btnXr.onclick = async () => {
    unlockAudio();
    try {
      await toggleWebXR((isXR) => {
        dom.xrLabel.textContent = isXR ? 'Exit XR' : 'AR';
      });
    } catch (err) {
      alert(err.message || 'WebXR error');
    }
  };

  // Avatar Selection Modal
  dom.btnAvatars.onclick = () => {
    unlockAudio();
    syncAvatarCards();
    dom.modalAvatars.classList.add('open');
  };
  dom.btnCloseAvatars.onclick = () => dom.modalAvatars.classList.remove('open');

  document.querySelectorAll('.avatar-card').forEach(card => {
    card.onclick = () => {
      unlockAudio();
      document.querySelectorAll('.avatar-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    };
  });

  dom.btnConfirmAvatar.onclick = () => {
    unlockAudio();
    const activeCard = document.querySelector('.avatar-card.active');
    const selectedId = activeCard ? activeCard.dataset.avatarId : 'echo';
    AppState.avatarId = selectedId;
    AppState.save();

    buildAvatar(selectedId, avatarGroup);
    applyAvatarTransform();
    dom.modalAvatars.classList.remove('open');
    speakReply(`Hello! I am now ready as your companion.`);
  };

  // Settings Modal
  dom.btnSettings.onclick = () => {
    unlockAudio();
    dom.cfgGeminiKey.value = AppState.geminiKey;
    dom.cfgEngineSelect.value = AppState.engine;
    dom.sliderScale.value = AppState.avatarScale;
    dom.sliderDist.value = AppState.avatarDistance;
    dom.valScale.textContent = `${AppState.avatarScale.toFixed(2)}x`;
    dom.valDist.textContent = `${(1.5 + AppState.avatarDistance).toFixed(2)}m`;
    dom.modalSettings.classList.add('open');
  };
  dom.btnCloseSettings.onclick = () => dom.modalSettings.classList.remove('open');

  // Sliders for Scale & Distance
  dom.sliderScale.oninput = (e) => {
    AppState.avatarScale = parseFloat(e.target.value);
    dom.valScale.textContent = `${AppState.avatarScale.toFixed(2)}x`;
    applyAvatarTransform();
  };

  dom.sliderDist.oninput = (e) => {
    AppState.avatarDistance = parseFloat(e.target.value);
    dom.valDist.textContent = `${(1.5 + AppState.avatarDistance).toFixed(2)}m`;
    applyAvatarTransform();
  };

  dom.btnTestVoice.onclick = () => {
    unlockAudio();
    localStorage.setItem('quest_voice_name', dom.cfgVoiceSelect.value);
    speakReply("Hello! This is a test of my speech synthesis voice.");
  };

  dom.btnSaveSettings.onclick = () => {
    unlockAudio();
    AppState.geminiKey = dom.cfgGeminiKey.value.trim();
    AppState.engine = dom.cfgEngineSelect.value;
    localStorage.setItem('quest_voice_name', dom.cfgVoiceSelect.value);
    AppState.save();
    updateEngineBadge();
    dom.modalSettings.classList.remove('open');
    speakReply("Settings saved successfully.");
  };

  // 1-Tap Version Reload
  dom.btnReloadUpdate.onclick = () => {
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
        window.location.reload(true);
      });
    } else {
      window.location.reload(true);
    }
  };

  // Periodic version checking
  checkAppVersion();
  setInterval(checkAppVersion, 30000);

  // Global touch / click unblock for audio
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
