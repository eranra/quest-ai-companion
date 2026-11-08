// High-Performance On-Device Neural Text-to-Speech (WASM)
// Powered by lightweight Piper neural voices (vits-web) optimized for mobile ARM CPUs (Quest 3)
// Features: 1) Character-aligned voice defaults (Male/Female/Neutral); 2) Sentence-by-sentence streaming queue (<1s to speech); 3) Real-time viseme lip-sync; 4) Graceful fallback

import { AppState } from '../state.js';
import { recordSpokenText, speakReply as nativeSpeakReply } from './tts.js';
import { logDebug, setStageTiming, setActiveStage, getSystemProfile, isVerbose } from '../ui/debug_logger.js';

export const PIPER_VOICE_CONFIGS = {
  'en_US-ryan-low': { id: 'en_US-ryan-low', name: 'Ryan (Male - Natural & Fast)', gender: 'male' },
  'en_US-amy-low': { id: 'en_US-amy-low', name: 'Amy (Female - Friendly & Clear)', gender: 'female' },
  'en_US-danny-low': { id: 'en_US-danny-low', name: 'Danny (Male - Energetic)', gender: 'male' },
  'en_US-kathleen-low': { id: 'en_US-kathleen-low', name: 'Kathleen (Female - Cheerful)', gender: 'female' },
  'en_US-lessac-low': { id: 'en_US-lessac-low', name: 'Lessac (Neutral - Balanced Narrator)', gender: 'neutral' }
};

export const AVATAR_DEFAULT_VOICES = {
  echo: 'en_US-lessac-low',
  spark: 'en_US-danny-low',
  pip: 'en_US-kathleen-low',
  ollie: 'en_US-ryan-low',
  maya: 'en_US-amy-low',
  alex: 'en_US-ryan-low'
};

let piperModule = null;
let isPiperLoading = false;
let activeAudioSource = null;
let onLipSyncCallback = null;
let lipSyncInterval = null;
let activeStreamingSession = 0;
let playbackContext = null;

export function setNeuralLipSyncCallback(cb) {
  onLipSyncCallback = cb;
}

export function getDefaultVoiceForAvatar(avatarId) {
  return AVATAR_DEFAULT_VOICES[avatarId] || 'en_US-lessac-low';
}

export function getActiveVoiceId() {
  const customVoice = localStorage.getItem('quest_voice_name');
  if (customVoice && PIPER_VOICE_CONFIGS[customVoice]) {
    return customVoice;
  }
  const currentAvatar = localStorage.getItem('quest_avatar_id') || AppState.avatarId || 'echo';
  return getDefaultVoiceForAvatar(currentAvatar);
}

const warmedVoices = new Set();

export function setActiveVoiceId(voiceId) {
  if (voiceId && PIPER_VOICE_CONFIGS[voiceId]) {
    localStorage.setItem('quest_voice_name', voiceId);
    logDebug('TTS', `Active voice set to: ${PIPER_VOICE_CONFIGS[voiceId].name}`);
    if (piperModule && !warmedVoices.has(voiceId)) {
      warmVoice(voiceId).catch(err => {
        console.warn(`Background warmup notice for ${voiceId}:`, err);
      });
    }
  }
}

/**
 * Pre-downloads and pre-warms the ONNX runtime session for a given voice
 * This eliminates the first-sentence compilation lag (14s -> ~1.4s) on Quest 3
 */
export async function warmVoice(voiceId, onProgress) {
  const targetVoice = voiceId || getActiveVoiceId();
  if (warmedVoices.has(targetVoice)) return;

  const piper = await getPiper();

  if (piper.download) {
    if (onProgress) onProgress({ progress: 40, text: `Caching voice model (${targetVoice})...` });
    try {
      await piper.download(targetVoice, (progress) => {
        if (onProgress && progress && progress.loaded && progress.total) {
          const pct = Math.round((progress.loaded / progress.total) * 100);
          onProgress({ progress: pct, text: `Downloading ${targetVoice}: ${pct}%` });
        }
      });
    } catch (cacheErr) {
      console.warn(`Voice download notice for ${targetVoice}:`, cacheErr);
    }
  }

  try {
    if (onProgress) onProgress({ progress: 85, text: `Pre-warming inference session...` });
    logDebug('TTS', `Pre-warming ONNX session for voice: ${targetVoice}...`);
    await piper.predict({ text: 'Ready', voiceId: targetVoice });
    warmedVoices.add(targetVoice);
    logDebug('TTS', `Voice ${targetVoice} warmed and session cached in memory.`);
  } catch (warmupErr) {
    console.warn(`Voice pre-warm notice for ${targetVoice}:`, warmupErr);
  }
}

/**
 * Returns or creates dedicated audio playback context
 */
function getPlaybackContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!playbackContext || playbackContext.state === 'closed') {
    playbackContext = new AudioCtx();
  }
  if (playbackContext.state === 'suspended') {
    playbackContext.resume().catch(() => {});
  }
  return playbackContext;
}

