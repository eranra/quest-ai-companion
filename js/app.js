// Main Application Entry Point - Quest AI Companion
import { AppState } from './state.js';
import { initScene, toggleWebXR, avatarGroup, applyAvatarTransform } from './scene.js';
import { buildAvatar } from './avatars/index.js';
import { generateAIResponse, initLocalWebLLM, checkGeminiResponsiveness, abortActiveGeneration } from './ai.js';
import {
  unlockAudio,
  speakReply,
  stopSpeaking,
  initSpeechRecognition,
  startListening,
  stopListening,
  setLiveMode
} from './audio.js';

const APP_VERSION = 'v0.1.8';
let latestDetectedVersion = null;

// DOM References
const dom = {
  container3d: document.getElementById('canvas-container'),
  statusPill: document.getElementById('status-pill'),
  statusText: document.getElementById('status-text'),
  speechBubble: document.getElementById('speech-bubble'),
  speechText: document.getElementById('speech-text'),
  modelProgressBar: document.getElementById('model-progress-bar'),
  modelProgressFill: document.getElementById('model-progress-fill'),
  modelProgressPct: document.getElementById('model-progress-pct'),
  modelProgressLabel: document.getElementById('model-progress-label'),
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
  cfgLocalModel: document.getElementById('cfg-local-model'),
  cfgLiveSensitivity: document.getElementById('cfg-live-sensitivity'),
  cfgEchoGuard: document.getElementById('cfg-echo-guard'),
  groupLocalModel: document.getElementById('group-local-model'),
  groupGemini: document.getElementById('group-gemini'),
  btnTestGemini: document.getElementById('btn-test-gemini'),
  geminiTestStatus: document.getElementById('gemini-test-status'),
  engineSummaryHint: document.getElementById('engine-summary-hint'),
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
  dom.statusPill.className = 'avatar-state' + (type ? ' ' + type : '');
}

function updateEngineBadge() {
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
}

