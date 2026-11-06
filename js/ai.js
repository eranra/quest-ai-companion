// AI Engine: Dual Mode (Google Gemini 2.5 Flash + Local WebLLM via WebGPU)
import { AppState } from './state.js';

let webllmEngine = null;
let activeAbortController = null;

export function abortActiveGeneration() {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
}

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

async function callGeminiAPI(prompt, signal) {
  if (!AppState.geminiKey) {
    throw new Error('Gemini API key is required. Tap ⚙️ to enter your free Google AI Studio key.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(AppState.geminiKey)}`;

  const payload = {
    systemInstruction: {
      parts: [{
        text: "You are an intelligent, empathetic 3D virtual companion speaking directly with the user on their phone or VR headset. Reply concisely, naturally, and warmly in spoken conversational style (usually 1-3 sentences). Avoid markdown formatting, asterisks, lists, or unpronounceable symbols as your reply will be read aloud."
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

export async function initLocalWebLLM(onProgress) {
  if (webllmEngine) return webllmEngine;
  if (!window.webllm) {
    throw new Error('WebLLM library is not loaded.');
  }

  const selectedModel = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
  const initProgressCallback = (report) => {
    if (onProgress) onProgress(report);
  };

  webllmEngine = await window.webllm.CreateMLCEngine(selectedModel, { initProgressCallback });
  return webllmEngine;
}

async function callLocalWebLLM(prompt, onProgress, signal) {
  const engine = await initLocalWebLLM(onProgress);
  if (signal.aborted) throw new Error('Aborted');

  const messages = [
    { role: "system", content: "You are a friendly 3D companion avatar speaking with the user. Keep answers warm, brief, and natural (1-3 sentences) suitable for speech." },
    { role: "user", content: prompt }
  ];

  const completion = await engine.chat.completions.create({
    messages,
    temperature: 0.7,
    max_tokens: 150
  });

  return completion.choices[0].message.content || "Hello! I am here.";
}
