// Main Application Orchestrator - Quest AI Companion
import { AppState } from './state.js';
import {
  initScene,
  avatarGroup,
  applyAvatarTransform,
  flipAvatarOrientation,
  enterVR,
  setXRActionCallbacks,
  updateVRHUDState
} from './scene.js';
import { buildAvatar, cycleAvatar } from './avatars/index.js';
import { cycleSpace } from './spaces/index.js';
import { 
  generateAIResponse, 
  initLocalWebLLM, 
  checkGeminiResponsiveness,
  checkWebGPUSupport,
  isQuestBrowser
} from './ai.js';
import {
  unlockAudio,
  speakReply,
  stopSpeaking,
  isSelfEcho,
  initSpeechRecognition,
  startListening,
  stopListening,
  setLiveMode,
  initMicAnalyser,
  stopMicAnalyser,
  initWhisper,
  isWhisperReady,
  initNeuralTTS,
  isNeuralTTSReady,
  isNeuralTTSLoading
} from './audio/index.js';
import {
  initPipelineUI,
  setPipelineState,
  updateMicLevel,
  initModals,
  initDock
} from './ui/index.js';

export const APP_VERSION = 'v0.4.0';

// DOM References
const dom = {
  container3d: document.getElementById('canvas-container'),
  speechText: document.getElementById('speech-text'),
  modelProgressBar: document.getElementById('model-progress-bar'),
  modelProgressFill: document.getElementById('model-progress-fill'),
  modelProgressPct: document.getElementById('model-progress-pct'),
  modelProgressLabel: document.getElementById('model-progress-label'),
  promptInput: document.getElementById('prompt-input'),
  btnSend: document.getElementById('btn-send'),
  btnMic: document.getElementById('btn-mic'),
  xrHud: document.getElementById('xr-controller-hud')
};

let dockController = null;
let modalController = null;

// -------------------------------------------------------------
// Voice & Conversational Pipeline Handling
// -------------------------------------------------------------
async function handleUserSpeech(userText) {
  if (!userText || !userText.trim()) return;
  unlockAudio();
  userText = userText.trim();

  // Multi-tier echo gatekeeper: discard any acoustic reflection before LLM processing
  if (isSelfEcho(userText)) {
    console.warn(`[EchoGuard] Blocked self-echo from reaching AI: "${userText}"`);
    return;
  }

  // In Half-Duplex mode or Regular mode: ensure mic is stopped and closed while AI is analyzing & speaking!
  if (!AppState.isLiveMode || AppState.echoGuardMode === 'half_duplex') {
    stopListening();
    stopMicAnalyser();
  }

  if (dom.promptInput) {
    dom.promptInput.value = '';
    dom.promptInput.blur();
  }

  // Step 2: Sent to AI & Analyzing
  setPipelineState('analyzing');
  dom.speechText.textContent = `You: "${userText}"\n\n⚡ Analyzing with AI...`;
  updateVRHUDState({ status: '⚡ Analyzing...', text: `You: "${userText}"` });

  try {
    const reply = await generateAIResponse(userText, (report) => {
      const statusText = report.text || `Loading LLM: ${report.progress}%`;
      setPipelineState('analyzing', statusText);
      dom.speechText.textContent = `You: "${userText}"\n\n⚡ ${statusText}`;
      updateVRHUDState({ status: '⚡ Analyzing...', text: statusText });
    });

    // Step 3: Answer Ready
    setPipelineState('ready');
    dom.speechText.textContent = reply;
    updateVRHUDState({ status: 'Ready', text: reply });

    // If on Quest 3 trying to use Local mode with disabled WebGPU, alert user with resolution modal
    if (AppState.engine === 'local' && isQuestBrowser() && (!AppState.geminiKey || !AppState.geminiKey.trim())) {
      checkWebGPUSupport().then(gpu => {
        if (!gpu.supported && modalController && modalController.showQuestGPUAlert) {
          modalController.showQuestGPUAlert();
        }
      }).catch(() => {});
    }

    // Step 4: Speaking Reply
    setPipelineState('speaking', '🗣️ Speaking (Tap to stop)...');
    updateVRHUDState({ status: '🗣️ Speaking', text: reply });
    speakReply(reply, () => {
      // Completed speaking reply:
      if (AppState.isLiveMode) {
        // Small acoustic cooldown (350ms) to ensure speaker audio is completely silent
        setTimeout(() => {
          if (AppState.isLiveMode) {
            setPipelineState('listening', 'Live Mode: Listening...');
            updateVRHUDState({ status: 'Live Mode: Listening...' });
            initMicAnalyser((level) => {
              updateMicLevel(level);
              updateVRHUDState({ volume: level });
            });
            startListening();
          }
        }, 350);
      } else {
        // In Regular Mode (Live Mode OFF): return to idle and KEEP MIC CLOSED!
        setPipelineState('idle');
        stopMicAnalyser();
        updateVRHUDState({ status: 'Ready' });
      }
    });
  } catch (err) {
    console.error('Conversation Error:', err);
    dom.speechText.textContent = `Error: ${err.message}`;
    updateVRHUDState({ status: 'Error', text: err.message });
    setPipelineState('idle');
    stopMicAnalyser();
    if (AppState.isLiveMode) {
      setTimeout(() => {
        setPipelineState('listening', 'Live Mode: Listening...');
        updateVRHUDState({ status: 'Live Mode: Listening...' });
        initMicAnalyser((level) => {
          updateMicLevel(level);
          updateVRHUDState({ volume: level });
        });
        startListening();
      }, 1500);
    }
  }
}