function updateLiveModeUI() {
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

// -------------------------------------------------------------
// Local WebGPU Model Loader & Progress Tracking
// -------------------------------------------------------------
function startLocalModelLoading() {
  dom.modelProgressBar.style.display = 'block';
  dom.promptInput.disabled = true;
  dom.btnSend.disabled = true;
  dom.btnMic.disabled = true;
  updateStatus('Loading Qwen 2.5...', 'thinking');
  dom.speechText.textContent = `Loading ${AppState.localModel} into browser WebGPU memory... First time downloads weights into local cache.`;

  initLocalWebLLM((report) => {
    dom.modelProgressFill.style.width = `${report.progress}%`;
    dom.modelProgressPct.textContent = `${report.progress}%`;
    dom.modelProgressLabel.textContent = report.text;
    updateStatus(`Loading: ${report.progress}%`, 'thinking');
  }).then(() => {
    dom.modelProgressBar.style.display = 'none';
    dom.promptInput.disabled = false;
    dom.btnSend.disabled = false;
    dom.btnMic.disabled = false;
    updateStatus('Ready (Qwen 2.5 Local)', '');
    updateEngineBadge();
    dom.speechText.textContent = `Hello Eran! I am running 100% locally on your device with Qwen 2.5 via WebGPU. Speak or type below to talk to me!`;
    speakReply(`Hello Eran! I am now ready as your companion running locally on your device.`);
  }).catch((err) => {
    dom.modelProgressBar.style.display = 'none';
    dom.promptInput.disabled = false;
    dom.btnSend.disabled = false;
    dom.btnMic.disabled = false;
    updateStatus('Model Error', '');
    dom.speechText.textContent = `WebGPU Error: ${err.message}. If your device doesn't support WebGPU, switch to Google Gemini mode in Settings (⚙️).`;
  });
}

// -------------------------------------------------------------
// Google Gemini API Responsiveness Verification
// -------------------------------------------------------------
async function checkCloudGemini() {
  updateStatus('Checking Gemini...', 'thinking');
  dom.speechText.textContent = 'Checking Google Gemini API connection...';
  
  const check = await checkGeminiResponsiveness();
  if (check.responsive) {
    updateStatus('Ready (Gemini 2.5)', '');
    dom.speechText.textContent = `Connected to Google Gemini 2.5 Flash! Speak or type to start talking.`;
  } else {
    updateStatus('Gemini Offline', '');
    dom.speechText.textContent = `⚠️ Google Gemini is not responding: ${check.reason}. You can enter your API key in Settings (⚙️) or switch to Local Qwen mode.`;
  }
  updateEngineBadge();
}

// -------------------------------------------------------------
// Voice & Conversational Exchange
// -------------------------------------------------------------
async function handleUserSpeech(userText) {
  if (!userText || !userText.trim()) return;
  unlockAudio();
  userText = userText.trim();

  dom.promptInput.value = '';
  dom.promptInput.blur();
  updateStatus('Thinking...', 'thinking');
  dom.speechText.textContent = `You: "${userText}"\n\nThinking...`;

  try {
    const reply = await generateAIResponse(userText);
    dom.speechText.textContent = reply;
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
function forceAppRefresh(targetVersion) {
  if ('caches' in window) {
    try {
      caches.keys().then(names => {
        Promise.all(names.map(name => caches.delete(name))).catch(() => {});
      });
    } catch (e) {}
  }
  const v = targetVersion || APP_VERSION;
  window.location.href = window.location.origin + window.location.pathname + '?v=' + v + '&nocache=' + Date.now();
}

async function checkAppVersion(manual = false) {
  try {
    const res = await fetch(`version.json?_t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.version && data.version !== APP_VERSION) {
      latestDetectedVersion = data.version;
      dom.updateText.textContent = `🚀 New update available (${data.version})!`;
      dom.updateBanner.style.display = 'flex';
    } else {
      dom.updateBanner.style.display = 'none';
      if (manual) {
        alert(`You are on the latest version (${APP_VERSION})!`);
      }
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

  // 5. Start Engine according to AppState (Local Qwen default!)
  if (AppState.engine === 'local') {
    startLocalModelLoading();
  } else {
    checkCloudGemini();
  }

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
    dom.cfgLocalModel.value = AppState.localModel;
    dom.cfgLiveSensitivity.value = AppState.liveSensitivity || 'normal';
    dom.cfgEchoGuard.value = AppState.echoGuardMode || 'smart';
    dom.sliderScale.value = AppState.avatarScale;
    dom.sliderDist.value = AppState.avatarDistance;
    dom.valScale.textContent = `${AppState.avatarScale.toFixed(2)}x`;
    dom.valDist.textContent = `${(1.5 + AppState.avatarDistance).toFixed(2)}m`;
    
    // Toggle groups
    if (AppState.engine === 'cloud') {
      dom.groupGemini.style.display = 'block';
      dom.groupLocalModel.style.display = 'none';
      dom.engineSummaryHint.textContent = 'Connects to Google Gemini 2.5 Flash cloud API for fast answers.';
    } else {
      dom.groupGemini.style.display = 'none';
      dom.groupLocalModel.style.display = 'block';
      dom.engineSummaryHint.textContent = 'Runs offline on your device GPU with Qwen 2.5. Zero API keys, completely private.';
    }

    dom.modalSettings.classList.add('open');
  };
  dom.btnCloseSettings.onclick = () => dom.modalSettings.classList.remove('open');

  dom.cfgEngineSelect.onchange = () => {
    if (dom.cfgEngineSelect.value === 'cloud') {
      dom.groupGemini.style.display = 'block';
      dom.groupLocalModel.style.display = 'none';
      dom.engineSummaryHint.textContent = 'Connects to Google Gemini 2.5 Flash cloud API for fast answers.';
    } else {
      dom.groupGemini.style.display = 'none';
      dom.groupLocalModel.style.display = 'block';
      dom.engineSummaryHint.textContent = 'Runs offline on your device GPU with Qwen 2.5. Zero API keys, completely private.';
    }
  };

  // Test Gemini Key in Settings
  dom.btnTestGemini.onclick = async () => {
    unlockAudio();
    const testKey = dom.cfgGeminiKey.value.trim();
    if (!testKey) {
      dom.geminiTestStatus.textContent = '⚠️ Enter API key first';
      dom.geminiTestStatus.style.color = '#f59e0b';
      return;
    }
    
    dom.geminiTestStatus.textContent = 'Testing connection...';
    dom.geminiTestStatus.style.color = '#38bdf8';
    
    AppState.geminiKey = testKey;
    const check = await checkGeminiResponsiveness();
    if (check.responsive) {
      dom.geminiTestStatus.textContent = '✅ Responsive & Ready!';
      dom.geminiTestStatus.style.color = '#10b981';
    } else {
      dom.geminiTestStatus.textContent = `❌ ${check.reason}`;
      dom.geminiTestStatus.style.color = '#ef4444';
    }
  };

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
    speakReply("Hello Eran! This is a test of my speech synthesis voice and speaking body language.");
  };

  dom.btnSaveSettings.onclick = () => {
    unlockAudio();
    const prevEngine = AppState.engine;
    const prevModel = AppState.localModel;

    AppState.geminiKey = dom.cfgGeminiKey.value.trim();
    AppState.engine = dom.cfgEngineSelect.value;
    AppState.localModel = dom.cfgLocalModel.value;
    AppState.liveSensitivity = dom.cfgLiveSensitivity.value;
    AppState.echoGuardMode = dom.cfgEchoGuard.value;
    localStorage.setItem('quest_voice_name', dom.cfgVoiceSelect.value);
    AppState.save();
    
    updateEngineBadge();
    dom.modalSettings.classList.remove('open');

    // Trigger loader or connection check if changed
    if (AppState.engine === 'local') {
      if (prevEngine !== 'local' || prevModel !== AppState.localModel || !AppState.isModelReady) {
        startLocalModelLoading();
      }
    } else {
      checkCloudGemini();
    }
  };

  // 1-Tap Version Reload (ai-yard-guardian pattern)
  dom.btnReloadUpdate.onclick = () => forceAppRefresh(latestDetectedVersion);
  const versionBadge = document.getElementById('app-version-badge');
  if (versionBadge) versionBadge.onclick = () => checkAppVersion(true);

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
