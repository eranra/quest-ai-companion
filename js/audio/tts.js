// Text-To-Speech Synthesis Controller & Multi-Tier Acoustic Echo Registry
import { AppState } from '../state.js';

let activeUtterance = null;
let activeSpokenText = '';
let activeSpokenWords = [];
let echoCooldownUntil = 0;
let onLipSyncCallback = null;

// Rolling FIFO Spoken Utterance History (retained for 15 seconds)
// Prevents slow cloud STT or room acoustic reverberation from looping into the LLM
const spokenHistory = []; // { rawText, normText, wordSet: Set<string>, ngrams: Set<string>, timestamp, finishedAt }

export function setLipSyncCallback(cb) {
  onLipSyncCallback = cb;
}

/**
 * Normalizes text to lowercase alphanumeric space-delimited string
 */
function normalizeText(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extracts word tokens of length >= 2
 */
function extractWordTokens(normText) {
  return normText.split(' ').filter(w => w.length >= 2);
}

/**
 * Generates 2-word, 3-word, and 4-word ngrams
 */
function extractNgrams(words) {
  const ngrams = new Set();
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.add(words.slice(i, i + n).join(' '));
    }
  }
  return ngrams;
}

/**
 * Prunes history older than 15 seconds and keeps at most 6 recent utterances
 */
function pruneSpokenHistory() {
  const now = Date.now();
  const maxAge = 15000;
  while (spokenHistory.length > 0 && (now - spokenHistory[0].timestamp > maxAge || spokenHistory.length > 6)) {
    spokenHistory.shift();
  }
}

/**
 * Records spoken text into rolling history
 */
export function recordSpokenText(cleanText) {
  pruneSpokenHistory();
  const normText = normalizeText(cleanText);
  const words = extractWordTokens(normText);
  const wordSet = new Set(words);
  const ngrams = extractNgrams(words);

  const entry = {
    rawText: cleanText,
    normText,
    wordSet,
    words,
    ngrams,
    timestamp: Date.now(),
    finishedAt: 0
  };

  spokenHistory.push(entry);
  activeSpokenText = cleanText;
  activeSpokenWords = words;
}

export function getSpokenRegistry() {
  return {
    activeSpokenText,
    activeSpokenWords,
    echoCooldownUntil,
    historyCount: spokenHistory.length
  };
}

/**
 * Multi-Tier Acoustic Echo Cancellation (AEC) detector.
 * Tests whether candidate transcript is an acoustic feedback loop of assistant's speech.
 */
export function isSelfEcho(transcript) {
  if (AppState.echoGuardMode === 'off') return false;
  if (!transcript || !transcript.trim()) return false;

  pruneSpokenHistory();
  if (spokenHistory.length === 0 && !activeSpokenText) return false;

  const now = Date.now();
  const candNorm = normalizeText(transcript);
  const candWords = extractWordTokens(candNorm);
  if (candWords.length === 0) return false;

  const isAssistantActive = AppState.isSpeaking || AppState.isGenerating || now < echoCooldownUntil;

  // Echo detection: physical speaker sound can ONLY reach microphone while assistant is active or in cooldown!
  if (isAssistantActive) {
    // Tier 1: Substring / Phrase Inclusion against recent active utterances
    for (let i = spokenHistory.length - 1; i >= 0; i--) {
      const entry = spokenHistory[i];
      if (candNorm.length >= 4 && (entry.normText.includes(candNorm) || candNorm.includes(entry.normText))) {
        return true;
      }
    }

    // Tier 2: N-gram Match (Consecutive 2 or 3 words)
    const candNgrams = extractNgrams(candWords);
    for (let i = spokenHistory.length - 1; i >= 0; i--) {
      const entry = spokenHistory[i];
      for (const ng of candNgrams) {
        if (entry.ngrams.has(ng)) {
          // If candidate is short (<= 3 words) and has an ngram match -> definite echo
          if (candWords.length <= 3) return true;
          // If longer candidate matches a 3-word or 4-word phrase -> definite echo
          if (ng.split(' ').length >= 3) return true;
        }
      }
    }

    // Tier 3: Lexical Token Overlap while active
    const allSpokenWords = new Set();
    for (const entry of spokenHistory) {
      for (const w of entry.wordSet) {
        allSpokenWords.add(w);
      }
    }

    let matchCount = 0;
    for (const w of candWords) {
      if (allSpokenWords.has(w)) {
        matchCount++;
      }
    }

    const overlapRatio = matchCount / candWords.length;
    // If 1-2 words and any of them match assistant speech -> echo
    if (candWords.length <= 2 && matchCount >= 1) return true;
    // If >= 3 words and at least 30% match assistant speech -> echo
    if (overlapRatio >= 0.30) return true;
  }

  return false;
}