// -------------------------------------------------------------
// Centralized Main-Screen Model Download & Progress Tracking
// -------------------------------------------------------------
function showMainProgress(visible, text = '', pct = 0) {
  if (dom.modelProgressBar) {
    dom.modelProgressBar.style.display = visible ? 'block' : 'none';
  }
  const cleanPct = Math.min(100, Math.max(0, Math.round(pct)));
  if (dom.modelProgressFill) {
    dom.modelProgressFill.style.width = `${cleanPct}%`;
  }
  if (dom.modelProgressPct) {
    dom.modelProgressPct.textContent = `${cleanPct}%`;
  }
  if (dom.modelProgressLabel && text) {
    dom.modelProgressLabel.textContent = text;
  }
  // Disable user input controls while downloading to prevent race conditions
  if (dom.promptInput) dom.promptInput.disabled = visible;
  if (dom.btnSend) dom.btnSend.disabled = visible;
  if (dom.btnMic) dom.btnMic.disabled = visible;
}

// -------------------------------------------------------------
// Local WebGPU Model Loader & Progress Tracking
// -------------------------------------------------------------
async function startLocalModelLoading() {
  const gpuCheck = await checkWebGPUSupport();
  if (!gpuCheck.supported) {
    showMainProgress(false);
    setPipelineState('idle');
    AppState.isModelLoading = false;
    AppState.isModelReady = false;
    AppState.modelStatusText = 'WebGPU unavailable';
    if (dockController) dockController.updateEngineBadge();
    const isQuest = isQuestBrowser();
    if (isQuest) {
      dom.speechText.textContent = '🥽 Meta Quest 3: WebGPU flag is DISABLED in Quest Browser. Tap the badge or Settings to switch to Google Gemini Cloud (recommended)!';
      if (modalController && modalController.showQuestGPUAlert) {
        modalController.showQuestGPUAlert();
      }
    } else {
      dom.speechText.textContent = 'WebGPU is not enabled on this browser. You can enter a Google Gemini API key in Settings (⚙️) to start chatting!';
    }
    return;
  }

  showMainProgress(true, 'Downloading Qwen 2.5 Model...', 0);
  setPipelineState('analyzing', 'Loading Qwen 2.5...');
  dom.speechText.textContent = `Loading ${AppState.localModel} into browser WebGPU memory... First time downloads weights into local cache.`;

  try {
    await initLocalWebLLM((report) => {
      showMainProgress(true, report.text || `Loading LLM: ${report.progress}%`, report.progress);
      setPipelineState('analyzing', `Loading: ${report.progress}%`);
    });
    showMainProgress(false);
    setPipelineState('idle');
    if (dockController) dockController.updateEngineBadge();
    dom.speechText.textContent = `Hello Eran! I am running 100% locally on your device with Qwen 2.5 via WebGPU. Speak or type below to talk to me!`;
    speakReply(`Hello Eran! I am now ready as your companion running locally on your device.`);
  } catch (err) {
    showMainProgress(false);
    setPipelineState('idle');
    if (dockController) dockController.updateEngineBadge();
    dom.speechText.textContent = `WebGPU Error: ${err.message}. If your device doesn't support WebGPU, switch to Google Gemini mode in Settings (⚙️).`;
  }
}

