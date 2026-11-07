// Main Application Orchestrator - Quest AI Companion
import { AppState } from './state.js';
import { initScene, avatarGroup, applyAvatarTransform, flipAvatarOrientation } from './scene.js';
import { buildAvatar } from './avatars/index.js';
import { generateAIResponse, initLocalWebLLM, checkGeminiResponsiveness } from './ai.js';
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
  stopMicAnalyser
} from './audio/index.js';
import {
  initPipelineUI,
  setPipelineState,
  updateMicLevel,
  initModals,
  initDock
} from './ui/index.js';

export const APP_VERSION = 'v0.3.0';

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

  // If in regular mode (Live Mode OFF): ensure mic is stopped and closed
  if (!AppState.isLiveMode) {
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

  try {
    const reply = await generateAIResponse(userText);

    // Step 3: Answer Ready
    setPipelineState('ready');
    dom.speechText.textContent = reply;

    // Step 4: Speaking Reply
    setPipelineState('speaking', '🗣️ Speaking (Tap to stop)...');
    speakReply(reply, () => {
      // Completed speaking reply:
      if (AppState.isLiveMode) {
        // In Live Mode: automatically resume continuous listening!
        setPipelineState('listening', 'Live Mode: Listening...');
        initMicAnalyser((level) => updateMicLevel(level));
        startListening();
      } else {
        // In Regular Mode (Live Mode OFF): return to idle and KEEP MIC CLOSED!
        setPipelineState('idle');
        stopMicAnalyser();
      }
    });
  } catch (err) {
    console.error('Conversation Error:', err);
    dom.speechText.textContent = `Error: ${err.message}`;
    setPipelineState('idle');
    stopMicAnalyser();
    if (AppState.isLiveMode) {
      setTimeout(() => {
        setPipelineState('listening', 'Live Mode: Listening...');
        initMicAnalyser((level) => updateMicLevel(level));
        startListening();
      }, 1500);
    }
  }
}

// -------------------------------------------------------------
// Local WebGPU Model Loader & Progress Tracking
// -------------------------------------------------------------
function startLocalModelLoading() {
  if (dom.modelProgressBar) dom.modelProgressBar.style.display = 'block';
  if (dom.promptInput) dom.promptInput.disabled = true;
  if (dom.btnSend) dom.btnSend.disabled = true;
  if (dom.btnMic) dom.btnMic.disabled = true;
  
  setPipelineState('analyzing', 'Loading Qwen 2.5...');
  dom.speechText.textContent = `Loading ${AppState.localModel} into browser WebGPU memory... First time downloads weights into local cache.`;

  initLocalWebLLM((report) => {
    if (dom.modelProgressFill) dom.modelProgressFill.style.width = `${report.progress}%`;
    if (dom.modelProgressPct) dom.modelProgressPct.textContent = `${report.progress}%`;
    if (dom.modelProgressLabel) dom.modelProgressLabel.textContent = report.text;
    setPipelineState('analyzing', `Loading: ${report.progress}%`);
  }).then(() => {
    if (dom.modelProgressBar) dom.modelProgressBar.style.display = 'none';
    if (dom.promptInput) dom.promptInput.disabled = false;
    if (dom.btnSend) dom.btnSend.disabled = false;
    if (dom.btnMic) dom.btnMic.disabled = false;
    setPipelineState('idle');
    if (dockController) dockController.updateEngineBadge();
    dom.speechText.textContent = `Hello Eran! I am running 100% locally on your device with Qwen 2.5 via WebGPU. Speak or type below to talk to me!`;
    speakReply(`Hello Eran! I am now ready as your companion running locally on your device.`);
  }).catch((err) => {
    if (dom.modelProgressBar) dom.modelProgressBar.style.display = 'none';
    if (dom.promptInput) dom.promptInput.disabled = false;
    if (dom.btnSend) dom.btnSend.disabled = false;
    if (dom.btnMic) dom.btnMic.disabled = false;
    setPipelineState('idle');
    dom.speechText.textContent = `WebGPU Error: ${err.message}. If your device doesn't support WebGPU, switch to Google Gemini mode in Settings (⚙️).`;
  });
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

  // 2. Initialize Modals
  modalController = initModals({
    onEngineChange: (prevEngine, prevModel) => {
      if (dockController) dockController.updateEngineBadge();
      if (AppState.engine === 'local') {
        if (prevEngine !== 'local' || prevModel !== AppState.localModel || !AppState.isModelReady) {
          startLocalModelLoading();
        }
      } else {
        checkCloudGemini();
      }
    }
  });

  // 3. Initialize Top Dock & Bottom Controls
  dockController = initDock({
    appVersion: APP_VERSION,
    onSendPrompt: (prompt) => handleUserSpeech(prompt),
    onTurnAvatar: () => flipAvatarOrientation(),
    onToggleLiveMode: () => {
      const nextMode = !AppState.isLiveMode;
      setLiveMode(nextMode);
      if (dockController) dockController.updateLiveModeUI();

      if (nextMode) {
        setPipelineState('listening', 'Live Mode: Listening...');
        initMicAnalyser((level) => updateMicLevel(level));
        startListening();
        dom.speechText.textContent = '⚡ Live Mode active: Listening hands-free. Speak anytime, or tap to stop me while speaking.';
      } else {
        stopListening();
        stopMicAnalyser();
        setPipelineState('idle');
      }
    },
    onToggleMic: () => {
      if (AppState.isSpeaking) {
        stopSpeaking();
        if (AppState.isLiveMode) {
          setPipelineState('listening', 'Interrupted. Listening...');
          return;
        } else {
          setPipelineState('idle');
          return;
        }
      }
      if (AppState.isListening) {
        stopListening();
        stopMicAnalyser();
        setPipelineState('idle');
      } else {
        setPipelineState('listening', 'Listening to you...');
        startListening();
      }
    }
  });

  // Sync Badges
  if (dockController) {
    dockController.updateEngineBadge();
    dockController.updateLiveModeUI();
  }

  // 4. Initialize 3D Scene & Avatar
  try {
    initScene(dom.container3d, dom.xrHud);
    buildAvatar(AppState.avatarId, avatarGroup);
    applyAvatarTransform();
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
      onStatusChange: (status) => {
        if (status === 'listening') {
          setPipelineState('listening', AppState.isLiveMode ? 'Live Mode: Listening...' : 'Listening to you...');
          if (dom.btnMic) dom.btnMic.classList.add('listening');
        } else if (status === 'idle') {
          if (dom.btnMic) dom.btnMic.classList.remove('listening');
          if (!AppState.isSpeaking && !AppState.isGenerating) {
            setPipelineState('idle');
            stopMicAnalyser();
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
