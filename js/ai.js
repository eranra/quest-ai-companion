// AI Engine: Dual Mode (Local WebLLM Qwen 2.5 + Google Gemini Cloud)
import { AppState } from './state.js';

let webllm = null;
let webllmEngine = null;
let currentLoadedModel = null;
let activeAbortController = null;

export function abortActiveGeneration() {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
}

// Dynamically import WebLLM from CDN
async function getWebLLM() {
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
    // Wait for in-flight load
    while (AppState.isModelLoading) {
      await new Promise(r => setTimeout(r, 200));
    }
    return webllmEngine;
  }

  // Check WebGPU availability
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported on this browser/device. Please switch to Google Gemini mode in settings.');
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

// -------------------------------------------------------------
// Google Gemini API Responsiveness Test
// -------------------------------------------------------------
export async function checkGeminiResponsiveness() {
  if (!AppState.geminiKey || !AppState.geminiKey.trim()) {
    AppState.geminiStatus = 'no-key';
    return { responsive: false, reason: 'No API Key entered in Settings (⚙️)' };
  }

  AppState.geminiStatus = 'checking';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(AppState.geminiKey.trim())}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }]
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      AppState.geminiStatus = 'online';
      return { responsive: true, reason: 'Online & Responsive' };
    } else {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error?.message || `HTTP ${res.status}`;
      AppState.geminiStatus = 'offline';
      return { responsive: false, reason: msg };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    AppState.geminiStatus = 'offline';
    const msg = err.name === 'AbortError' ? 'Timeout (No response after 6s)' : err.message;
    return { responsive: false, reason: msg };
  }
}

// -------------------------------------------------------------
// Main AI Response Generator
// -------------------------------------------------------------
export async function generateAIResponse(prompt, onProgress) {
  abortActiveGeneration();
  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;

  AppState.isGenerating = true;

  try {
    let reply = '';
    if (AppState.engine === 'cloud') {
      reply = await callGeminiAPI(prompt, signal);
    } else {
      reply = await callLocalWebLLM(prompt, onProgress, signal);
    }
    return reply;
  } finally {
    AppState.isGenerating = false;
    activeAbortController = null;
  }
}

async function callLocalWebLLM(prompt, onProgress, signal) {
  let engine = webllmEngine;
  if (!engine || currentLoadedModel !== AppState.localModel) {
    engine = await initLocalWebLLM(onProgress);
  }
  if (signal.aborted) throw new Error('Aborted');

  const messages = [
    {
      role: "system",
      content: "You are a warm, intelligent 3D companion speaking directly to the user. Keep your answers brief, natural, and conversational (1-2 sentences). Do not use markdown, emojis, asterisks, or bullet points because your answer will be spoken out loud."
    },
    { role: "user", content: prompt }
  ];

  const completion = await engine.chat.completions.create({
    messages,
    temperature: 0.7,
    max_tokens: 120
  });

  return completion.choices[0].message.content || "Hello! I am here with you.";
}

async function callGeminiAPI(prompt, signal) {
  if (!AppState.geminiKey) {
    throw new Error('Google Gemini API key required. Tap ⚙️ Settings to enter your key or switch back to Local Qwen mode.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(AppState.geminiKey)}`;

  const payload = {
    systemInstruction: {
      parts: [{
        text: "You are a friendly 3D virtual companion speaking directly with the user. Reply concisely, naturally, and warmly in spoken style (1-2 sentences). Avoid markdown formatting, asterisks, or unpronounceable symbols as your reply will be read aloud."
      }]
    },
    contents: [
      { role: "user", parts: [{ text: prompt }] }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm listening and ready.";
}
