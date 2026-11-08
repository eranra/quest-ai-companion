// Local On-Device Neural Text-to-Speech: In-Browser Web Audio Synthesizer
// Uses lightweight Xenova/mms-tts-eng (~36MB VITS) without external speaker embedding files
// Plays audio directly into AudioContext.destination enabling true WebRTC AEC subtraction!
import { AppState } from '../state.js';
import { getAudioContext } from './vad.js';
import { recordSpokenText, speakReply as nativeSpeakReply } from './tts.js';

let ttsSynthesizer = null;
let isTTSLoading = false;
let ttsLoadProgress = 0;
let activeAudioSource = null;
let onLipSyncCallback = null;
let lipSyncInterval = null;

export function setNeuralLipSyncCallback(cb) {
  onLipSyncCallback = cb;
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
 * Uses Xenova/mms-tts-eng (~36MB quantized VITS) with WebGPU -> WASM fallback
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

    let synthesizer;
    try {
      const device = navigator.gpu ? 'webgpu' : 'wasm';
      synthesizer = await tf.pipeline('text-to-speech', modelId, {
        quantized: true,
        device,
        progress_callback: progressCallback
      });
    } catch (gpuErr) {
      console.warn('WebGPU Neural TTS load failed, falling back to WASM:', gpuErr);
      synthesizer = await tf.pipeline('text-to-speech', modelId, {
        quantized: true,
        device: 'wasm',
        progress_callback: progressCallback
      });
    }

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
 * Synthesizes text and plays audio buffer directly through Web Audio destination
 * Automatically falls back to native device TTS if neural model is loading or encounters error
 */
export async function speakNeuralTTS(text, onComplete) {
  const cleanText = text.replace(/[*#`_~]/g, '').trim();
  if (!cleanText) {
    if (onComplete) onComplete();
    return;
  }

  stopNeuralTTS();

  // If neural model is not ready or currently loading, seamlessly fall back to native device TTS
  if (!ttsSynthesizer) {
    if (isTTSLoading) {
      console.warn('Neural TTS is currently downloading; speaking with device native voice in the meantime.');
      nativeSpeakReply(cleanText, onComplete);
      return;
    }
    try {
      await initNeuralTTS();
    } catch (loadErr) {
      console.warn('Neural TTS download failed; falling back to device native voice:', loadErr);
      nativeSpeakReply(cleanText, onComplete);
      return;
    }
  }

  try {
    AppState.isSpeaking = true;
    recordSpokenText(cleanText);

    // VITS generates direct Float32Array waveform audio at 16000Hz
    const output = await ttsSynthesizer(cleanText);

    if (!output || !output.audio || output.audio.length === 0) {
      throw new Error('Neural TTS produced empty audio buffer');
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let ctx = getAudioContext();
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    const audioData = output.audio instanceof Float32Array 
      ? output.audio 
      : new Float32Array(output.audio);
    const sampleRate = output.sampling_rate || 16000;

    const audioBuffer = ctx.createBuffer(1, audioData.length, sampleRate);
    audioBuffer.copyToChannel(audioData, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    activeAudioSource = source;

    // Real-time lip sync pulses based on audio buffer amplitude
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

    source.onended = () => {
      AppState.isSpeaking = false;
      activeAudioSource = null;
      if (lipSyncInterval) {
        clearInterval(lipSyncInterval);
        lipSyncInterval = null;
      }
      if (onLipSyncCallback) onLipSyncCallback(0);
      if (onComplete) onComplete();
    };

    source.start(0);
  } catch (err) {
    console.warn('Neural TTS generation failed, falling back to native TTS:', err);
    stopNeuralTTS();
    nativeSpeakReply(cleanText, onComplete);
  }
}

/**
 * Halts active neural audio buffer playback immediately
 */
export function stopNeuralTTS() {
  if (activeAudioSource) {
    try {
      activeAudioSource.stop();
      activeAudioSource.disconnect();
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
