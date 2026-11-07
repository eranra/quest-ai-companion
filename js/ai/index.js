// AI Subsystem Facade
import { AppState } from '../state.js';
import { initLocalWebLLM, getWebLLM, callLocalWebLLM } from './local.js';
import { checkGeminiResponsiveness, callGeminiAPI, transcribeAudioWithGemini } from './gemini.js';

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

export {
  initLocalWebLLM,
  getWebLLM,
  callLocalWebLLM,
  checkGeminiResponsiveness,
  callGeminiAPI,
  transcribeAudioWithGemini
};
