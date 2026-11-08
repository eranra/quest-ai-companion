// Local On-Device Neural Text-to-Speech: In-Browser Web Audio Synthesizer
// Uses lightweight Xenova/mms-tts-eng (~36MB VITS) without external speaker embedding files
// Plays audio via direct WAV playback and Web Audio graph, natively supported in Meta Quest Browser!
import { AppState } from '../state.js';
import { recordSpokenText, speakReply as nativeSpeakReply } from './tts.js';
import { encodeWAV } from './wav.js';
import { logDebug, setStageTiming, setActiveStage } from '../ui/debug_logger.js';

let ttsSynthesizer = null;
let isTTSLoading = false;
let ttsLoadProgress = 0;
let activeAudioSource = null;
let onLipSyncCallback = null;
let lipSyncInterval = null;
let playbackContext = null;

export function setNeuralLipSyncCallback(cb) {
  onLipSyncCallback = cb;
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
 * Dynamically loads Transformers.js from CDN
 */
async function getTransformers() {
  const cdnUrls = [
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/+esm',
    'https://esm.sh/@huggingface/transformers@3.3.3',
    'https://unpkg.com/@huggingface/transformers@3.3.3/dist/transformers.min.js'
  ];

  for (const url of cdnUrls) {
    try {
      const mod = await import(url);
      if (mod && (mod.pipeline || mod.default?.pipeline)) {
        return mod.pipeline ? mod : mod.default;
      }
    } catch (e) {
      console.warn(`Failed loading transformers from ${url}:`, e);
    }
  }
  throw new Error('Could not load Transformers.js for Neural TTS.');
}

/**
 * Initializes local Neural TTS model in browser Cache / IndexedDB
 * Uses Xenova/mms-tts-eng (~36MB quantized VITS) strictly with CPU WASM
 */
export async function initNeuralTTS(onProgress) {
  if (ttsSynthesizer) {
    if (onProgress) onProgress({ progress: 100, text: 'Neural Voice Ready' });
    return ttsSynthesizer;
  }

  if (isTTSLoading) {
    while (isTTSLoading) {
      await new Promise(r => setTimeout(r, 150));
    }
    return ttsSynthesizer;
  }

  isTTSLoading = true;
  ttsLoadProgress = 0;

  try {
    const tf = await getTransformers();
    if (tf.env) {
      tf.env.allowLocalModels = false;
      tf.env.useBrowserCache = true;
    }

    const modelId = 'Xenova/mms-tts-eng';
    const progressCallback = (info) => {
      if (info && info.progress !== undefined) {
        ttsLoadProgress = Math.round(info.progress);
        if (onProgress) {
          onProgress({
            progress: ttsLoadProgress,
            file: info.file || 'weights',
            text: `Downloading Neural Voice: ${info.file || ''} (${ttsLoadProgress}%)`
          });
        }
      }
    };

    // Strictly CPU WebAssembly (WASM) - Zero WebGPU shader issues!
    const synthesizer = await tf.pipeline('text-to-speech', modelId, {
      device: 'wasm',
      quantized: true,
      progress_callback: progressCallback
    });

    ttsSynthesizer = synthesizer;
    isTTSLoading = false;
    if (onProgress) {
      onProgress({ progress: 100, text: 'Neural Voice Ready!' });
    }
    return ttsSynthesizer;
  } catch (err) {
    isTTSLoading = false;
    console.error('Neural TTS initialization error:', err);
    throw err;
  }
}

export function isNeuralTTSReady() {
  return !!ttsSynthesizer;
}

export function isNeuralTTSLoading() {
  return isTTSLoading;
}

/**
 * Synthesizes text and plays audio directly through HTML5 Audio / Web Audio
 * Guaranteed to speak on Meta Quest Browser without relying on missing OS voices!
 */
export async function speakNeuralTTS(text, onComplete) {
  const cleanText = text.replace(/[*#`_~]/g, '').trim();
  if (!cleanText) {
    if (onComplete) onComplete();
    return;
  }

  stopNeuralTTS();

  if (!ttsSynthesizer) {
    try {
      await initNeuralTTS();
    } catch (loadErr) {
      console.warn('Neural TTS load failed; attempting device native voice:', loadErr);
      const hasNativeVoices = ('speechSynthesis' in window) && window.speechSynthesis.getVoices().length > 0;
      if (hasNativeVoices) {
        nativeSpeakReply(cleanText, onComplete);
      } else if (onComplete) {
        onComplete();
      }
      return;
    }
  }

  try {
    AppState.isSpeaking = true;
    recordSpokenText(cleanText);
    setActiveStage('tts_synthesizing', `Neural TTS (${cleanText.length} chars)...`);
    logDebug('TTS', `Neural TTS synthesizing: "${cleanText.substring(0, 45)}..."`);

    // VITS generates direct Float32Array waveform audio at 16000Hz
    const tStart = performance.now();
    const output = await ttsSynthesizer(cleanText);
    const ttsMs = Math.round(performance.now() - tStart);
    setStageTiming('tts', ttsMs);
    setStageTiming('turn_end');

    if (!output || !output.audio || output.audio.length === 0) {
      throw new Error('Neural TTS produced empty audio buffer');
    }

    const audioData = output.audio instanceof Float32Array 
      ? output.audio 
      : new Float32Array(output.audio);
    const sampleRate = output.sampling_rate || 16000;
    logDebug('TTS', `Synthesized ${audioData.length} samples in ${ttsMs}ms (~${(audioData.length / sampleRate).toFixed(1)}s audio). Playing...`);
    setActiveStage('speaking', 'Avatar Speaking Reply');

    // Encode to WAV Blob for reliable HTML5 audio playback on Meta Quest Browser
    const wavBlob = encodeWAV(audioData, sampleRate);
    const audioUrl = URL.createObjectURL(wavBlob);
    const audioEl = new Audio(audioUrl);
    activeAudioSource = audioEl;

    // Real-time viseme lip-sync mouth pulses based on audio waveform RMS
    const chunkDuration = 0.08; // 80ms
    const chunkSize = Math.floor(sampleRate * chunkDuration);
    let chunkIndex = 0;

    if (lipSyncInterval) clearInterval(lipSyncInterval);
    lipSyncInterval = setInterval(() => {
      if (!AppState.isSpeaking || chunkIndex * chunkSize >= audioData.length) {
        clearInterval(lipSyncInterval);
        lipSyncInterval = null;
        if (onLipSyncCallback) onLipSyncCallback(0);
        return;
      }
      let sum = 0;
      const start = chunkIndex * chunkSize;
      const end = Math.min(audioData.length, start + chunkSize);
      for (let i = start; i < end; i++) {
        sum += audioData[i] * audioData[i];
      }
      const rms = Math.sqrt(sum / (end - start));
      const mouthOpenness = Math.min(1.0, Math.max(0.1, rms * 5.0));
      if (onLipSyncCallback) onLipSyncCallback(mouthOpenness);
      chunkIndex++;
    }, 80);

    const finishPlayback = () => {
      AppState.isSpeaking = false;
      activeAudioSource = null;
      if (lipSyncInterval) {
        clearInterval(lipSyncInterval);
        lipSyncInterval = null;
      }
      if (onLipSyncCallback) onLipSyncCallback(0);
      try { URL.revokeObjectURL(audioUrl); } catch (e) {}
      logDebug('TTS', 'Avatar speech playback finished.');
      setActiveStage('idle', 'Idle / Ready');
      if (onComplete) onComplete();
    };

    audioEl.onended = finishPlayback;

    audioEl.onerror = (e) => {
      console.warn('Audio element error; falling back to Web Audio buffer source:', e);
      // Web Audio fallback
      try {
        const ctx = getPlaybackContext();
        if (ctx) {
          const buffer = ctx.createBuffer(1, audioData.length, sampleRate);
          buffer.copyToChannel(audioData, 0);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          activeAudioSource = source;
          source.onended = finishPlayback;
          source.start(0);
          return;
        }
      } catch (ctxErr) {
        console.error('Web Audio fallback error:', ctxErr);
      }
      finishPlayback();
    };

    // Play synthesized voice through headset
    const playPromise = audioEl.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch((err) => {
        console.warn('Audio play restricted; falling back to Web Audio:', err);
        try {
          const ctx = getPlaybackContext();
          if (ctx) {
            const buffer = ctx.createBuffer(1, audioData.length, sampleRate);
            buffer.copyToChannel(audioData, 0);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            activeAudioSource = source;
            source.onended = finishPlayback;
            source.start(0);
          }
        } catch (e) {
          finishPlayback();
        }
      });
    }

  } catch (err) {
    console.warn('Neural TTS synthesis error:', err);
    stopNeuralTTS();
    const hasNativeVoices = ('speechSynthesis' in window) && window.speechSynthesis.getVoices().length > 0;
    if (hasNativeVoices) {
      nativeSpeakReply(cleanText, onComplete);
    } else if (onComplete) {
      onComplete();
    }
  }
}

/**
 * Halts active neural audio buffer playback immediately
 */
export function stopNeuralTTS() {
  if (activeAudioSource) {
    try {
      if (activeAudioSource.pause) {
        activeAudioSource.pause();
        activeAudioSource.currentTime = 0;
      } else if (activeAudioSource.stop) {
        activeAudioSource.stop();
        activeAudioSource.disconnect();
      }
    } catch (e) {}
    activeAudioSource = null;
  }
  if (lipSyncInterval) {
    clearInterval(lipSyncInterval);
    lipSyncInterval = null;
  }
  AppState.isSpeaking = false;
  if (onLipSyncCallback) onLipSyncCallback(0);
}
