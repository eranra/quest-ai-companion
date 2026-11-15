// Quest AI Companion - Conversation & Pipeline Turn Orchestrator
// Coordinates user speech turns, multi-tier echo detection, cancellation/barge-in, LLM queries, and speech output.

import { AppState } from './state.js';
import { generateAIResponse, abortActiveGeneration } from './ai.js';
import {
  unlockAudio,
  speakReply,
  stopSpeaking,
  isSelfEcho,
  startListening,
  stopListening,
  initMicAnalyser,
  stopMicAnalyser,
  stopAvatarGesture
} from './audio/index.js';
import {
  setPipelineState,
  updateMicLevel,
  logDebug,
  setStageTiming,
  setActiveStage
} from './ui/index.js';

let activeTurnSeq = 0;
let speechSafetyWatchdog = null;

let orchestratorContext = {
  dom: {},
  getDockController: () => null,
  updateVRHUDState: () => {},
  unlockAudio: () => {}
};

export function setOrchestratorContext(ctx) {
  orchestratorContext = { ...orchestratorContext, ...ctx };
}

export function getActiveTurnSeq() {
  return activeTurnSeq;
}

/**
 * Immediately cancels and invalidates the active conversational turn.
 * Halts speech synthesis, gestures, in-flight AI queries, and resets state flags.
 */
export function abortActiveTurn() {
  const abortedId = ++activeTurnSeq;
  if (speechSafetyWatchdog) {
    clearTimeout(speechSafetyWatchdog);
    speechSafetyWatchdog = null;
  }
  stopSpeaking();
  stopAvatarGesture();
  abortActiveGeneration();

  AppState.isSpeaking = false;
  AppState.isGenerating = false;

  logDebug('CONV', `Turn #${abortedId - 1} explicitly aborted. Now on Turn #${abortedId}.`);
  return abortedId;
}

/**
 * Handles incoming speech from user (STT final result or text prompt)
 */
