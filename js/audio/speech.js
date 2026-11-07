// Robust Speech Recognition Engine: Dual-Mode (Push-to-Talk vs Always-On Live Mode)
import { AppState } from '../state.js';
import { isSelfEcho, stopSpeaking, getSpokenRegistry } from './tts.js';
import { abortActiveGeneration } from '../ai.js';

let recognition = null;
let currentTranscript = '';
let silenceTimer = null;
let onSpeechFinishedCallback = null;
let onSpeechInterimCallback = null;
let onStatusChangeCallback = null;
let isExplicitlyStopped = true;
let restartBackoffTimer = null;

export function initSpeechRecognition(handlers) {
  onSpeechFinishedCallback = handlers.onFinalSpeech;
  onSpeechInterimCallback = handlers.onInterimSpeech;
  onStatusChangeCallback = handlers.onStatusChange;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('SpeechRecognition API not available in this browser.');
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.interimResults = true;
  recognition.lang = AppState.speechLang || 'en-US';
  recognition.continuous = !!AppState.isLiveMode;

  recognition.onstart = () => {
    AppState.isListening = true;
    currentTranscript = '';
    if (onStatusChangeCallback) {
      onStatusChangeCallback('listening');
    }
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (res && res[0]) {
        const transcript = res[0].transcript || '';
        if (res.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
    }

    const candidate = (final || interim).trim();
    if (!candidate) return;
    currentTranscript = candidate;

    // 1. Acoustic Loopback / Echo Guard: ONLY test if assistant is actively speaking or reverberation cooldown is active
    const spoken = getSpokenRegistry();
    const isAssistantTalking = AppState.isSpeaking || AppState.isGenerating || Date.now() < (spoken.echoCooldownUntil || 0);

    if (isAssistantTalking) {
      // In strict half-duplex mode, ignore all mic input while assistant is active
      if (AppState.echoGuardMode === 'half_duplex') {
        currentTranscript = '';
        if (silenceTimer) clearTimeout(silenceTimer);
        return;
      }

      // In smart mode, test if incoming transcript is the assistant's own voice
      if (isSelfEcho(currentTranscript)) {
        currentTranscript = '';
        if (silenceTimer) clearTimeout(silenceTimer);
        return;
      }
    }

    // 2. Barge-In Interruption in Live Mode (User interrupts speaking avatar)
    if (AppState.isSpeaking || AppState.isGenerating) {
      const words = currentTranscript.split(/\s+/).filter(w => w.length > 0);
      const isRealUserSpeech = (currentTranscript.length >= 4 || words.length >= 2) && !isSelfEcho(currentTranscript);
      if (isRealUserSpeech) {
        stopSpeaking();
        abortActiveGeneration();
        AppState.isListening = true;
        if (onStatusChangeCallback) {
          onStatusChangeCallback('listening');
        }
      } else {
        return;
      }
    }

    // Real-time interim feedback for UI
    if (onSpeechInterimCallback) {
      onSpeechInterimCallback(currentTranscript);
    }

    // 3. Immediate Sentence Finalization:
    // A. Engine reported isFinal = true (clean phrase completion)
    if (final && final.trim().length >= 2) {
      const completedText = final.trim();
      currentTranscript = '';
      if (silenceTimer) clearTimeout(silenceTimer);

      // In Regular Mode (Push-to-Talk): immediately stop recognition so mic closes
      if (!AppState.isLiveMode) {
        stopListening();
      }

      if (onSpeechFinishedCallback) {
        onSpeechFinishedCallback(completedText);
      }
      return;
    }

    // B. Interim pause / silence detection
    const sensitivity = AppState.liveSensitivity || 'normal';
    let silenceDelay = AppState.isLiveMode ? 1100 : 750;
    if (sensitivity === 'high_filter') silenceDelay += 300;
    if (sensitivity === 'sensitive') silenceDelay -= 200;

    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      const pendingText = currentTranscript.trim();
      if (pendingText.length >= 2) {
        currentTranscript = '';
        if (!AppState.isLiveMode) {
          stopListening();
        }
        if (onSpeechFinishedCallback) {
          onSpeechFinishedCallback(pendingText);
        }
      }
    }, silenceDelay);
  };

  recognition.onerror = (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') {
      return;
    }
    console.warn('SpeechRecognition error:', event.error);
    if (event.error === 'not-allowed') {
      AppState.isListening = false;
      if (onStatusChangeCallback) onStatusChangeCallback('mic-denied');
    }
  };

  recognition.onend = () => {
    AppState.isListening = false;

    // Safety fallback: if recognizer ended with unsubmitted text, dispatch it immediately
    if (currentTranscript && currentTranscript.trim().length >= 2) {
      const pendingText = currentTranscript.trim();
      currentTranscript = '';
      if (silenceTimer) clearTimeout(silenceTimer);
      if (onSpeechFinishedCallback) {
        onSpeechFinishedCallback(pendingText);
      }
    }

    // Live Mode: automatically maintain continuous listening session
    if (AppState.isLiveMode && !isExplicitlyStopped) {
      if (restartBackoffTimer) clearTimeout(restartBackoffTimer);
      const delay = AppState.isSpeaking ? 600 : 250;
      restartBackoffTimer = setTimeout(() => {
        if (AppState.isLiveMode && !isExplicitlyStopped && !AppState.isSpeaking) {
          try {
            recognition.continuous = true;
            recognition.start();
          } catch (e) {}
        }
      }, delay);
    } else {
      // Regular Mode (Push-to-Talk): stays idle after single utterance
      if (onStatusChangeCallback && !AppState.isSpeaking && !AppState.isGenerating) {
        onStatusChangeCallback('idle');
      }
    }
  };

  return true;
}

export function startListening() {
  isExplicitlyStopped = false;
  currentTranscript = '';
  if (silenceTimer) clearTimeout(silenceTimer);
  if (restartBackoffTimer) clearTimeout(restartBackoffTimer);

  if (recognition) {
    try {
      // Regular Mode: continuous = false (auto-stops at sentence end)
      // Live Mode: continuous = true (stays open indefinitely)
      recognition.continuous = !!AppState.isLiveMode;
      recognition.interimResults = true;
      recognition.lang = AppState.speechLang || 'en-US';
      recognition.start();
    } catch (e) {
      // Already running
    }
  }
}

export function stopListening() {
  isExplicitlyStopped = true;
  if (silenceTimer) clearTimeout(silenceTimer);
  if (restartBackoffTimer) clearTimeout(restartBackoffTimer);
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {}
  }
  AppState.isListening = false;
  if (onStatusChangeCallback && !AppState.isSpeaking && !AppState.isGenerating) {
    onStatusChangeCallback('idle');
  }
}

export function setLiveMode(enabled) {
  AppState.isLiveMode = enabled;
  AppState.save();

  if (enabled) {
    isExplicitlyStopped = false;
    startListening();
  } else {
    stopListening();
  }
}
