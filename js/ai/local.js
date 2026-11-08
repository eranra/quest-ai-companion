// Local On-Device AI Engine: CPU WebAssembly (WASM) via Transformers.js
// Powered by ONNX Runtime WASM (SIMD) - Zero WebGPU requirements, runs out-of-the-box on Meta Quest 3, Android, iOS & PC!
import { AppState } from '../state.js';
import { callGeminiAPI } from './gemini.js';

let textGenerator = null;
let currentLoadedModel = null;
let pendingInitPromise = null;
const progressListeners = new Set();

/**
 * Detect if running inside Meta Quest Browser / Horizon OS
 */
export function isQuestBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /OculusBrowser|Quest/i.test(navigator.userAgent || '');
}

/**
 * Backwards compatibility stub for legacy web-llm loader
 */
export async function getWebLLM() {
  return {};
}

/**
 * Returns human-friendly model display name
 */
export function getModelDisplayName(modelId) {
  if (!modelId) return 'SmolLM2 135M';
  if (modelId === 'instant-companion') return 'Instant Companion (0ms AI)';
  if (modelId.includes('Qwen') || modelId.includes('qwen')) return 'Qwen 2.5 0.5B';
  if (modelId.includes('SmolLM') || modelId.includes('smollm')) return 'SmolLM2 135M';
  return modelId.split('/').pop();
}

/**
 * CPU WASM Support check (Backwards compatible helper)
 * WebAssembly with SIMD is supported universally across modern browsers.
 */
export async function checkWebGPUSupport() {
  const hasWasm = typeof WebAssembly !== 'undefined';
  return {
    supported: hasWasm,
    engine: 'wasm',
    device: 'cpu',
    flagStatus: 'enabled',
    reason: hasWasm ? 'CPU WebAssembly runtime available' : 'WebAssembly not supported'
  };
}

/**
 * Quest WebGPU Flag Status (Backwards compatible helper)
 * With CPU WASM, no experimental flags are required on Meta Quest 3!
 */
export async function checkQuestWebGPUFlagStatus() {
  const isQuest = isQuestBrowser();
  return {
    isQuest,
    supported: true,
    engine: 'wasm',
    flagStatus: 'wasm_cpu',
    flagDisabled: false,
    reason: 'Running via CPU WebAssembly - no browser flags required'
  };
}

/**
 * Offline companion responses for common introductory queries
 */
export function getOfflineCompanionAnswer(prompt) {
  const clean = (prompt || '').toLowerCase().trim();
  if (/what('?s| is) your name|who are you/i.test(clean)) {
    return "I am your 3D VR companion! I am running locally right here on your device via CPU WebAssembly.";
  }
  if (/^(hello|hi|hey|good morning|good afternoon|good evening)/i.test(clean)) {
    return "Hello! Great to see you in VR. I am your companion running on CPU WebAssembly!";
  }
  if (/how are you|are you feeling (okay|fine|good|well)|how do you feel/i.test(clean)) {
    return "I am feeling wonderful, standing right here with you in VR! How are you doing?";
  }
  if (/can you count|count to/i.test(clean)) {
    return "One, two, three, four, five, six, seven, eight, nine, ten!";
  }
  if (/thank(s| you)/i.test(clean)) {
    return "You are very welcome! I am always here to assist you.";
  }
  if (/what can you do|help me|what is this/i.test(clean)) {
    return "I can listen to your voice, step into 360° virtual spaces, and speak with full-body gestures using local CPU AI!";
  }
  return null;
}

/**
 * Dynamically loads Transformers.js from CDN (same unified runtime as Whisper & Neural TTS)
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
  throw new Error('Could not load Transformers.js runtime.');
}

/**
 * Reset local engine instance (useful for model switching or memory clearing)
 */
export function resetLocalWebLLM() {
  textGenerator = null;
  currentLoadedModel = null;
  pendingInitPromise = null;
  AppState.isModelReady = false;
  AppState.isModelLoading = false;
}

/**
 * Initialize Local CPU WASM Model (SmolLM2 135M default or Qwen 2.5 0.5B)
 * Uses shared Promise and broadcast listener to prevent duplicate loads.
 */
export async function initLocalWebLLM(onProgress) {
  if (AppState.localModel === 'instant-companion') {
    AppState.isModelReady = true;
    AppState.isModelLoading = false;
    AppState.modelLoadProgress = 100;
    AppState.modelStatusText = 'Instant Companion Ready (0ms)';
    if (onProgress) {
      onProgress({
        progress: 100,
        text: 'Instant Companion Ready (0ms AI)',
        ready: true
      });
    }
    return () => {};
  }

  if (textGenerator && currentLoadedModel === AppState.localModel) {
    AppState.isModelReady = true;
    if (onProgress) {
      onProgress({ 
        progress: 100, 
        text: `${getModelDisplayName(AppState.localModel)} Ready (CPU WASM)`, 
        ready: true 
      });
    }
    return textGenerator;
  }

  if (onProgress) {
    progressListeners.add(onProgress);
  }

  if (pendingInitPromise) {
    return pendingInitPromise;
  }

  pendingInitPromise = (async () => {
    AppState.isModelLoading = true;
    AppState.isModelReady = false;
    AppState.modelLoadProgress = 0;
    const modelName = getModelDisplayName(AppState.localModel);
    AppState.modelStatusText = `Initializing ${modelName} in CPU WASM...`;

    try {
      const transformers = await getTransformers();
      const createPipeline = transformers.pipeline;
      if (transformers.env) {
        transformers.env.allowLocalModels = false;
        transformers.env.useBrowserCache = true;
        if (transformers.env.backends?.onnx?.wasm) {
          transformers.env.backends.onnx.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 3, 4);
        }
      }

      const progressCallback = (report) => {
        if (report && report.progress !== undefined) {
          AppState.modelLoadProgress = Math.round(report.progress);
          const fileInfo = report.file ? ` (${report.file.split('/').pop()})` : '';
          AppState.modelStatusText = `Downloading ${modelName}${fileInfo}: ${AppState.modelLoadProgress}%`;
        } else if (report && report.status === 'ready') {
          AppState.modelLoadProgress = 100;
          AppState.modelStatusText = `${modelName} Ready (CPU WASM)`;
        }
        const data = {
          progress: AppState.modelLoadProgress,
          text: AppState.modelStatusText
        };
        progressListeners.forEach(listener => {
          try { listener(data); } catch (e) {}
        });
      };

      // Load model strictly on CPU WASM with q4 quantization
      const generator = await createPipeline('text-generation', AppState.localModel, {
        device: 'wasm',
        dtype: 'q4',
        progress_callback: progressCallback
      });

      textGenerator = generator;
      currentLoadedModel = AppState.localModel;
      AppState.isModelReady = true;
      AppState.isModelLoading = false;
      AppState.modelStatusText = `${modelName} Ready (CPU WASM)`;

      const readyData = {
        progress: 100,
        text: AppState.modelStatusText,
        ready: true
      };
      progressListeners.forEach(listener => {
        try { listener(readyData); } catch (e) {}
      });

      return generator;
    } catch (err) {
      AppState.isModelLoading = false;
      AppState.isModelReady = false;
      AppState.modelStatusText = `Failed: ${err.message}`;
      console.error('CPU WASM model initialization error:', err);

      const errorData = {
        progress: 0,
        text: AppState.modelStatusText,
        error: err.message
      };
      progressListeners.forEach(listener => {
        try { listener(errorData); } catch (e) {}
      });

      throw err;
    } finally {
      progressListeners.clear();
      pendingInitPromise = null;
    }
  })();

  return pendingInitPromise;
}

