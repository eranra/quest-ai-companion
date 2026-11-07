// Local On-Device Speech-to-Text: OpenAI Whisper & Direct Gemini Multimodal Audio
// Captures mic audio with WebRTC AEC, zero system beeps, and immediate hardware release!
import { AppState } from '../state.js';
import { isSelfEcho, detectUserInterruption, stopSpeaking } from './tts.js';
import { abortActiveGeneration } from '../ai.js';
import { encodeWAV, blobToBase64 } from './wav.js';
import { transcribeAudioWithGemini } from '../ai/index.js';

let whisperTranscriber = null;
let isWhisperLoading = false;
let whisperLoadProgress = 0;

let audioContext = null;
let mediaStream = null;
let scriptProcessor = null;
let audioSource = null;

let isRecording = false;
let audioChunks = [];
let silenceTimer = null;
let micWatchdogTimer = null;
let speechDetected = false;
let lastSpeechTimestamp = 0;

let onSpeechFinishedCallback = null;
let onSpeechInterimCallback = null;
let onStatusChangeCallback = null;
let onVolumeCallback = null;

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
  throw new Error('Could not load Transformers.js from CDN.');
}

/**
 * Initializes local Whisper-tiny model in browser IndexedDB/Cache
 * Features automatic WebGPU -> WASM fallback for Quest 3 / Android
 */
export async function initWhisper(onProgress) {
  if (whisperTranscriber) return whisperTranscriber;

  if (isWhisperLoading) {
    while (isWhisperLoading) {
      await new Promise(r => setTimeout(r, 150));
    }
    return whisperTranscriber;
  }

  isWhisperLoading = true;
  whisperLoadProgress = 0;

  try {
    const tf = await getTransformers();
    if (tf.env) {
      tf.env.allowLocalModels = false;
    }

    const modelId = 'onnx-community/whisper-tiny.en';
    const progressCallback = (info) => {
      if (info && info.progress !== undefined) {
        whisperLoadProgress = Math.round(info.progress);
        if (onProgress) {
          onProgress({
            progress: whisperLoadProgress,
            file: info.file || 'weights',
            text: `Downloading Whisper STT: ${info.file || ''} (${whisperLoadProgress}%)`
          });
        }
      }
    };

    let transcriber;
    try {
      const device = navigator.gpu ? 'webgpu' : 'wasm';
      transcriber = await tf.pipeline('automatic-speech-recognition', modelId, {
        dtype: 'q8',
        device,
        progress_callback: progressCallback
      });
    } catch (gpuErr) {
      console.warn('WebGPU Whisper initialization failed, falling back to WASM:', gpuErr);
      transcriber = await tf.pipeline('automatic-speech-recognition', modelId, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: progressCallback
      });
    }

    whisperTranscriber = transcriber;
    isWhisperLoading = false;
    if (onProgress) {
      onProgress({ progress: 100, text: 'Whisper STT Ready!' });
    }
    return whisperTranscriber;
  } catch (err) {
    isWhisperLoading = false;
    console.error('Whisper initialization error:', err);
    throw err;
  }
}

export function isWhisperReady() {
  return !!whisperTranscriber;
}

export function setWhisperHandlers(handlers) {
  onSpeechFinishedCallback = handlers.onFinalSpeech;
  onSpeechInterimCallback = handlers.onInterimSpeech;
  onStatusChangeCallback = handlers.onStatusChange;
  onVolumeCallback = handlers.onVolume;
}

/**
 * Resamples an audio Float32Array to 16kHz
 */
function downsampleTo16k(inputBuffer, inputSampleRate) {
  if (inputSampleRate === 16000) return inputBuffer;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(inputBuffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < inputBuffer.length; i++) {
      accum += inputBuffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

/**
 * Starts continuous microphone recording using WebRTC AEC
 */
export async function startListeningWhisper() {
  if (isRecording) return;
  audioChunks = [];
  speechDetected = false;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume().catch(() => {});
    }

    if (!mediaStream) {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    }

    audioSource = audioContext.createMediaStreamSource(mediaStream);
    // Buffer size 4096 gives ~85ms frames at 48kHz, ~256ms at 16kHz
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

    scriptProcessor.onaudioprocess = (e) => {
      if (!isRecording) return;
      const input = e.inputBuffer.getChannelData(0);

      // Compute RMS Energy
      let sum = 0;
      for (let i = 0; i < input.length; i++) {
        sum += input[i] * input[i];
      }
      const rms = Math.sqrt(sum / input.length);
      const volume = Math.min(1.0, Math.max(0.0, rms * 10));

      if (onVolumeCallback) {
        onVolumeCallback(volume);
      }

      // Check if avatar is speaking or generating
      const isAssistantActive = AppState.isSpeaking || AppState.isGenerating;

      // In strict half-duplex mode: drop input while assistant is active
      if (isAssistantActive && AppState.echoGuardMode === 'half_duplex') {
        audioChunks = [];
        speechDetected = false;
        return;
      }

      // Speech threshold: ~0.02 RMS
      if (rms > 0.02) {
        if (!speechDetected) {
          speechDetected = true;
          if (micWatchdogTimer) {
            clearTimeout(micWatchdogTimer);
            micWatchdogTimer = null;
          }
          if (onStatusChangeCallback) {
            onStatusChangeCallback('listening', 'Hearing voice...');
          }
        }
        lastSpeechTimestamp = Date.now();
        audioChunks.push(new Float32Array(input));

        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      } else if (speechDetected) {
        // Collect short tail silence
        audioChunks.push(new Float32Array(input));

        // Silence duration before final transcription
        const silenceDelay = AppState.isLiveMode ? 900 : 650;
        if (!silenceTimer) {
          silenceTimer = setTimeout(async () => {
            await finalizeWhisperTranscription();
          }, silenceDelay);
        }
      }
    };

    audioSource.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    isRecording = true;
    AppState.isListening = true;
    if (onStatusChangeCallback) {
      onStatusChangeCallback('listening', AppState.isLiveMode ? 'Live Mode: Listening...' : 'Listening to you...');
    }

    // Regular Mode Watchdog: if user taps mic and remains silent for 7s, auto-release mic!
    if (!AppState.isLiveMode) {
      if (micWatchdogTimer) clearTimeout(micWatchdogTimer);
      micWatchdogTimer = setTimeout(() => {
        if (!AppState.isLiveMode && isRecording && !speechDetected) {
          stopListeningWhisper();
          if (onStatusChangeCallback) onStatusChangeCallback('idle', 'Mic timed out (silent). Tap to speak.');
        }
      }, 7000);
    }
  } catch (err) {
    console.error('Could not start microphone recording:', err);
    AppState.isListening = false;
    if (onStatusChangeCallback) onStatusChangeCallback('mic-denied');
  }
}

