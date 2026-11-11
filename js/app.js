// Main Application Orchestrator - Quest AI Companion
import { AppState } from './state.js';
import {
  initScene,
  avatarGroup,
  applyAvatarTransform,
  flipAvatarOrientation,
  enterVR,
  setXRActionCallbacks,
  updateVRHUDState,
  resetCameraView
} from './scene.js';
import { buildAvatar, cycleAvatar, getDefaultVoiceForAvatar } from './avatars/index.js';
import { switchSpace, cycleSpace } from './spaces/index.js';
import { 
  generateAIResponse, 
  initLocalWebLLM, 
  checkGeminiResponsiveness,
  checkRemoteServerResponsiveness,
  startRemoteHeartbeat,
  stopRemoteHeartbeat,
  setClientVersion,
  checkWebGPUSupport,
  isQuestBrowser,
  registerSceneHooks
} from './ai.js';
import { setActiveVoiceId } from './audio/neural_tts.js';
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
  initDock,
  initDebugDrawer,
  logDebug,
  setStageTiming,
  setActiveStage
} from './ui/index.js';

export const APP_VERSION = 'v0.7.2';

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

  // Always stop mic capturing while AI is analyzing & speaking to prevent speaker audio leakage
  stopListening();
  stopMicAnalyser();
  AppState.isListening = false;
  AppState.isGenerating = true;
  if (dom.btnMic) dom.btnMic.classList.remove('listening');
  if (dockController) dockController.updateMicUI(false);

  if (dom.promptInput) {
    dom.promptInput.value = '';
    dom.promptInput.blur();
  }

  setStageTiming('turn_start');
  logDebug('CONV', `User speech input: "${userText}"`);

  // Step 2: Sent to AI & Analyzing
  setPipelineState('analyzing');
  const engineDesc = AppState.engine === 'cloud' 
    ? 'Gemini Cloud' 
    : (AppState.engine === 'remote' ? 'Local PC Server' : AppState.localModel);
  setActiveStage('analyzing_ai', `AI Query (${engineDesc})...`);
  dom.speechText.textContent = `You: "${userText}"\n\n⚡ Analyzing with AI...`;
  updateVRHUDState({ status: '⚡ Analyzing...', text: `You: "${userText}"` });

  try {
    const tAIStart = performance.now();
    const reply = await generateAIResponse(userText, (report) => {
      const statusText = report.text || `Loading LLM: ${report.progress}%`;
      setPipelineState('analyzing', statusText);
      dom.speechText.textContent = `You: "${userText}"\n\n⚡ ${statusText}`;
      updateVRHUDState({ status: '⚡ Analyzing...', text: statusText });
    });
    const aiLatency = Math.round(performance.now() - tAIStart);
    setStageTiming('llm', aiLatency);
    logDebug('AI', `AI response ready in ${aiLatency}ms (${reply.length} chars)`);

    // Step 3: Answer Ready
    AppState.isGenerating = false;
    setPipelineState('ready');
    dom.speechText.textContent = reply;
    updateVRHUDState({ status: 'Ready', text: reply });

    // Step 4: Speaking Reply
    AppState.isSpeaking = true;
    setPipelineState('speaking', '🗣️ Speaking (Tap or speak to interrupt)...');
    updateVRHUDState({ status: '🗣️ Speaking', text: reply });
    setActiveStage('speaking', `Speaking Reply (${AppState.ttsEngine})...`);
    logDebug('TTS', `Speaking reply via ${AppState.ttsEngine}...`);

    // In Live Mode with Smart AEC, keep microphone listening so user can barge-in and interrupt anytime!
    if (AppState.isLiveMode && AppState.echoGuardMode !== 'half_duplex') {
      startListening();
      initMicAnalyser((level) => {
        updateMicLevel(level);
        updateVRHUDState({ volume: level });
      });
      if (dom.btnMic) dom.btnMic.classList.add('listening');
      if (dockController) dockController.updateMicUI(true);
    }

    speakReply(reply, () => {
      // Completed speaking reply:
      if (AppState.isLiveMode) {
        if (AppState.echoGuardMode === 'half_duplex') {
          // Half-duplex mode: wait 350ms acoustic cooldown before reopening microphone
          setTimeout(() => {
            if (AppState.isLiveMode && !AppState.isSpeaking && !AppState.isGenerating) {
              setPipelineState('listening', 'Live Mode: Listening...');
              updateVRHUDState({ status: 'Live Mode: Listening...' });
              if (dom.btnMic) dom.btnMic.classList.add('listening');
              if (dockController) dockController.updateMicUI(true);
              initMicAnalyser((level) => {
                updateMicLevel(level);
                updateVRHUDState({ volume: level });
              });
              startListening();
            }
          }, 350);
        } else {
          // Full-duplex AEC mode: microphone was already active for barge-in, seamlessly transition state
          setPipelineState('listening', 'Live Mode: Listening...');
          updateVRHUDState({ status: 'Live Mode: Listening...' });
          if (dom.btnMic) dom.btnMic.classList.add('listening');
          if (dockController) dockController.updateMicUI(true);
        }
      } else {
        // In Regular Mode (Live Mode OFF): return to idle and KEEP MIC CLOSED!
        setPipelineState('idle');
        stopMicAnalyser();
        if (dom.btnMic) dom.btnMic.classList.remove('listening');
        if (dockController) dockController.updateMicUI(false);
        updateVRHUDState({ status: 'Ready' });
      }
    });
  } catch (err) {
    AppState.isGenerating = false;
    AppState.isSpeaking = false;
    console.error('Conversation Error:', err);
    dom.speechText.textContent = `Error: ${err.message}`;
    updateVRHUDState({ status: 'Error', text: err.message });
    setPipelineState('idle');
    stopMicAnalyser();
    if (dom.btnMic) dom.btnMic.classList.remove('listening');
    if (dockController) dockController.updateMicUI(false);
    if (AppState.isLiveMode) {
      setTimeout(() => {
        setPipelineState('listening', 'Live Mode: Listening...');
        updateVRHUDState({ status: 'Live Mode: Listening...' });
        if (dom.btnMic) dom.btnMic.classList.add('listening');
        if (dockController) dockController.updateMicUI(true);
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
// Local CPU WASM Model Loader & Progress Tracking
// -------------------------------------------------------------
async function startLocalModelLoading() {
  if (AppState.localModel === 'instant-companion') {
    showMainProgress(false);
    setPipelineState('idle');
    if (dockController) dockController.updateEngineBadge();
    dom.speechText.textContent = `Hello! I am running locally as your Instant Companion with zero latency. Speak or type below to talk to me!`;
    speakReply(`Hello! I am now ready as your companion running locally on your device.`);
    return;
  }

  const modelName = AppState.localModel.includes('Qwen') ? 'Qwen 2.5 (350 MB)' : 'SmolLM2 (80 MB)';
  showMainProgress(true, `Downloading ${modelName}...`, 0);
  setPipelineState('analyzing', `Loading ${modelName}...`);
  dom.speechText.textContent = `Downloading ${modelName} into browser CPU WebAssembly cache... First time stores model for offline use.`;

  try {
    await initLocalWebLLM((report) => {
      showMainProgress(true, report.text || `Loading LLM: ${report.progress}%`, report.progress);
      setPipelineState('analyzing', `Loading: ${report.progress}%`);
    });
    showMainProgress(false);
    setPipelineState('idle');
    if (dockController) dockController.updateEngineBadge();
    const cleanName = AppState.localModel.includes('Qwen') ? 'Qwen 2.5' : 'SmolLM2';
    dom.speechText.textContent = `Hello! I am running 100% locally on your device with ${cleanName} via CPU WebAssembly. Speak or type below to talk to me!`;
    speakReply(`Hello! I am now ready as your companion running locally on your device.`);
  } catch (err) {
    showMainProgress(false);
    setPipelineState('idle');
    if (dockController) dockController.updateEngineBadge();
    dom.speechText.textContent = `Local WASM Error: ${err.message}. You can switch to Google Gemini mode in Settings (⚙️).`;
  }
}

// -------------------------------------------------------------
// On-Device Whisper Speech-to-Text Loader & Main Screen Progress
// -------------------------------------------------------------
export async function ensureSTTReady() {
  if (AppState.engine === 'remote' && AppState.remoteServerStatus === 'online') {
    return; // Remote PC server handles STT
  }
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
window.ensureSTTReady = ensureSTTReady;

// -------------------------------------------------------------
// On-Device Neural Text-to-Speech Loader & Main Screen Progress
// -------------------------------------------------------------
export async function ensureTTSReady() {
  if (AppState.engine === 'remote' && AppState.remoteServerStatus === 'online') {
    return; // Remote PC server handles TTS
  }
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
window.ensureTTSReady = ensureTTSReady;

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
// Remote Standalone PC Server Responsiveness Verification
// -------------------------------------------------------------
async function checkRemoteServer() {
  setPipelineState('analyzing', 'Checking PC Server...');
  dom.speechText.textContent = `Connecting to Standalone PC Server at ${AppState.remoteServerUrl}...`;
  
  const check = await checkRemoteServerResponsiveness();
  if (check.responsive) {
    setPipelineState('idle');
    if (check.upgrading) {
      dom.speechText.textContent = `🔄 PC Server detected version mismatch. Auto-upgrading server to ${APP_VERSION}...`;
    } else {
      dom.speechText.textContent = `Connected to PC Server (${check.server}) on ${check.platform} (${check.cores} cores)! Ready for fast responses.`;
    }
  } else {
    setPipelineState('idle');
    dom.speechText.textContent = `⚠️ PC Server not responding at ${AppState.remoteServerUrl}: ${check.reason}. You can verify your IP in Settings (⚙️) or switch to Local CPU WASM.`;
  }
  if (dockController) dockController.updateEngineBadge();

  // Start continuous heartbeat to monitor connectivity and keep versions in lockstep
  startRemoteHeartbeat((status) => {
    if (dockController) dockController.updateEngineBadge();
    if (status.upgrading) {
      dom.speechText.textContent = `🔄 Standalone PC Server is auto-upgrading to match client (${APP_VERSION})...`;
    }
  }, 6000);
}

// -------------------------------------------------------------
// Initialize App & UI Event Binding
// -------------------------------------------------------------
function initApp() {
  // Sync client version to remote module
  setClientVersion(APP_VERSION);

  // 1. Initialize Pipeline UI, Mic Visualizer & Live Debug Logger
  initPipelineUI();
  initDebugDrawer();

  // 2. Initialize Modals with progress reporting
  modalController = initModals({
    onEngineChange: async (prevEngine, prevModel, voiceMeta) => {
      if (dockController) dockController.updateEngineBadge();
      if (AppState.engine === 'local') {
        stopRemoteHeartbeat();
        if (prevEngine !== 'local' || prevModel !== AppState.localModel || !AppState.isModelReady) {
          startLocalModelLoading();
        }
      } else if (AppState.engine === 'remote') {
        checkRemoteServer();
      } else {
        stopRemoteHeartbeat();
        checkCloudGemini();
      }

      if (AppState.engine !== 'remote' || AppState.remoteServerStatus !== 'online') {
        if (AppState.sttEngine === 'whisper' && !isWhisperReady()) {
          await ensureSTTReady();
        }
        if (AppState.ttsEngine === 'neural' && !isNeuralTTSReady()) {
          await ensureTTSReady();
        }
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

  // Auto-detect Meta Quest Browser or browsers without native speech synthesis voices:
  // Quest Browser includes speechSynthesis in window, but getVoices() is empty, causing silence.
  // Auto-route to on-device Neural TTS (WASM) so the avatar speaks out loud!
  function checkAndRouteTTS() {
    // If using PC Server remote mode, PC server handles TTS
    if (AppState.engine === 'remote' && AppState.remoteServerStatus === 'online') {
      return;
    }
    const hasNativeVoices = ('speechSynthesis' in window) && window.speechSynthesis.getVoices().length > 0;
    if ((isQuestBrowser() || !hasNativeVoices) && AppState.ttsEngine === 'native') {
      console.log('Quest/Browser has no native speech synthesis voices. Auto-enabling Neural TTS (WASM).');
      AppState.ttsEngine = 'neural';
      AppState.save();
      if (!isNeuralTTSReady()) {
        ensureTTSReady();
      }
    }
  }
  checkAndRouteTTS();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => checkAndRouteTTS();
  }

  // If running on Meta Quest Browser with Gemini key configured, prefer Gemini Cloud to prevent VR GPU stall
  if (isQuestBrowser() && AppState.geminiKey && AppState.geminiKey.trim() && AppState.engine === 'local') {
    console.log('Quest 3 detected with Gemini key. Auto-routing to Cloud Gemini mode for smooth VR performance.');
    AppState.engine = 'cloud';
    AppState.save();
    if (dockController) dockController.updateEngineBadge();
  }

  // Preload configured voice models in background sequentially to avoid CPU lockup
  (async () => {
    // If connected to remote PC Server, skip downloading on-device models to conserve Quest memory!
    if (AppState.engine === 'remote' && AppState.remoteServerStatus === 'online') {
      console.log('[ModelLoader] PC Server online: skipping local on-device model preload to conserve memory.');
      return;
    }
    if (AppState.sttEngine === 'whisper' && !isWhisperReady()) {
      await ensureSTTReady();
    }
    if (AppState.ttsEngine === 'neural' && !isNeuralTTSReady()) {
      await ensureTTSReady();
    }
  })();

  async function handleToggleLiveMode() {
    const nextMode = !AppState.isLiveMode;
    setLiveMode(nextMode);
    if (dockController) dockController.updateLiveModeUI();
    updateVRHUDState({ status: nextMode ? 'Live Mode: Listening...' : 'Ready' });

    if (nextMode) {
      setPipelineState('listening', 'Live Mode: Listening...');
      if (dom.btnMic) dom.btnMic.classList.add('listening');
      if (dockController) dockController.updateMicUI(true);
      try {
        if (AppState.engine !== 'remote' || AppState.remoteServerStatus !== 'online') {
          await ensureSTTReady();
          if (AppState.ttsEngine === 'neural' && !isNeuralTTSReady()) {
            ensureTTSReady();
          }
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
      if (dom.btnMic) dom.btnMic.classList.remove('listening');
      if (dockController) dockController.updateMicUI(false);
      updateVRHUDState({ text: '⚡ Live Mode turned OFF. Press A/X to talk or B/Y to exit VR.' });
    }
  }

  async function handleToggleMic() {
    if (AppState.isSpeaking) {
      stopSpeaking();
      if (AppState.isLiveMode) {
        setPipelineState('listening', 'Interrupted. Listening...');
        updateVRHUDState({ status: 'Interrupted. Listening...' });
        if (dom.btnMic) dom.btnMic.classList.add('listening');
        if (dockController) dockController.updateMicUI(true);
        return;
      } else {
        setPipelineState('idle');
        updateVRHUDState({ status: 'Ready' });
        if (dom.btnMic) dom.btnMic.classList.remove('listening');
        if (dockController) dockController.updateMicUI(false);
        return;
      }
    }
    if (AppState.isListening) {
      stopListening(true);
      stopMicAnalyser();
      setPipelineState('idle');
      updateVRHUDState({ status: 'Ready' });
      if (dom.btnMic) dom.btnMic.classList.remove('listening');
      if (dockController) dockController.updateMicUI(false);
    } else {
      setPipelineState('listening', 'Listening to you...');
      updateVRHUDState({ status: 'Listening to you...' });
      if (dom.btnMic) dom.btnMic.classList.add('listening');
      if (dockController) dockController.updateMicUI(true);
      try {
        if (AppState.engine !== 'remote' || AppState.remoteServerStatus !== 'online') {
          await ensureSTTReady();
          if (AppState.ttsEngine === 'neural' && !isNeuralTTSReady()) {
            ensureTTSReady();
          }
        }
      } catch (err) {
        dom.speechText.textContent = `Voice model load error: ${err.message}`;
        setPipelineState('idle');
        if (dom.btnMic) dom.btnMic.classList.remove('listening');
        if (dockController) dockController.updateMicUI(false);
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
    registerSceneHooks({
      switchSpace,
      buildAvatar,
      applyAvatarTransform,
      getDefaultVoiceForAvatar,
      setActiveVoiceId,
      flipAvatarOrientation,
      resetCameraView,
      getAvatarGroup: () => avatarGroup
    });
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
          if (dockController) dockController.updateMicUI(true);
        } else if (status === 'analyzing') {
          setPipelineState('analyzing', statusText || 'Analyzing speech...');
          if (dom.speechText && statusText) {
            dom.speechText.textContent = `⚡ ${statusText}`;
          }
          if (dom.btnMic) dom.btnMic.classList.remove('listening');
          if (dockController) dockController.updateMicUI(false);
        } else if (status === 'idle') {
          if (dom.btnMic) dom.btnMic.classList.remove('listening');
          if (dockController) dockController.updateMicUI(false);
          if (!AppState.isSpeaking && !AppState.isGenerating) {
            setPipelineState('idle');
            stopMicAnalyser();
            if (statusText) dom.speechText.textContent = statusText;
          }
        } else if (status === 'mic-denied') {
          if (dom.btnMic) dom.btnMic.classList.remove('listening');
          if (dockController) dockController.updateMicUI(false);
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
    } else if (AppState.engine === 'remote') {
      checkRemoteServer();
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
      if (AppState.isSpeaking || AppState.isGenerating) {
        stopSpeaking();
        AppState.isSpeaking = false;
        AppState.isGenerating = false;
        if (AppState.isLiveMode) {
          setPipelineState('listening', 'Interrupted. Listening...');
          setTimeout(() => {
            if (AppState.isLiveMode && !AppState.isSpeaking && !AppState.isGenerating) {
              startListening();
            }
          }, 150);
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
