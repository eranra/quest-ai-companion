// Silent Continuous Speech Recognition Engine with Barge-In & Acoustic Loopback Guard
import { AppState } from '../state.js';
import { isSelfEcho, stopSpeaking, getSpokenRegistry } from './tts.js';
import { abortActiveGeneration } from '../ai.js';

let recognition = null;
let currentTranscript = '';
let silenceTimer = null;
let onSpeechFinishedCallback = null;
let onSpeechInterimCallback = null;
let onStatusChangeCallback = null;
let isExplicitlyStopped = false;
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
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    AppState.isListening = true;
    if (onStatusChangeCallback) {
      onStatusChangeCallback('listening');
    }
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }

    currentTranscript = (final || interim).trim();
    if (!currentTranscript) return;

    // 1. Acoustic Loopback Filter (Self-Speech)
    const spoken = getSpokenRegistry();
    const isAssistantTalking = AppState.isSpeaking || AppState.isGenerating || Date.now() < spoken.echoCooldownUntil;
    
    // In strict half-duplex, ignore all mic input while assistant is active
    if (AppState.echoGuardMode === 'half_duplex' && isAssistantTalking) {
      currentTranscript = '';
      if (silenceTimer) clearTimeout(silenceTimer);
      return;
    }

    // In smart mode, test if incoming transcript is the assistant's own voice
    if (isAssistantTalking && isSelfEcho(currentTranscript)) {
      currentTranscript = '';
      if (silenceTimer) clearTimeout(silenceTimer);
      return;
    }

    // 2. Sensitivity Thresholds
    const sensitivity = AppState.liveSensitivity || 'normal';
    let minBargeInChars = 5;
    let minFinalChars = 4;
    let silenceDelay = 1200;

    if (sensitivity === 'high_filter') {
      minBargeInChars = 8;
      minFinalChars = 6;
      silenceDelay = 1400;
    } else if (sensitivity === 'sensitive') {
      minBargeInChars = 3;
      minFinalChars = 2;
      silenceDelay = 900;
    }

    const words = currentTranscript.split(/\s+/).filter(w => w.length > 0);

    // 3. Barge-In Interruption (User cuts off avatar mid-sentence)
    if (AppState.isSpeaking || AppState.isGenerating) {
      const isRealUserSpeech = (currentTranscript.length >= minBargeInChars || words.length >= 2) && !isSelfEcho(currentTranscript);
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

    if (onSpeechInterimCallback) {
      onSpeechInterimCallback(currentTranscript);
    }

    // 4. Silence Detection (Pause triggers sentence finalization)
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      const candidate = currentTranscript.trim();
      const candidateWords = candidate.split(/\s+/).filter(w => w.length > 0);
      if (candidate.length >= minFinalChars && candidateWords.length >= 1) {
        if (isSelfEcho(candidate)) {
          currentTranscript = '';
          return;
        }
        currentTranscript = '';
        if (onSpeechFinishedCallback) {
          onSpeechFinishedCallback(candidate);
        }
      }
    }, silenceDelay);
  };

  recognition.onerror = (event) => {
    // Ignore benign errors like 'no-speech' or 'aborted' without crashing
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
    // In Live Mode, safely maintain continuous session without rapid beep thrashing
    if (AppState.isLiveMode && !isExplicitlyStopped) {
      if (restartBackoffTimer) clearTimeout(restartBackoffTimer);
      // Wait for any active speech output to finish before reviving recognizer
      const delay = AppState.isSpeaking ? 500 : 350;
      restartBackoffTimer = setTimeout(() => {
        if (AppState.isLiveMode && !isExplicitlyStopped && !AppState.isSpeaking) {
          try {
            recognition.start();
          } catch (e) {}
        }
      }, delay);
    } else {
      if (onStatusChangeCallback && !AppState.isSpeaking) {
        onStatusChangeCallback('idle');
      }
    }
  };

  return true;
}

export function startListening() {
  isExplicitlyStopped = false;
  if (recognition) {
    try {
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
