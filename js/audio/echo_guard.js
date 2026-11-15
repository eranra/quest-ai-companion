// Multi-Tier Acoustic Echo Cancellation (AEC) & Barge-In Detection Registry
// Prevents assistant speaker audio, room reverberation, and cloud STT feedback loops from looping into LLM
import { AppState } from '../state.js';

let activeSpokenText = '';
let activeSpokenWords = [];
let echoCooldownUntil = 0;

// Rolling FIFO Spoken Utterance History (retained for 15 seconds)
const spokenHistory = []; // { rawText, normText, wordSet: Set<string>, ngrams: Set<string>, timestamp, finishedAt }

/**
 * Normalizes text to lowercase alphanumeric space-delimited string
 */
export function normalizeText(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extracts word tokens of length >= 2
 */
export function extractWordTokens(normText) {
  return normText.split(' ').filter(w => w.length >= 2);
}

/**
 * Generates 2-word, 3-word, and 4-word ngrams
 */
export function extractNgrams(words) {
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
export function pruneSpokenHistory() {
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

export function clearEchoCooldown() {
  echoCooldownUntil = 0;
}

export function setEchoCooldown(graceMs = 1500) {
  echoCooldownUntil = Date.now() + graceMs;
  if (spokenHistory.length > 0) {
    spokenHistory[spokenHistory.length - 1].finishedAt = Date.now();
  }
}

export function getEchoCooldownUntil() {
  return echoCooldownUntil;
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
export function isSelfEcho(transcript, referenceText) {
  if (referenceText) {
    recordSpokenText(referenceText);
  }
  if (AppState.echoGuardMode === 'off') return false;
  if (!transcript || !transcript.trim()) return false;

  // Genuine user interruptions or stop commands are NEVER self-echo!
  const interruption = detectUserInterruption(transcript);
  if (interruption.isInterruption) {
    return false;
  }

  pruneSpokenHistory();
  if (spokenHistory.length === 0 && !activeSpokenText) return false;

  const now = Date.now();
  const candNorm = normalizeText(transcript);
  const candWords = extractWordTokens(candNorm);
  if (candWords.length === 0) return false;

  const isAssistantActive = referenceText || AppState.isSpeaking || AppState.isGenerating || now < echoCooldownUntil;

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

    // Tier 3: Lexical Token Overlap while active (filter common stop words so natural phrases aren't dropped)
    const STOP_WORDS = new Set(['the','a','an','is','it','to','in','on','at','and','or','you','i','we','of','for','with','as','be','do']);
    const allSpokenWords = new Set();
    for (const entry of spokenHistory) {
      for (const w of entry.wordSet) {
        allSpokenWords.add(w);
      }
    }

    const contentWords = candWords.filter(w => !STOP_WORDS.has(w));
    if (contentWords.length > 0) {
      let matchCount = 0;
      for (const w of contentWords) {
        if (allSpokenWords.has(w)) matchCount++;
      }
      const overlapRatio = matchCount / contentWords.length;
      if (contentWords.length <= 2 && matchCount >= 1 && overlapRatio >= 0.5) return true;
      if (contentWords.length >= 3 && overlapRatio >= 0.6) return true;
    }
  }

  return false;
}

/**
 * Distinguishes true user interruption from speaker echo while avatar is talking.
 * Returns: { isInterruption: boolean, isStopCommand: boolean, novelWords: string[] }
 */
export function detectUserInterruption(transcript, referenceText) {
  if (referenceText) {
    recordSpokenText(referenceText);
  }
  if (!transcript || !transcript.trim()) {
    return { isInterruption: false, isStopCommand: false, novelWords: [] };
  }

  const clean = transcript.trim();
  const candNorm = normalizeText(clean);
  const candWords = extractWordTokens(candNorm);
  if (candWords.length === 0) {
    return { isInterruption: false, isStopCommand: false, novelWords: [] };
  }

  // 1. Explicit verbal stop commands
  const stopWordRegex = /\b(stop|pause|wait|cancel|shut\s*up|be\s*quiet|hush|silence|hold\s*on|enough|stop\s*talking)\b/i;
  const hasStopWord = stopWordRegex.test(clean);

  // 2. Novel word comparison against actively spoken text
  const currentWords = new Set();
  if (spokenHistory.length > 0) {
    const latest = spokenHistory[spokenHistory.length - 1];
    for (const w of latest.wordSet) currentWords.add(w);
  }

  const novelWords = candWords.filter(w => !currentWords.has(w) && w.length >= 2);

  // If candidate has a stop command and is brief (<= 4 words, e.g. "stop", "alex stop", "stop talking please"), it is a pure stop command
  if (hasStopWord && candWords.length <= 4) {
    return { isInterruption: true, isStopCommand: true, novelWords: candWords };
  }

  // If candidate has a stop command followed by a new instruction (e.g. "Wait, count 1 to 5 instead")
  if (hasStopWord && candWords.length > 4) {
    return { isInterruption: true, isStopCommand: false, novelWords };
  }

  // If candidate contains at least 2 novel words that assistant never spoke in current utterance:
  // It is a genuine user interruption asking a new question or giving a command!
  if (novelWords.length >= 2) {
    return { isInterruption: true, isStopCommand: false, novelWords };
  }

  // If candidate contains at least 1 novel word and has total length >= 3 words
  if (novelWords.length >= 1 && candWords.length >= 3) {
    return { isInterruption: true, isStopCommand: false, novelWords };
  }

  return { isInterruption: false, isStopCommand: false, novelWords: [] };
}