// -------------------------------------------------------------
// On-Device Whisper Speech-to-Text Loader & Main Screen Progress
// -------------------------------------------------------------
async function ensureSTTReady() {
  if (AppState.sttEngine === 'whisper' && !isWhisperReady()) {
    showMainProgress(true, 'Downloading Whisper STT (~39 MB)...', 0);
    setPipelineState('analyzing', 'Loading Whisper STT...');
    dom.speechText.textContent = 'Downloading on-device Whisper STT (~39 MB)... First time caches model in browser.';
    try {
      await initWhisper((report) => {
        showMainProgress(true, report.text || `Whisper STT: ${report.progress}%`, report.progress);
        setPipelineState('analyzing', `Whisper: ${report.progress}%`);
      });
      showMainProgress(false);
      setPipelineState('idle');
      dom.speechText.textContent = '✨ Whisper STT is ready! Listening to you...';
    } catch (err) {
      showMainProgress(false);
      setPipelineState('idle');
      dom.speechText.textContent = `Whisper load warning: ${err.message}. Using default speech recognition.`;
      console.warn('Whisper load error:', err);
    }
  }
}

// -------------------------------------------------------------
// On-Device Neural Text-to-Speech Loader & Main Screen Progress
// -------------------------------------------------------------
async function ensureTTSReady() {
  if (AppState.ttsEngine === 'neural' && !isNeuralTTSReady()) {
    showMainProgress(true, 'Downloading Neural Voice (~36 MB)...', 0);
    setPipelineState('analyzing', 'Loading Neural Voice...');
    dom.speechText.textContent = 'Downloading on-device Neural Voice TTS (~36 MB)... Stored in browser cache.';
    try {
      await initNeuralTTS((report) => {
        showMainProgress(true, report.text || `Neural Voice: ${report.progress}%`, report.progress);
        setPipelineState('analyzing', `Neural Voice: ${report.progress}%`);
      });
      showMainProgress(false);
      setPipelineState('idle');
      dom.speechText.textContent = '✨ Neural Voice is ready! I will now speak using local neural synthesis.';
    } catch (err) {
      showMainProgress(false);
      setPipelineState('idle');
      dom.speechText.textContent = `Neural Voice load warning: ${err.message}. Using device native voice.`;
      console.warn('Neural TTS load error:', err);
    }
  }
}

// -------------------------------------------------------------
// Google Gemini API Responsiveness Verification
// -------------------------------------------------------------
async function checkCloudGemini() {
  setPipelineState('analyzing', 'Checking Gemini...');
  dom.speechText.textContent = 'Checking Google Gemini API connection...';
  
  const check = await checkGeminiResponsiveness();
  if (check.responsive) {
    setPipelineState('idle');
    dom.speechText.textContent = `Connected to Google Gemini 2.5 Flash! Speak or type to start talking.`;
  } else {
    setPipelineState('idle');
    dom.speechText.textContent = `⚠️ Google Gemini is not responding: ${check.reason}. You can enter your API key in Settings (⚙️) or switch to Local Qwen mode.`;
  }
  if (dockController) dockController.updateEngineBadge();
}

