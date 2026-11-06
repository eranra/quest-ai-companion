// Audio Pipeline: Speech Synthesis (TTS), Web Speech Recognition, and Gemini Live-Style Continuous Conversation with Barge-In
import { AppState } from './state.js';
import { abortActiveGeneration } from './ai.js';

let activeUtterance = null;
let recognition = null;
let silenceTimer = null;
let currentTranscript = '';
let onSpeechFinishedCallback = null;
let onSpeechInterimCallback = null;
let onStatusChangeCallback = null;
let audioCtx = null;

// Unlocks browser Web Audio & Speech Synthesis autoplay restrictions on Mobile & Quest
export function unlockAudio() {
  try {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      // Prime mobile audio pipeline with a 0-volume utterance if idle
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        const dummy = new SpeechSynthesisUtterance(' ');
        dummy.volume = 0.01;
        window.speechSynthesis.speak(dummy);
      }
    }
  } catch (e) {}
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (e) {}
  }
  AppState.isSpeaking = false;
  activeUtterance = null;
}

export function speakReply(text, onComplete) {
  const cleanText = text.replace(/[*#`_~]/g, '').trim();
  if (!cleanText) {
    if (onComplete) onComplete();
    return;
  }

  unlockAudio();
  stopSpeaking();

  if (!('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis not available');
    if (onComplete) onComplete();
    return;
  }

  // Small delay to ensure previous cancel completed
  setTimeout(() => {
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (e) {}

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.02;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Pick voice
    const voices = window.speechSynthesis.getVoices();
    const selectedVoiceName = localStorage.getItem('quest_voice_name');
    const matched = voices.find(v => v.name === selectedVoiceName);
    if (matched) {
      utterance.voice = matched;
    } else {
      const defaultEn = voices.find(v => v.lang.startsWith('en'));
      if (defaultEn) utterance.voice = defaultEn;
    }

    utterance.onstart = () => {
      AppState.isSpeaking = true;
      AppState.isListening = false;
      if (onStatusChangeCallback) onStatusChangeCallback('Speaking...', 'speaking');
    };

    utterance.onend = () => {
      AppState.isSpeaking = false;
      activeUtterance = null;
      if (onStatusChangeCallback) {
        onStatusChangeCallback(AppState.isLiveMode ? 'Listening (Live)...' : 'Ready', AppState.isLiveMode ? 'listening' : '');
      }
      if (onComplete) onComplete();
    };

    utterance.onerror = (e) => {
      console.warn('TTS error:', e);
      AppState.isSpeaking = false;
      activeUtterance = null;
      if (onStatusChangeCallback) onStatusChangeCallback('Ready', '');
      if (onComplete) onComplete();
    };

    activeUtterance = utterance; // Prevent GC in Chromium
    window.speechSynthesis.speak(utterance);
  }, 30);
}

// -------------------------------------------------------------
// Continuous Speech Recognition & Gemini Live Barge-In
// -------------------------------------------------------------
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
      onStatusChangeCallback(AppState.isLiveMode ? 'Live Mode: Listening...' : 'Listening...', 'listening');
    }
  };

  recognition.onresult = (event) => {
    // BARGE-IN INTERRUPTION (Gemini Live Behavior):
    // If the user starts speaking while the avatar is speaking or generating, immediately cut in!
    if (AppState.isSpeaking || AppState.isGenerating) {
      stopSpeaking();
      abortActiveGeneration();
      AppState.isListening = true;
      if (onStatusChangeCallback) {
        onStatusChangeCallback('Listening to you...', 'listening');
      }
    }

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

    if (onSpeechInterimCallback && currentTranscript) {
      onSpeechInterimCallback(currentTranscript);
    }

    // Silence detection: when user pauses for 1.3 seconds, finalize sentence
    if (currentTranscript) {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (currentTranscript && currentTranscript.trim().length > 1) {
          const finishedSpeech = currentTranscript.trim();
          currentTranscript = '';
          if (onSpeechFinishedCallback) {
            onSpeechFinishedCallback(finishedSpeech);
          }
        }
      }, 1300);
    }
  };

  recognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      AppState.isListening = false;
      AppState.isLiveMode = false;
      if (onStatusChangeCallback) onStatusChangeCallback('Mic blocked', '');
    }
  };

  recognition.onend = () => {
    AppState.isListening = false;
    // In Live Mode, continuously restart recognition as long as Live Mode is enabled
    if (AppState.isLiveMode) {
      setTimeout(() => {
        if (AppState.isLiveMode && !AppState.isSpeaking) {
          try {
            recognition.start();
          } catch (e) {}
        }
      }, 200);
    } else {
      if (onStatusChangeCallback && !AppState.isSpeaking) {
        onStatusChangeCallback('Ready', '');
      }
    }
  };

  return true;
}

export function startListening() {
  unlockAudio();
  if (recognition) {
    try {
      recognition.start();
    } catch (e) {
      // Already running
    }
  }
}

export function stopListening() {
  if (silenceTimer) clearTimeout(silenceTimer);
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
    unlockAudio();
    startListening();
  } else {
    stopListening();
  }
}