/**
 * Distinguishes true user interruption from speaker echo while avatar is talking.
 * Returns: { isInterruption: boolean, isStopCommand: boolean, novelWords: string[] }
 */
export function detectUserInterruption(transcript) {
  if (!transcript || !transcript.trim()) {
    return { isInterruption: false, isStopCommand: false, novelWords: [] };
  }

  const clean = transcript.trim();
  const candNorm = normalizeText(clean);
  const candWords = extractWordTokens(candNorm);

  // 1. Explicit verbal stop commands
  const stopRegex = /^(stop|pause|wait|cancel|shut\s*up|be\s*quiet|hush|silence|hold\s*on|enough)\b/i;
  if (stopRegex.test(clean)) {
    return { isInterruption: true, isStopCommand: true, novelWords: candWords };
  }

  // 2. Novel word comparison against actively spoken text
  const currentWords = new Set();
  if (spokenHistory.length > 0) {
    const latest = spokenHistory[spokenHistory.length - 1];
    for (const w of latest.wordSet) currentWords.add(w);
  }

  const novelWords = candWords.filter(w => !currentWords.has(w) && w.length >= 3);

  // If the candidate contains at least 2 novel words that the assistant never spoke:
  // It is a genuine user interruption asking a new question or giving a command!
  if (novelWords.length >= 2) {
    return { isInterruption: true, isStopCommand: false, novelWords };
  }

  return { isInterruption: false, isStopCommand: false, novelWords: [] };
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
  // Mark end of speech and provide 2.5s post-speech echo grace period for trailing STT packets
  echoCooldownUntil = Date.now() + 2500;
  if (spokenHistory.length > 0) {
    spokenHistory[spokenHistory.length - 1].finishedAt = Date.now();
  }
  if (onLipSyncCallback) onLipSyncCallback(0);
}

export function speakReply(text, onComplete) {
  const cleanText = text.replace(/[*#`_~]/g, '').trim();
  if (!cleanText) {
    if (onComplete) onComplete();
    return;
  }

  // Stop previous and record clean text in rolling spoken lexicon
  stopSpeaking();
  recordSpokenText(cleanText);

  if (!('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis not available in browser');
    if (onComplete) onComplete(new Error('SpeechSynthesis not supported'));
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
      echoCooldownUntil = Date.now() + 2500; // 2.5s post-speech grace window
      if (spokenHistory.length > 0) {
        spokenHistory[spokenHistory.length - 1].finishedAt = Date.now();
      }
      if (onLipSyncCallback) onLipSyncCallback(0);
      if (onComplete) onComplete();
    };

    utterance.onerror = (e) => {
      console.warn('TTS error:', e);
      AppState.isSpeaking = false;
      activeUtterance = null;
      echoCooldownUntil = Date.now() + 1500;
      if (spokenHistory.length > 0) {
        spokenHistory[spokenHistory.length - 1].finishedAt = Date.now();
      }
      if (onLipSyncCallback) onLipSyncCallback(0);
      if (onComplete) onComplete(e);
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }, 40);
}
