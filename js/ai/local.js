// Local On-Device AI Engine: WebLLM (Qwen 2.5 via WebGPU)
import { AppState } from '../state.js';
import { callGeminiAPI } from './gemini.js';

let webllm = null;
let webllmEngine = null;
let currentLoadedModel = null;

// Dynamically import WebLLM from CDN
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

// Initialize Local WebGPU Model (Qwen 2.5 0.5B default)
export async function initLocalWebLLM(onProgress) {
  if (webllmEngine && currentLoadedModel === AppState.localModel) {
    AppState.isModelReady = true;
    return webllmEngine;
  }

  if (AppState.isModelLoading) {
    // Wait for in-flight load with safety timeout
    let waitCount = 0;
    while (AppState.isModelLoading && waitCount < 150) {
      await new Promise(r => setTimeout(r, 200));
      waitCount++;
    }
    if (webllmEngine) return webllmEngine;
  }

  // Check WebGPU availability
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported on this browser. On Meta Quest Browser, WebGPU requires experimental flags or Gemini mode in Settings.');
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
      if (onProgress) {
        onProgress({
          progress: AppState.modelLoadProgress,
          text: AppState.modelStatusText
        });
      }
    };

    const engine = await mlc.CreateMLCEngine(AppState.localModel, { initProgressCallback });
    webllmEngine = engine;
    currentLoadedModel = AppState.localModel;
    AppState.isModelReady = true;
    AppState.isModelLoading = false;
    AppState.modelStatusText = `${AppState.localModel} Ready (WebGPU)`;
    
    if (onProgress) {
      onProgress({
        progress: 100,
        text: AppState.modelStatusText,
        ready: true
      });
    }

    return engine;
  } catch (err) {
    AppState.isModelLoading = false;
    AppState.isModelReady = false;
    AppState.modelStatusText = `Failed: ${err.message}`;
    console.error('Local model initialization error:', err);
    if (onProgress) {
      onProgress({
        progress: 0,
        text: AppState.modelStatusText,
        error: err.message
      });
    }
    throw err;
  }
}

export async function callLocalWebLLM(prompt, onProgress, signal) {
  if (!navigator.gpu) {
    if (AppState.geminiKey && AppState.geminiKey.trim()) {
      return await callGeminiAPI(prompt, signal);
    }
    return `I heard your message: "${prompt}". WebGPU is not enabled for local weights on this browser. You can enter a Google Gemini key in Settings (⚙️) to enable AI responses on Meta Quest 3!`;
  }

  let engine = webllmEngine;
  if (!engine || currentLoadedModel !== AppState.localModel) {
    try {
      if (onProgress) {
        onProgress({ progress: 10, text: `Downloading ${AppState.localModel} weights...` });
      }
      const initTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('WebGPU Qwen 2.5 initialization timed out on Quest hardware')), 45000)
      );
      engine = await Promise.race([initLocalWebLLM(onProgress), initTimeoutPromise]);
    } catch (initErr) {
      console.warn("WebLLM initialization error/timeout on Quest 3:", initErr);
      if (AppState.geminiKey && AppState.geminiKey.trim()) {
        return await callGeminiAPI(prompt, signal);
      }
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
    const genTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('WebGPU generation timed out after 25s')), 25000)
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
    console.warn("Local WebLLM generation error/timeout on Quest 3:", genErr);
    if (AppState.geminiKey && AppState.geminiKey.trim()) {
      return await callGeminiAPI(prompt, signal);
    }
    return `I heard: "${prompt}". Local Qwen generation took too long or reached a mobile GPU shader limit on Quest 3. Connecting a Google Gemini key in Settings (⚙️) provides fast, reliable cloud responses.`;
  }
}