// -------------------------------------------------------------
// Initialize App & UI Event Binding
// -------------------------------------------------------------
function initApp() {
  // 1. Initialize Pipeline UI & Mic Visualizer
  initPipelineUI();

  // 2. Initialize Modals with progress reporting
  modalController = initModals({
    onEngineChange: async (prevEngine, prevModel, voiceMeta) => {
      if (dockController) dockController.updateEngineBadge();
      if (AppState.engine === 'local') {
        if (prevEngine !== 'local' || prevModel !== AppState.localModel || !AppState.isModelReady) {
          startLocalModelLoading();
        }
      } else {
        checkCloudGemini();
      }

      if (AppState.sttEngine === 'whisper' && !isWhisperReady()) {
        await ensureSTTReady();
      }
      if (AppState.ttsEngine === 'neural' && !isNeuralTTSReady()) {
        await ensureTTSReady();
      }
    },
    onVoiceModelProgress: (visible, text, pct) => {
      showMainProgress(visible, text, pct);
    }
  });

  // Auto-detect Meta Quest Browser or browsers without native SpeechRecognition:
  // Quest Browser omits native webkitSpeechRecognition, so auto-route to on-device Whisper STT!
  const hasNativeSTT = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!hasNativeSTT && AppState.sttEngine === 'native') {
    console.log('Quest/Browser has no native speech recognition. Auto-enabling on-device Whisper STT.');
    AppState.sttEngine = 'whisper';
    AppState.save();
  }

  // If running on Meta Quest Browser with Gemini key configured, prefer Gemini Cloud to prevent VR GPU stall
  if (isQuestBrowser() && AppState.geminiKey && AppState.geminiKey.trim() && AppState.engine === 'local') {
    console.log('Quest 3 detected with Gemini key. Auto-routing to Cloud Gemini mode for smooth VR performance.');
    AppState.engine = 'cloud';
    AppState.save();
    if (dockController) dockController.updateEngineBadge();
  }

  // Preload configured voice models in background
  if (AppState.sttEngine === 'whisper' && !isWhisperReady()) {
    ensureSTTReady();
  }
  if (AppState.ttsEngine === 'neural' && !isNeuralTTSReady()) {
    ensureTTSReady();
  }

  async function handleToggleLiveMode() {
    const nextMode = !AppState.isLiveMode;
    setLiveMode(nextMode);
    if (dockController) dockController.updateLiveModeUI();
    updateVRHUDState({ status: nextMode ? 'Live Mode: Listening...' : 'Ready' });

    if (nextMode) {
      setPipelineState('listening', 'Live Mode: Listening...');
      try {
        await ensureSTTReady();
        if (AppState.ttsEngine === 'neural' && !isNeuralTTSReady()) {
          ensureTTSReady();
        }
      } catch (err) {
        dom.speechText.textContent = `Voice load error: ${err.message}`;
      }
      initMicAnalyser((level) => {
        updateMicLevel(level);
        updateVRHUDState({ volume: level });
      });
      startListening();
      dom.speechText.textContent = '⚡ Live Mode active: Listening hands-free. Speak anytime, or tap to stop me while speaking.';
      updateVRHUDState({ text: dom.speechText.textContent });
    } else {
      stopListening();
      stopMicAnalyser();
      setPipelineState('idle');
      updateVRHUDState({ text: '⚡ Live Mode turned OFF. Press A/X to talk or B/Y to exit VR.' });
    }
  }

  async function handleToggleMic() {
    if (AppState.isSpeaking) {
      stopSpeaking();
      if (AppState.isLiveMode) {
        setPipelineState('listening', 'Interrupted. Listening...');
        updateVRHUDState({ status: 'Interrupted. Listening...' });
        return;
      } else {
        setPipelineState('idle');
        updateVRHUDState({ status: 'Ready' });
        return;
      }
    }
    if (AppState.isListening) {
      stopListening(true);
      stopMicAnalyser();
      setPipelineState('idle');
      updateVRHUDState({ status: 'Ready' });
    } else {
      setPipelineState('listening', 'Listening to you...');
      updateVRHUDState({ status: 'Listening to you...' });
      try {
        await ensureSTTReady();
        if (AppState.ttsEngine === 'neural' && !isNeuralTTSReady()) {
          ensureTTSReady();
        }
      } catch (err) {
        dom.speechText.textContent = `Voice model load error: ${err.message}`;
        setPipelineState('idle');
        return;
      }
      initMicAnalyser((level) => {
        updateMicLevel(level);
        updateVRHUDState({ volume: level });
      });
      startListening();
    }
  }

  // 3. Initialize Top Dock & Bottom Controls
  dockController = initDock({
    appVersion: APP_VERSION,
    onSendPrompt: (prompt) => handleUserSpeech(prompt),
    onTurnAvatar: () => flipAvatarOrientation(),
    onToggleLiveMode: () => handleToggleLiveMode(),
    onToggleMic: () => handleToggleMic(),
    onShowGPUAlert: () => modalController && modalController.showQuestGPUAlert && modalController.showQuestGPUAlert(),
    onOpenSettings: () => {
      const btn = document.getElementById('btn-settings');
      if (btn) btn.click();
    }
  });

  // Sync Badges
  if (dockController) {
    dockController.updateEngineBadge();
    dockController.updateLiveModeUI();
  }

  // 4. Initialize 3D Scene, Avatar, and WebXR Controller Action Handlers
  try {
    initScene(dom.container3d, dom.xrHud);
    buildAvatar(AppState.avatarId, avatarGroup);
    applyAvatarTransform();

    // Register In-VR 3D Console & Quest Controller Hardware Buttons (B/Y, A/X, Grip, Sticks)
    setXRActionCallbacks({
      onExitVR: () => {
        console.log('🚪 Exit VR triggered from Quest controller / in-VR Console');
        enterVR();
      },
      onToggleMic: () => {
        handleToggleMic();
      },
      onToggleLive: () => {
        handleToggleLiveMode();
      },
      onCycleSpace: (dir) => {
        const nextDef = cycleSpace(dir);
        updateVRHUDState({ status: `Space: ${nextDef.name}` });
      },
      onCycleAvatar: (dir) => {
        const nextId = cycleAvatar(dir, avatarGroup);
        applyAvatarTransform();
        updateVRHUDState({ status: `Avatar: ${nextId}` });
      }
    });
  } catch (err) {
    console.error('Scene/Avatar init error:', err);
  }

  // 5. Initialize Continuous Speech Recognition without native beeps
  try {
    initSpeechRecognition({
      onFinalSpeech: (text) => handleUserSpeech(text),
      onInterimSpeech: (interim) => {
        setPipelineState('listening', `Listening: "${interim}..."`);
        dom.speechText.textContent = `Listening: "${interim}..."`;
      },
      onVolume: (level) => updateMicLevel(level),
      onStatusChange: (status, statusText) => {
        if (status === 'listening') {
          setPipelineState('listening', statusText || (AppState.isLiveMode ? 'Live Mode: Listening...' : 'Listening to you...'));
          if (dom.btnMic) dom.btnMic.classList.add('listening');
        } else if (status === 'analyzing') {
          setPipelineState('analyzing', statusText || 'Analyzing speech...');
          if (dom.speechText && statusText) {
            dom.speechText.textContent = `⚡ ${statusText}`;
          }
          if (dom.btnMic) dom.btnMic.classList.remove('listening');
        } else if (status === 'idle') {
          if (dom.btnMic) dom.btnMic.classList.remove('listening');
          if (!AppState.isSpeaking && !AppState.isGenerating) {
            setPipelineState('idle');
            stopMicAnalyser();
            if (statusText) dom.speechText.textContent = statusText;
          }
        } else if (status === 'mic-denied') {
          if (dom.btnMic) dom.btnMic.classList.remove('listening');
          setPipelineState('mic-denied');
          stopMicAnalyser();
        }
      }
    });
  } catch (err) {
    console.error('Speech recognition init error:', err);
  }

  // 6. Start AI Engine according to AppState
  try {
    if (AppState.engine === 'local') {
      startLocalModelLoading();
    } else {
      checkCloudGemini();
    }
  } catch (err) {
    console.error('Engine start error:', err);
  }

  // 7. If Live Mode was previously active, resume smoothly
  if (AppState.isLiveMode) {
    try {
      setLiveMode(true);
      initMicAnalyser((level) => updateMicLevel(level));
      setPipelineState('listening');
    } catch (err) {}
  }

  // Tap-to-Interrupt: Clicking speech bubble or status pill immediately interrupts speaking avatar
  const bubbleElement = document.querySelector('.speech-bubble');
  if (bubbleElement) {
    bubbleElement.addEventListener('click', () => {
      if (AppState.isSpeaking) {
        stopSpeaking();
        if (AppState.isLiveMode) {
          setPipelineState('listening', 'Interrupted. Listening...');
        } else {
          setPipelineState('idle');
        }
      }
    });
  }

  // 8. Meta Quest 3 / WebXR Immersive 360 VR Support Detection
  if (navigator.xr && navigator.xr.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-vr').then(supported => {
      if (supported) {
        console.log('🥽 Meta Quest 3 WebXR Immersive 360° VR Supported!');
        const btnVr = document.getElementById('btn-vr');
        if (btnVr) {
          btnVr.title = "Step inside your 360° Space with Meta Quest 3!";
        }
      }
    }).catch(() => {});
  }

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
