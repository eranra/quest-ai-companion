// Audio Subsystem Facade & Engine Router (Dual-Engine: Native vs Local Neural Models)
import { AppState } from '../state.js';
import { initMicAnalyser, stopMicAnalyser, getAudioContext } from './vad.js';
import {
  speakReply as nativeSpeakReply,
  stopSpeaking as nativeStopSpeaking,
  isSelfEcho,
  setLipSyncCallback as setNativeLipSyncCallback,
  getSpokenRegistry
} from './tts.js';
import {
  initSpeechRecognition as nativeInitSpeechRecognition,
  startListening as nativeStartListening,
  stopListening as nativeStopListening,
  setLiveMode as nativeSetLiveMode
} from './speech.js';
import {
  initWhisper,
  startListeningWhisper,
  stopListeningWhisper,
  setWhisperHandlers,
  isWhisperReady
} from './whisper.js';
import {
  initNeuralTTS,
  speakNeuralTTS,
  stopNeuralTTS,
  setNeuralLipSyncCallback,
  isNeuralTTSReady,
  isNeuralTTSLoading
} from './neural_tts.js';

let audioUnlocked = false;

export function unlockAudio() {
  if (audioUnlocked) return;
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        const dummy = new SpeechSynthesisUtterance(' ');
        dummy.volume = 0.01;
        window.speechSynthesis.speak(dummy);
      }
    }
    audioUnlocked = true;
  } catch (e) {}
}

/**
 * Initializes speech recognition handlers across both Native and Whisper engines
 */
export function initSpeechRecognition(handlers) {
  nativeInitSpeechRecognition(handlers);
  setWhisperHandlers(handlers);
  return true;
}

/**
 * Starts listening using active STT engine (Whisper WebGPU vs Browser Native)
 */
export function startListening() {
  if (AppState.sttEngine === 'whisper') {
    startListeningWhisper();
  } else {
    nativeStartListening();
  }
}

/**
 * Stops listening and releases hardware across active engines
 */
export function stopListening(finalize = false) {
  stopListeningWhisper(finalize);
  nativeStopListening();
}

/**
 * Updates Live Mode state across active engines
 */
export function setLiveMode(enabled) {
  AppState.isLiveMode = enabled;
  if (AppState.sttEngine === 'whisper') {
    // When using Whisper STT, ensure Native SpeechRecognition is completely stopped
    nativeStopListening();
  } else {
    nativeSetLiveMode(enabled);
  }
}

/**
 * Speaks AI reply using active TTS engine with automatic fallback
 */
export function speakReply(text, onComplete) {
  if (AppState.ttsEngine === 'neural') {
    speakNeuralTTS(text, onComplete);
  } else {
    nativeSpeakReply(text, (err) => {
      if (err) {
        console.warn('Native TTS encountered error/missing voices. Falling back to Neural TTS:', err);
        speakNeuralTTS(text, onComplete);
      } else if (onComplete) {
        onComplete();
      }
    });
  }
}

/**
 * Halts speaking immediately across both Native and Neural TTS engines
 */
export function stopSpeaking() {
  stopNeuralTTS();
  nativeStopSpeaking();
}

/**
 * Registers 3D avatar lip-sync mouth animation callback
 */
export function setLipSyncCallback(cb) {
  setNativeLipSyncCallback(cb);
  setNeuralLipSyncCallback(cb);
}

export {
  initMicAnalyser,
  stopMicAnalyser,
  getAudioContext,
  isSelfEcho,
  getSpokenRegistry,
  initWhisper,
  isWhisperReady,
  initNeuralTTS,
  isNeuralTTSReady,
  isNeuralTTSLoading
};
