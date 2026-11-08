// Local On-Device AI Engine: WebLLM (Qwen 2.5 via WebGPU)
import { AppState } from '../state.js';
import { callGeminiAPI } from './gemini.js';

let webllm = null;
let webllmEngine = null;
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
 * Verify WebGPU availability and adapter acquisition with safety timeout
 */
export async function checkWebGPUSupport() {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return { 
      supported: false, 
      flagStatus: 'unsupported',
      reason: 'WebGPU is not supported by this browser.' 
    };
  }
  try {
    const adapterPromise = navigator.gpu.requestAdapter();
    const timeoutPromise = new Promise(r => setTimeout(() => r(null), 2500));
    const adapter = await Promise.race([adapterPromise, timeoutPromise]);
    if (!adapter) {
      return { 
        supported: false, 
        flagStatus: 'disabled',
        reason: 'WebGPU adapter is disabled or unavailable. (On Meta Quest Browser, WebGPU requires experimental flags in chrome://flags).' 
      };
    }
    return { supported: true, flagStatus: 'enabled', adapter };
  } catch (err) {
    return { supported: false, flagStatus: 'disabled', reason: err.message };
  }
}

/**
 * Specifically check Meta Quest 3 WebGPU flag status
 */
export async function checkQuestWebGPUFlagStatus() {
  const isQuest = isQuestBrowser();
  const gpu = await checkWebGPUSupport();
  return {
    isQuest,
    supported: gpu.supported,
    flagStatus: gpu.flagStatus, // 'enabled' | 'disabled' | 'unsupported'
    flagDisabled: isQuest && !gpu.supported,
    reason: gpu.reason
  };
}

/**
 * Offline companion responses for common introductory queries when
 * WebGPU is unavailable on mobile/Quest and no Gemini key is yet configured.
 */
