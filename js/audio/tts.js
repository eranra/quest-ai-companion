// Text-To-Speech Synthesis Controller & Spoken Lexicon Registry
import { AppState } from '../state.js';

let activeUtterance = null;
let activeSpokenText = '';
let activeSpokenWords = [];
let echoCooldownUntil = 0;
let onLipSyncCallback = null;

export function setLipSyncCallback(cb) {
  onLipSyncCallback = cb;
}

export function getSpokenRegistry() {
  return {
    activeSpokenText,
    activeSpokenWords,
    echoCooldownUntil
  };
}

export function isSelfEcho(transcript) {
  if (AppState.echoGuardMode === 'off') return false;
  if (!activeSpokenText && activeSpokenWords.length === 0) return false;
  if (!transcript || !transcript.trim()) return true;

  const candidateNorm = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const candidateWords = candidateNorm.split(/\s+/).filter(w => w.length > 1);
  if (candidateWords.length === 0) return true;

  const spokenNorm = activeSpokenText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();

  // 1. Substring match
  if (candidateNorm.length > 3 && spokenNorm.includes(candidateNorm)) {
    return true;
  }

  // 2. Lexical word overlap check
  let matches = 0;
  for (const word of candidateWords) {
    if (activeSpokenWords.includes(word)) {
      matches++;
    }
  }

  const overlap = matches / candidateWords.length;
  return overlap >= 0.38;
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
  activeSpokenText = '';
  activeSpokenWords = [];
  if (onLipSyncCallback) onLipSyncCallback(0);
}

export function speakReply(text, onComplete) {
  const cleanText = text.replace(/[*#`_~]/g, '').trim();
  if (!cleanText) {
    if (onComplete) onComplete();
    return;
  }

  // Register spoken words for Anti-Self-Echo cancellation
  activeSpokenText = cleanText;
  activeSpokenWords = cleanText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);

  stopSpeaking();

  activeSpokenText = cleanText;
  activeSpokenWords = cleanText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);

  if (!('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis not available in browser');
    if (onComplete) onComplete();
    return;
  }

  AppState.isSpeaking = true;

  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

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
      echoCooldownUntil = Date.now() + 850;
      if (onLipSyncCallback) onLipSyncCallback(0);
      if (onComplete) onComplete();
    };

    utterance.onerror = (e) => {
      console.warn('TTS error:', e);
      AppState.isSpeaking = false;
      activeUtterance = null;
      echoCooldownUntil = Date.now() + 500;
      if (onLipSyncCallback) onLipSyncCallback(0);
      if (onComplete) onComplete();
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }, 30);
}