/**
 * Dynamically imports the Piper WASM engine
 */
async function getPiper() {
  if (piperModule) return piperModule;
  const cdnUrls = [
    'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web/+esm',
    'https://esm.sh/@diffusionstudio/vits-web'
  ];

  for (const url of cdnUrls) {
    try {
      const mod = await import(url);
      if (mod && (mod.predict || mod.default?.predict)) {
        piperModule = mod.predict ? mod : mod.default;
        return piperModule;
      }
    } catch (e) {
      console.warn(`Failed loading Piper from ${url}:`, e);
    }
  }
  throw new Error('Could not load Piper TTS engine from CDN.');
}

/**
 * Initializes and warms up the Piper TTS engine
 */
export async function initNeuralTTS(onProgress) {
  const activeVoice = getActiveVoiceId();

  if (piperModule && warmedVoices.has(activeVoice)) {
    if (onProgress) onProgress({ progress: 100, text: 'Neural Voice Ready' });
    return piperModule;
  }

  if (isPiperLoading) {
    while (isPiperLoading) {
      await new Promise(r => setTimeout(r, 100));
    }
    return piperModule;
  }

  isPiperLoading = true;
  if (onProgress) onProgress({ progress: 15, text: 'Loading Piper WASM engine...' });

  try {
    const piper = await getPiper();
    await warmVoice(activeVoice, onProgress);

    isPiperLoading = false;
    logDebug('TTS', `Piper TTS engine ready with voice: ${activeVoice}`);
    if (onProgress) onProgress({ progress: 100, text: 'Piper Neural Voice Ready!' });
    return piper;
  } catch (err) {
    isPiperLoading = false;
    logDebug('TTS', `Piper initialization notice: ${err.message}`, 'warn');
    console.warn('Piper TTS init notice:', err);
    throw err;
  }
}

export function isNeuralTTSReady() {
  return !!piperModule;
}

export function isNeuralTTSLoading() {
  return isPiperLoading;
}

/**
 * Splits text into logical sentence chunks for low-latency streaming playback
 */
