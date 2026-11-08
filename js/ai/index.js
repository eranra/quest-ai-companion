// AI Subsystem Facade & Agentic Orchestration Layer
import { AppState } from '../state.js';
import { logDebug } from '../ui/debug_logger.js';
import { 
  initLocalWebLLM, 
  getWebLLM, 
  callLocalWebLLM, 
  checkWebGPUSupport, 
  isQuestBrowser, 
  checkQuestWebGPUFlagStatus,
  getOfflineCompanionAnswer, 
  resetLocalWebLLM 
} from './local.js';
import { checkGeminiResponsiveness, callGeminiAPI, transcribeAudioWithGemini } from './gemini.js';
import {
  classifyUserIntent,
  getConversationHistory,
  recordDialogueTurn,
  clearConversationHistory,
  getActiveAvatarPersona,
  buildAgentSystemPrompt,
  cleanAndValidateSpeech,
  AVATAR_PERSONAS
} from './agent.js';

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
    const cleanPrompt = (prompt || '').trim();
    const intent = classifyUserIntent(cleanPrompt);
    const history = getConversationHistory();
    const persona = getActiveAvatarPersona(AppState.avatarId);

    logDebug('AGENT', `Incoming turn: "${cleanPrompt}" | Intent: ${intent} | Memory: ${history.length} turns | Persona: ${persona.name}`);

    // Agentic Intent: Reset / Clear Conversation Memory
    if (intent === 'reset') {
      clearConversationHistory();
      return `Conversation memory reset! I am ready to start fresh as ${persona.name}. What would you like to talk about?`;
    }

    const systemPrompt = buildAgentSystemPrompt({ persona });
    logDebug('AGENT', `System prompt: "${systemPrompt.replace(/\n/g, ' ')}"`);

    const context = { systemPrompt, history, persona };

    let rawReply = '';
    const t0 = performance.now();
    if (AppState.engine === 'cloud') {
      rawReply = await callGeminiAPI(cleanPrompt, signal, context);
    } else {
      rawReply = await callLocalWebLLM(cleanPrompt, onProgress, signal, context);
    }
    const elapsed = Math.round(performance.now() - t0);

    logDebug('AI', `Raw model output in ${elapsed}ms (${rawReply.length} chars): "${rawReply}"`);

    // Agentic Response Validation & Healing
    const validatedReply = cleanAndValidateSpeech(rawReply, cleanPrompt, persona);
    logDebug('AGENT', `Validated reply -> "${validatedReply}"`);

    // Commit both dialogue turns to multi-turn memory
    recordDialogueTurn('user', cleanPrompt);
    recordDialogueTurn('assistant', validatedReply);

    return validatedReply;
  } finally {
    AppState.isGenerating = false;
    activeAbortController = null;
  }
}

export {
  initLocalWebLLM,
  getWebLLM,
  callLocalWebLLM,
  checkWebGPUSupport,
  isQuestBrowser,
  checkQuestWebGPUFlagStatus,
  getOfflineCompanionAnswer,
  resetLocalWebLLM,
  checkGeminiResponsiveness,
  callGeminiAPI,
  transcribeAudioWithGemini,
  classifyUserIntent,
  getConversationHistory,
  recordDialogueTurn,
  clearConversationHistory,
  getActiveAvatarPersona,
  buildAgentSystemPrompt,
  cleanAndValidateSpeech,
  AVATAR_PERSONAS
};