/**
 * Transcribes the recorded audio buffer through Gemini Multimodal API or Whisper-tiny
 * In Regular Mode, ALWAYS releases microphone hardware immediately upon completion!
 */
async function finalizeWhisperTranscription() {
  if (audioChunks.length === 0) {
    speechDetected = false;
    if (!AppState.isLiveMode) {
      stopListeningWhisper();
    }
    return;
  }

  // Calculate total length
  let totalLength = 0;
  for (const c of audioChunks) totalLength += c.length;

  // In Regular Mode: immediately stop recording & release microphone hardware!
  if (!AppState.isLiveMode) {
    stopListeningWhisper();
  }

  const sampleRate = audioContext ? audioContext.sampleRate : 16000;

  // Minimum ~0.4s audio to avoid empty clicks
  if (totalLength < sampleRate * 0.4) {
    audioChunks = [];
    speechDetected = false;
    if (!AppState.isLiveMode) {
      if (onStatusChangeCallback) onStatusChangeCallback('idle', 'No speech detected.');
    }
    return;
  }

  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const c of audioChunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  audioChunks = [];
  speechDetected = false;

  const resampled = downsampleTo16k(merged, sampleRate);

  if (onStatusChangeCallback) {
    const label = AppState.geminiKey ? 'Analyzing audio...' : 'Transcribing speech...';
    onStatusChangeCallback('analyzing', label);
  }

  try {
    let transcript = '';

    // Route 1: Cloud Gemini Multimodal Audio (Zero model download, instant, multilingual)
    if (AppState.geminiKey && AppState.geminiKey.trim()) {
      try {
        const wavBlob = encodeWAV(resampled, 16000);
        const base64Wav = await blobToBase64(wavBlob);
        transcript = await transcribeAudioWithGemini(base64Wav);
      } catch (geminiErr) {
        console.warn('Gemini audio transcription error, falling back to local Whisper:', geminiErr);
      }
    }

    // Route 2: On-device Whisper-tiny (Local WebGPU / WASM fallback)
    if (!transcript) {
      if (!whisperTranscriber) {
        await initWhisper();
      }
      const output = await whisperTranscriber(resampled);
      if (Array.isArray(output)) {
        transcript = (output[0]?.text || '').trim();
      } else {
        transcript = (output?.text || '').trim();
      }
    }

    if (!transcript) {
      if (AppState.isLiveMode) {
        if (onStatusChangeCallback) onStatusChangeCallback('listening', 'Live Mode: Listening...');
      } else {
        if (onStatusChangeCallback) onStatusChangeCallback('idle', 'No speech detected. Tap mic to speak.');
      }
      return;
    }

    // Acoustic Echo Guard Check
    if (isSelfEcho(transcript)) {
      console.warn(`[STT] Discarded self-echo: "${transcript}"`);
      if (!AppState.isLiveMode) {
        if (onStatusChangeCallback) onStatusChangeCallback('idle');
      }
      return;
    }

    // Check Barge-in while assistant speaking
    if (AppState.isSpeaking || AppState.isGenerating) {
      const interruption = detectUserInterruption(transcript);
      if (interruption.isInterruption) {
        stopSpeaking();
        abortActiveGeneration();

        if (interruption.isStopCommand) {
          if (onStatusChangeCallback) onStatusChangeCallback('listening', 'Stopped by user. Listening...');
          return;
        }
      } else {
        // Did not meet interruption threshold
        if (!AppState.isLiveMode) {
          if (onStatusChangeCallback) onStatusChangeCallback('idle');
        }
        return;
      }
    }

    if (onSpeechFinishedCallback) {
      onSpeechFinishedCallback(transcript);
    }
  } catch (err) {
    console.error('Speech transcription error:', err);
    if (!AppState.isLiveMode) {
      stopListeningWhisper();
      if (onStatusChangeCallback) onStatusChangeCallback('idle', `Speech error: ${err.message}`);
    }
  }
}

/**
 * Stops microphone recording and releases hardware
 */
export function stopListeningWhisper() {
  isRecording = false;
  AppState.isListening = false;
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  if (micWatchdogTimer) {
    clearTimeout(micWatchdogTimer);
    micWatchdogTimer = null;
  }
  if (scriptProcessor) {
    try {
      scriptProcessor.disconnect();
    } catch (e) {}
    scriptProcessor = null;
  }
  if (audioSource) {
    try {
      audioSource.disconnect();
    } catch (e) {}
    audioSource = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => {
      try { t.stop(); } catch (e) {}
    });
    mediaStream = null;
  }
  if (onVolumeCallback) {
    onVolumeCallback(0);
  }
  if (onStatusChangeCallback && !AppState.isSpeaking && !AppState.isGenerating) {
    onStatusChangeCallback('idle');
  }
}