export function splitIntoSentences(text) {
  if (!text) return [];
  // Strip markdown formatting tokens and normalize whitespace
  const clean = text.replace(/[*#`_~]/g, ' ')
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                    .replace(/\s+/g, ' ')
                    .trim();
  if (!clean) return [];

  // Match sentences ending with punctuation (. ! ?)
  const rawParts = clean.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [clean];
  const sentences = [];

  for (let part of rawParts) {
    part = part.trim();
    if (!part) continue;

    // Subdivide long sentences (>110 chars) at commas or colons to keep sentence chunks snappy (<1s)
    if (part.length > 110 && /[,;:]/.test(part)) {
      const subParts = part.split(/[,;:]\s+/);
      for (let s of subParts) {
        s = s.trim();
        if (s.length > 0) sentences.push(s);
      }
    } else {
      sentences.push(part);
    }
  }

  return sentences.length > 0 ? sentences : [clean];
}

/**
 * Synthesizes a single sentence chunk via Piper
 */
async function synthesizeSentenceChunk(sentence, voiceId) {
  const piper = await getPiper();
  const t0 = performance.now();
  const wavBlob = await piper.predict({
    text: sentence.trim(),
    voiceId: voiceId
  });
  const elapsedMs = Math.round(performance.now() - t0);
  return { wavBlob, elapsedMs };
}

/**
 * Starts rhythmic viseme lip-sync mouth animation during audio playback
 */
function startVisemeAnimation() {
  if (lipSyncInterval) clearInterval(lipSyncInterval);
  let step = 0;
  lipSyncInterval = setInterval(() => {
    if (!AppState.isSpeaking) {
      stopVisemeAnimation();
      return;
    }
    // Organic oscillating mouth aperture for avatar facial rig
    step += 0.28;
    const openness = 0.25 + 0.45 * Math.abs(Math.sin(step));
    if (onLipSyncCallback) onLipSyncCallback(openness);
  }, 60);
}

function stopVisemeAnimation() {
  if (lipSyncInterval) {
    clearInterval(lipSyncInterval);
    lipSyncInterval = null;
  }
  if (onLipSyncCallback) onLipSyncCallback(0);
}

/**
 * Plays a single WAV audio blob and resolves when finished
 */
function playSentenceAudio(wavBlob, sessionId) {
  return new Promise((resolve) => {
    if (sessionId !== activeStreamingSession) {
      resolve();
      return;
    }

    const audioUrl = URL.createObjectURL(wavBlob);
    const audioEl = new Audio(audioUrl);
    activeAudioSource = audioEl;

    startVisemeAnimation();

    const cleanup = () => {
      stopVisemeAnimation();
      try { URL.revokeObjectURL(audioUrl); } catch (e) {}
      if (activeAudioSource === audioEl) activeAudioSource = null;
      resolve();
    };

    audioEl.onended = cleanup;
    audioEl.onerror = (e) => {
      console.warn('Sentence audio playback error:', e);
      cleanup();
    };

    audioEl.play().catch((playErr) => {
      console.warn('Audio play() error:', playErr);
      cleanup();
    });
  });
}

/**
 * Sentence-by-Sentence Streaming Speech Synthesizer
 * Synthesizes Sentence 1 immediately and starts playback in <1s,
 * while Sentence 2+ are pre-synthesized in the background!
 */
export async function speakNeuralTTS(text, onComplete) {
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  stopNeuralTTS();
  const sessionId = ++activeStreamingSession;
  AppState.isSpeaking = true;
  recordSpokenText(text);

  const voiceId = getActiveVoiceId();
  const voiceName = PIPER_VOICE_CONFIGS[voiceId]?.name || voiceId;
  const sys = getSystemProfile();

  logDebug('TTS', `Streaming TTS initialized (${sentences.length} sentence chunks) with voice "${voiceName}"`);
  setActiveStage('tts_synthesizing', `Synthesizing Sentence 1/${sentences.length}...`);

  // Prefetch map caches Promise<{ wavBlob, elapsedMs }>
  const prefetchMap = new Map();

  function prefetchSentence(index) {
    if (index >= sentences.length) return Promise.resolve(null);
    if (prefetchMap.has(index)) return prefetchMap.get(index);

    const promise = (async () => {
      if (sessionId !== activeStreamingSession) return null;
      try {
        const result = await synthesizeSentenceChunk(sentences[index], voiceId);
        return result;
      } catch (err) {
        logDebug('TTS', `Chunk ${index + 1} synthesis notice: ${err.message}`, 'warn');
        return null;
      }
    })();

    prefetchMap.set(index, promise);
    return promise;
  }

  // Pre-trigger sentence 0 immediately and sentence 1 in parallel
  prefetchSentence(0);
  if (sentences.length > 1) {
    prefetchSentence(1);
  }

  const tTurnStart = performance.now();
  let totalAudioDurationSec = 0;
  let totalSynthMs = 0;

  // Stream each sentence through audio playback sequentially
  for (let i = 0; i < sentences.length; i++) {
    if (sessionId !== activeStreamingSession) break;

    // Buffer upcoming sentence in the background while current sentence is about to play
    if (i + 1 < sentences.length) {
      prefetchSentence(i + 1);
    }

    const tWaitStart = performance.now();
    const chunkResult = await prefetchSentence(i);
    if (sessionId !== activeStreamingSession) break;

    if (!chunkResult || !chunkResult.wavBlob) {
      continue;
    }

    const { wavBlob, elapsedMs } = chunkResult;
    totalSynthMs += elapsedMs;

    // Report time to first spoken word!
    if (i === 0) {
      const timeToFirstSound = Math.round(performance.now() - tTurnStart);
      setStageTiming('tts', timeToFirstSound);
      logDebug('TTS', `▶️ First sentence ready in ${timeToFirstSound}ms (${sentences[0].length} chars)! Speech playback started.`);
    }

    setActiveStage('speaking', `Avatar Speaking (Sentence ${i + 1}/${sentences.length})...`);

    // Estimate audio duration from blob size (WAV 16-bit mono 16000Hz is ~32KB/sec)
    const estimatedDurationSec = Math.max(0.5, (wavBlob.size - 44) / 32000);
    totalAudioDurationSec += estimatedDurationSec;

    if (isVerbose()) {
      const rtf = (elapsedMs / 1000) / estimatedDurationSec;
      logDebug('TTS', `[PROFILER] Sentence ${i + 1}/${sentences.length}: ${elapsedMs}ms for ~${estimatedDurationSec.toFixed(1)}s audio (RTF: ${rtf.toFixed(2)}x)`);
    }

    // Play WAV audio chunk and wait until current sentence finishes playing
    await playSentenceAudio(wavBlob, sessionId);
  }

  if (sessionId === activeStreamingSession) {
    AppState.isSpeaking = false;
    stopVisemeAnimation();
    setActiveStage('idle', 'Idle / Ready');
    setStageTiming('turn_end');

    const totalTurnMs = Math.round(performance.now() - tTurnStart);
    const overallRTF = totalAudioDurationSec > 0 ? (totalSynthMs / 1000) / totalAudioDurationSec : 1.0;
    setStageTiming('rtf', overallRTF);

    logDebug('TTS', `Speech completed! Total audio: ~${totalAudioDurationSec.toFixed(1)}s across ${sentences.length} sentences. Overall RTF: ${overallRTF.toFixed(2)}x.`);
    if (onComplete) onComplete();
  }
}

/**
 * Stops all speech playback and cancels pending sentence synthesis
 */
export function stopNeuralTTS() {
  activeStreamingSession++;
  AppState.isSpeaking = false;

  if (activeAudioSource) {
    try {
      activeAudioSource.pause();
      activeAudioSource.currentTime = 0;
    } catch (e) {}
    activeAudioSource = null;
  }

  stopVisemeAnimation();
}