export async function handleUserSpeech(userText) {
  if (!userText || !userText.trim()) return;
  const { dom, getDockController, updateVRHUDState } = orchestratorContext;
  const dockController = getDockController();

  unlockAudio();
  userText = userText.trim();

  // Multi-tier echo gatekeeper: discard any acoustic reflection before LLM processing
  if (isSelfEcho(userText)) {
    console.warn(`[EchoGuard] Blocked self-echo from reaching AI: "${userText}"`);
    if (AppState.isLiveMode) {
      setPipelineState('listening', 'Live Mode: Listening...');
      updateVRHUDState({ status: 'Live Mode: Listening...' });
      if (dom.btnMic) dom.btnMic.classList.add('listening');
      if (dockController) dockController.updateMicUI(true);
      startListening();
    }
    return;
  }

  // Interruption / Barge-in cleanup: immediately halt previous speech, gestures, and pending LLM queries
  const thisTurnId = abortActiveTurn();

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
  logDebug('CONV', `User speech input: "${userText}" (Turn #${thisTurnId})`);

  // Step 2: Sent to AI & Analyzing
  setPipelineState('analyzing');
  const engineDesc = AppState.engine === 'cloud' 
    ? 'Gemini Cloud' 
    : (AppState.engine === 'remote' ? 'Local PC Server' : AppState.localModel);
  setActiveStage('analyzing_ai', `AI Query (${engineDesc})...`);
  if (dom.speechText) {
    dom.speechText.textContent = `You: "${userText}"\n\n⚡ Analyzing with AI...`;
  }
  updateVRHUDState({ status: '⚡ Analyzing...', text: `You: "${userText}"` });

  try {
    const tAIStart = performance.now();
    const reply = await generateAIResponse(userText, (report) => {
      if (thisTurnId !== activeTurnSeq) return;
      const statusText = report.text || `Loading LLM: ${report.progress}%`;
      setPipelineState('analyzing', statusText);
      if (dom.speechText) {
        dom.speechText.textContent = `You: "${userText}"\n\n⚡ ${statusText}`;
      }
      updateVRHUDState({ status: '⚡ Analyzing...', text: statusText });
    });

    if (thisTurnId !== activeTurnSeq) {
      logDebug('AI', `Turn #${thisTurnId} superseded by Turn #${activeTurnSeq}, ignoring reply.`);
      return;
    }

    const aiLatency = Math.round(performance.now() - tAIStart);
    setStageTiming('llm', aiLatency);
    logDebug('AI', `AI response ready in ${aiLatency}ms (${reply.length} chars)`);

    // Step 3: Answer Ready
    AppState.isGenerating = false;
    setPipelineState('ready');
    if (dom.speechText) {
      dom.speechText.textContent = reply;
    }
    updateVRHUDState({ status: 'Ready', text: reply });

    // Step 4: Speaking Reply
    AppState.isSpeaking = true;
    setPipelineState('speaking', '🗣️ Speaking (Tap or speak to interrupt)...');
    updateVRHUDState({ status: '🗣️ Speaking', text: reply });
    setActiveStage('speaking', `Speaking Reply (${AppState.ttsEngine})...`);
    logDebug('TTS', `Speaking reply via ${AppState.ttsEngine}...`);

    // Safety watchdog: auto-clear stuck speaking/generating state if audio hardware hangs
    if (speechSafetyWatchdog) clearTimeout(speechSafetyWatchdog);
    speechSafetyWatchdog = setTimeout(() => {
      if (AppState.isSpeaking || AppState.isGenerating) {
        console.warn('[Orchestrator] Safety watchdog: auto-clearing stuck speaking/generating state');
        AppState.isSpeaking = false;
        AppState.isGenerating = false;
        if (AppState.isLiveMode) {
          startListening();
        }
      }
    }, 20000);

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
      if (speechSafetyWatchdog) {
        clearTimeout(speechSafetyWatchdog);
        speechSafetyWatchdog = null;
      }
      AppState.isSpeaking = false;
      AppState.isGenerating = false;

      if (thisTurnId !== activeTurnSeq) return; // Discard callback if turn was interrupted!

      // Completed speaking reply:
      if (AppState.isLiveMode) {
        if (AppState.echoGuardMode === 'half_duplex') {
          // Half-duplex mode: wait 350ms acoustic cooldown before reopening microphone
          setTimeout(() => {
            if (thisTurnId !== activeTurnSeq) return;
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
          // Full-duplex AEC mode: guarantee microphone and STT engine are listening
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
    if (thisTurnId !== activeTurnSeq) {
      logDebug('AI', `Aborted Turn #${thisTurnId} error suppressed.`);
      return;
    }
    AppState.isGenerating = false;
    AppState.isSpeaking = false;
    console.error('Conversation Error:', err);
    if (dom.speechText) {
      dom.speechText.textContent = `Error: ${err.message}`;
    }
    updateVRHUDState({ status: 'Error', text: err.message });
    setPipelineState('idle');
    stopMicAnalyser();
    if (dom.btnMic) dom.btnMic.classList.remove('listening');
    if (dockController) dockController.updateMicUI(false);
    if (AppState.isLiveMode) {
      setTimeout(() => {
        if (thisTurnId !== activeTurnSeq) return;
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

/**
 * Speaks a brief system or UI announcement (e.g. from modals)
 * Safely coordinates with active turns and restores listening if in Live Mode.
 */
export function speakAnnouncement(text, onComplete) {
  if (!text || !text.trim()) {
    if (onComplete) onComplete();
    return;
  }
  const thisTurnId = abortActiveTurn();
  stopListening();
  stopMicAnalyser();

  const { dom, getDockController } = orchestratorContext;
  const dockController = getDockController();
  if (dom.btnMic) dom.btnMic.classList.remove('listening');
  if (dockController) dockController.updateMicUI(false);

  speakReply(text, () => {
    AppState.isSpeaking = false;
    AppState.isGenerating = false;
    if (thisTurnId !== activeTurnSeq) return;
    if (AppState.isLiveMode) {
      setTimeout(() => {
        if (thisTurnId !== activeTurnSeq) return;
        if (AppState.isLiveMode && !AppState.isSpeaking && !AppState.isGenerating) {
          setPipelineState('listening', 'Live Mode: Listening...');
          if (dom.btnMic) dom.btnMic.classList.add('listening');
          if (dockController) dockController.updateMicUI(true);
          initMicAnalyser((level) => {
            updateMicLevel(level);
          });
          startListening();
        }
      }, 250);
    }
    if (onComplete) onComplete();
  });
}