export function getOfflineCompanionAnswer(prompt) {
  const clean = (prompt || '').toLowerCase().trim();
  if (/what('?s| is) your name|who are you/i.test(clean)) {
    return "I am your 3D VR companion! On Meta Quest 3, connecting a Google Gemini key in Settings (⚙️) unlocks full conversational intelligence.";
  }
  if (/^(hello|hi|hey|good morning|good afternoon|good evening)/i.test(clean)) {
    return "Hello! Wonderful to see you here in VR. To have full conversations on Meta Quest 3, you can add a free Google Gemini key in Settings (⚙️)!";
  }
  if (/how are you/i.test(clean)) {
    return "I am doing great, standing right here with you! Connect a Google Gemini API key in Settings for open-ended voice conversation.";
  }
  if (/what can you do|help me|what is this/i.test(clean)) {
    return "I can listen to your voice, step into 360° virtual spaces, and speak with full-body gestures! Enter a Google Gemini key in Settings (⚙️) to chat about anything.";
  }
  return null;
}

/**
 * Dynamically import WebLLM from CDN
 */
export async function getWebLLM() {
  if (webllm) return webllm;
  try {
    webllm = await import("https://esm.run/@mlc-ai/web-llm");
    return webllm;
  } catch (err) {
    console.warn("Retrying WebLLM load from jsdelivr...", err);
    webllm = await import("https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.78/+esm");
    return webllm;
  }
}

/**
 * Reset local engine instance (useful for model switching or error recovery)
 */
export function resetLocalWebLLM() {
  webllmEngine = null;
  currentLoadedModel = null;
  pendingInitPromise = null;
  AppState.isModelReady = false;
  AppState.isModelLoading = false;
}

/**
 * Initialize Local WebGPU Model (Qwen 2.5 0.5B default)
 * Uses shared Promise and broadcast listener to avoid concurrency freezes.
 */
export async function initLocalWebLLM(onProgress) {
  if (webllmEngine && currentLoadedModel === AppState.localModel) {
    AppState.isModelReady = true;
    if (onProgress) {
      onProgress({ progress: 100, text: `${AppState.localModel} Ready (WebGPU)`, ready: true });
    }
    return webllmEngine;
  }

  if (onProgress) {
    progressListeners.add(onProgress);
  }

  if (pendingInitPromise) {
    return pendingInitPromise;
  }

  pendingInitPromise = (async () => {
    // 1. Verify WebGPU hardware adapter first
    const gpuCheck = await checkWebGPUSupport();
    if (!gpuCheck.supported) {
      throw new Error(gpuCheck.reason);
    }

    AppState.isModelLoading = true;
    AppState.isModelReady = false;
    AppState.modelLoadProgress = 0;
    AppState.modelStatusText = `Initializing ${AppState.localModel}...`;

    try {
      const mlc = await getWebLLM();

      const initProgressCallback = (report) => {
        AppState.modelStatusText = report.text || 'Loading weights into WebGPU...';
        if (report.progress !== undefined) {
          AppState.modelLoadProgress = Math.round(report.progress * 100);
        }
        const data = {
          progress: AppState.modelLoadProgress,
          text: AppState.modelStatusText
        };
        progressListeners.forEach(listener => {
          try { listener(data); } catch (e) {}
        });
      };

      const engine = await mlc.CreateMLCEngine(AppState.localModel, { initProgressCallback });
      webllmEngine = engine;
      currentLoadedModel = AppState.localModel;
      AppState.isModelReady = true;
      AppState.isModelLoading = false;
      AppState.modelStatusText = `${AppState.localModel} Ready (WebGPU)`;

      const readyData = {
        progress: 100,
        text: AppState.modelStatusText,
        ready: true
      };
      progressListeners.forEach(listener => {
        try { listener(readyData); } catch (e) {}
      });

      return engine;
    } catch (err) {
      AppState.isModelLoading = false;
      AppState.isModelReady = false;
      AppState.modelStatusText = `Failed: ${err.message}`;
      console.error('Local model initialization error:', err);

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
 * Generate AI Response using Local WebLLM with zero-hang watchdog & Gemini failover
 */
export async function callLocalWebLLM(prompt, onProgress, signal) {
  // 1. Check WebGPU adapter support
  const gpuCheck = await checkWebGPUSupport();
  if (!gpuCheck.supported) {
    if (AppState.geminiKey && AppState.geminiKey.trim()) {
      console.log('WebGPU unavailable on this device; seamlessly routing to Google Gemini Cloud API');
      return await callGeminiAPI(prompt, signal);
    }
    const companionAns = getOfflineCompanionAnswer(prompt);
    if (companionAns) return companionAns;
    return `I heard your message: "${prompt}". Meta Quest Browser does not have WebGPU enabled by default. Please enter a free Google Gemini key in Settings (⚙️) for instant cloud responses!`;
  }

  let engine = webllmEngine;
  if (!engine || currentLoadedModel !== AppState.localModel) {
    try {
      if (onProgress) {
        onProgress({ progress: 10, text: `Downloading ${AppState.localModel} weights...` });
      }
      // Strict 12-second watchdog for mobile/Quest VR
      const initTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('WebGPU model initialization timed out on mobile hardware')), 12000)
      );
      engine = await Promise.race([initLocalWebLLM(onProgress), initTimeoutPromise]);
    } catch (initErr) {
      console.warn("WebLLM initialization error/timeout:", initErr);
      if (AppState.geminiKey && AppState.geminiKey.trim()) {
        return await callGeminiAPI(prompt, signal);
      }
      const companionAns = getOfflineCompanionAnswer(prompt);
      if (companionAns) return companionAns;
      return `I heard you say: "${prompt}". My local Qwen 2.5 WebGPU model is still loading or reached a mobile memory limit on Quest 3. You can connect a Google Gemini API key in Settings (⚙️) for instant cloud responses!`;
    }
  }

  if (signal && signal.aborted) throw new Error('Aborted');

  const messages = [
    {
      role: "system",
      content: "You are a warm, intelligent 3D companion speaking directly to the user. Keep your answers brief, natural, and conversational (1-2 sentences). Do not use markdown, emojis, asterisks, or bullet points because your answer will be spoken out loud."
    },
    { role: "user", content: prompt }
  ];

  try {
    // Strict 10-second watchdog for generation
    const genTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('WebGPU generation timed out after 10s')), 10000)
    );

    const completion = await Promise.race([
      engine.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 120
      }),
      genTimeoutPromise
    ]);

    return completion.choices[0]?.message?.content || "Hello! I am here with you.";
  } catch (genErr) {
    console.warn("Local WebLLM generation error/timeout:", genErr);
    if (AppState.geminiKey && AppState.geminiKey.trim()) {
      return await callGeminiAPI(prompt, signal);
    }
    const companionAns = getOfflineCompanionAnswer(prompt);
    if (companionAns) return companionAns;
    return `I heard: "${prompt}". Local Qwen generation took too long or reached a mobile GPU shader limit on Quest 3. Connecting a Google Gemini key in Settings (⚙️) provides fast, reliable cloud responses.`;
  }
}
