// Native Web SpeechSynthesis Wrapper & Viseme Lip-Sync Driver
import { AppState } from '../state.js';
import {
  recordSpokenText,
  clearEchoCooldown,
  getSpokenRegistry,
  isSelfEcho,
  detectUserInterruption,
  setEchoCooldown
} from './echo_guard.js';

let activeUtterance = null;
let onLipSyncCallback = null;
let onStopSpeakingCallback = null;

export function setLipSyncCallback(cb) {
  onLipSyncCallback = cb;
}

export function registerStopSpeakingCallback(cb) {
  onStopSpeakingCallback = cb;
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
  // Mark end of speech and provide 1.5s post-speech echo grace period for trailing STT packets
  setEchoCooldown(1500);

  if (onLipSyncCallback) onLipSyncCallback(0);
  if (onStopSpeakingCallback) {
    try { onStopSpeakingCallback(); } catch (e) {}
  }
}

export function speakReply(text, onComplete) {
  const cleanText = text.replace(/[*#`_~]/g, '').trim();
  if (!cleanText) {
    if (onComplete) onComplete();
    return;
  }

  // Pre-seed spoken utterance history
  recordSpokenText(cleanText);

  if (!('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis not supported.');
    if (onComplete) onComplete(new Error('SpeechSynthesis not supported'));
    return;
  }

  // Cancel any existing utterance before starting new one
  stopSpeaking();

  setTimeout(() => {
    AppState.isSpeaking = true;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const savedVoice = localStorage.getItem('quest_voice_name');
    if (savedVoice) {
      const match = voices.find(v => v.name === savedVoice);
      if (match) utterance.voice = match;
    } else {
      const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google')));
      if (preferred) utterance.voice = preferred;
    }

    utterance.onstart = () => {
      AppState.isSpeaking = true;
    };

    // Mouth / jaw viseme pulsing during speaking
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const charLength = event.charLength || 4;
        const openness = Math.min(1.0, Math.max(0.3, charLength / 6));
        if (onLipSyncCallback) onLipSyncCallback(openness);
      }
    };

    utterance.onend = () => {
      AppState.isSpeaking = false;
      activeUtterance = null;
      setEchoCooldown(2500); // 2.5s post-speech grace window
      if (onLipSyncCallback) onLipSyncCallback(0);
      if (onComplete) onComplete();
    };

    utterance.onerror = (e) => {
      console.warn('TTS error:', e);
      AppState.isSpeaking = false;
      activeUtterance = null;
      setEchoCooldown(1500);
      if (onLipSyncCallback) onLipSyncCallback(0);
      if (onComplete) onComplete(e);
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }, 40);
}

// Re-export echo cancellation functions for backwards compatibility
export {
  recordSpokenText,
  clearEchoCooldown,
  getSpokenRegistry,
  isSelfEcho,
  detectUserInterruption
};