/**
 * Execute Local CPU WASM Text Generation
 */
export async function callLocalWebLLM(prompt, onProgress, signal, context = {}) {
  const cleanPrompt = (prompt || '').trim();
  const systemPrompt = context.systemPrompt || "You are a warm, intelligent 3D VR companion. Reply in 1 or 2 concise conversational sentences directly answering the user.";
  const history = context.history || [];

  // Fast-Path 1: Instant Companion Mode (0ms latency, zero memory overhead)
  if (AppState.localModel === 'instant-companion') {
    const instantAns = getOfflineCompanionAnswer(cleanPrompt);
    if (instantAns) return instantAns;
    return `You asked "${cleanPrompt}". I am right here with you in VR!`;
  }

  // Fast-Path 2: Instant answers for common greetings & companion pleasantries (0ms latency!)
  if (/^(what('?s| is) your name|who are you|hello|hi\b|how are you|are you feeling (okay|fine|good))/i.test(cleanPrompt)) {
    const instantAns = getOfflineCompanionAnswer(cleanPrompt);
    if (instantAns) return instantAns;
  }

  let generator = textGenerator;
  if (!generator || currentLoadedModel !== AppState.localModel) {
    try {
      if (onProgress) {
        onProgress({ progress: 10, text: `Loading ${getModelDisplayName(AppState.localModel)} in CPU WASM...` });
      }
      generator = await initLocalWebLLM(onProgress);
    } catch (initErr) {
      console.warn("WASM model initialization error:", initErr);
      if (AppState.geminiKey && AppState.geminiKey.trim()) {
        return await callGeminiAPI(prompt, signal, context);
      }
      const companionAns = getOfflineCompanionAnswer(prompt);
      if (companionAns) return companionAns;
      return `I heard you say: "${prompt}". My local CPU model is still downloading. You can connect a Google Gemini key in Settings (⚙️) for instant cloud responses!`;
    }
  }

  if (signal && signal.aborted) throw new Error('Aborted');

  // Multi-turn context messages grounded in avatar persona & dialogue history
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map(turn => ({ role: turn.role, content: turn.content })),
    { role: "user", content: cleanPrompt }
  ];

  try {
    // Temperature sampling + mild repetition penalty prevents 135M models from falling into degenerate repetition loops
    const output = await generator(messages, {
      max_new_tokens: 28,
      do_sample: true,
      temperature: 0.6,
      top_p: 0.9,
      repetition_penalty: 1.12
    });

    let reply = '';
    const generated = output[0]?.generated_text;
    if (Array.isArray(generated)) {
      const last = generated[generated.length - 1];
      reply = last?.content || '';
    } else if (typeof generated === 'string') {
      reply = generated;
      const parts = reply.split(/<\|im_start\|>assistant|<assistant>:?/i);
      if (parts.length > 1) {
        reply = parts[parts.length - 1];
      }
    }
    reply = (reply || '')
      .replace(/<\|im_end\|>|<\|endoftext\|>/g, '')
      .replace(/<\|user\|>.*$/is, '')
      .replace(/<\|system\|>.*$/is, '')
      .trim();

    return reply || "Hello! I am here with you.";
  } catch (genErr) {
    console.warn("WASM text generation error:", genErr);
    if (AppState.geminiKey && AppState.geminiKey.trim()) {
      return await callGeminiAPI(prompt, signal, context);
    }
    const companionAns = getOfflineCompanionAnswer(prompt);
    if (companionAns) return companionAns;
    return `I heard: "${prompt}". My CPU model encountered an issue. You can switch to Google Gemini in Settings (⚙️) for cloud AI.`;
  }
}
