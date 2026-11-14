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
  warmVoice,
  speakNeuralTTS,
  stopNeuralTTS,
  setNeuralLipSyncCallback,
  isNeuralTTSReady,
  isNeuralTTSLoading,
  splitIntoSentences,
  getActiveVoiceId,
  setActiveVoiceId,
  PIPER_VOICE_CONFIGS,
  AVATAR_DEFAULT_VOICES,
  getDefaultVoiceForAvatar
} from './neural_tts.js';
import {
  speakRemoteTTS,
  stopRemoteTTS,
  setRemoteLipSyncCallback
} from './remote_tts.js';

let audioUnlocked = false;

export function unlockAudio() {
  if (audioUnlocked) return;
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Unlock HTML5 Audio for Meta Quest Browser
    const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    silentAudio.volume = 0.01;
    silentAudio.play().catch(() => {});

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
  // 1. If connected to Standalone PC Server, use accelerated parallel remote TTS
  if (AppState.engine === 'remote' && AppState.remoteServerStatus === 'online') {
    speakRemoteTTS(text, (err) => {
      if (err) {
        console.warn('Remote TTS fallback to Neural/Native:', err);
        speakNeuralTTS(text, onComplete);
      } else if (onComplete) {
        onComplete();
      }
    });
    return;
  }

  // 2. Local Neural TTS vs Browser Native Speech
  const hasNativeVoices = ('speechSynthesis' in window) && window.speechSynthesis.getVoices().length > 0;
  if (AppState.ttsEngine === 'neural' || !hasNativeVoices) {
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
 * Halts speaking immediately across Remote, Neural, and Native TTS engines
 */
export function stopSpeaking() {
  stopRemoteTTS();
  stopNeuralTTS();
  nativeStopSpeaking();
}

/**
 * Registers 3D avatar lip-sync mouth animation callback
 */
export function setLipSyncCallback(cb) {
  setNativeLipSyncCallback(cb);
  setNeuralLipSyncCallback(cb);
  setRemoteLipSyncCallback(cb);
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
  warmVoice,
  isNeuralTTSReady,
  isNeuralTTSLoading,
  splitIntoSentences,
  getActiveVoiceId,
  setActiveVoiceId,
  PIPER_VOICE_CONFIGS,
  AVATAR_DEFAULT_VOICES,
  getDefaultVoiceForAvatar,
  speakRemoteTTS,
  stopRemoteTTS
};

export {
  AMBIENT_TRACKS,
  initAmbientMusic,
  playCurrentTrack,
  stopCurrentTrack,
  setMusicVolume,
  getMusicVolume,
  toggleMusicMute,
  setMusicMuted,
  isMusicMuted,
  setMusicAutoMode,
  getMusicAutoMode,
  selectTrackById,
  nextTrack,
  prevTrack,
  getMusicStatus,
  getMusicHUDLabel
} from './ambient_music.js';
