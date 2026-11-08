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
  loadPersistedHistory,
  persistHistory,
  getActiveAvatarPersona,
  buildAgentSystemPrompt,
  cleanAndValidateSpeech,
  AVATAR_PERSONAS
} from './agent.js';
import {
  TOOL_DEFINITIONS,
  executeTool,
  detectAndExecuteTool,
  getLiveEnvironmentContext,
  getGeminiToolDeclarations,
  processActionTagsInModelOutput,
  executeChangeSpace,
  executeChangeAvatar
} from './tools.js';

let activeAbortController = null;

function getAvatarWelcomeSpeech(avatarName) {
  const n = (avatarName || '').toLowerCase();
  switch (n) {
    case 'maya':
      return "Hello, Maya here! It's wonderful to guide you.";
    case 'alex':
      return "Hey, Alex here! Geared up and ready for adventure.";
    case 'ollie':
      return "Beep boop! Ollie the robot at your service!";
    case 'spark':
      return "Spark online! Buzzing and ready to explore!";
    case 'pip':
      return "Hiya! Pip is here to bring some fun and magic!";
    case 'echo':
    default:
      return "Echo holographic guide initialized and synced with your view.";
  }
}

function getSpaceArrivalSpeech(spaceName) {
  const s = (spaceName || '').toLowerCase();
  if (s.includes('garden')) {
    return "Welcome to the peaceful Zen Garden! Enjoy the cherry blossoms and tranquil waters.";
  } else if (s.includes('penthouse')) {
    return "Here we are in the cyberpunk Penthouse! Take in that futuristic neon skyline.";
  } else if (s.includes('cafe')) {
    return "Welcome to the cozy Parisian Cafe! A wonderful spot to relax together.";
  } else if (s.includes('pass') || s.includes('real') || s.includes('room')) {
    return "Switched to Mixed Reality Passthrough! I am now standing right here in your physical room.";
  } else {
    return "Welcome to the grand Sci-Fi Hall! What would you like to explore next?";
  }
}

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
    let persona = getActiveAvatarPersona(AppState.avatarId);
    const liveContext = await getLiveEnvironmentContext();

    logDebug('AGENT', `Incoming turn: "${cleanPrompt}" | Intent: ${intent} | Memory: ${history.length} turns | Persona: ${persona.name}`);

    // Agentic Intent: Reset / Clear Conversation Memory
    if (intent === 'reset') {
      clearConversationHistory();
      return `Conversation memory reset! I am ready to start fresh as ${persona.name}. What would you like to talk about?`;
    }

    // Agent Tool Invocation (Local & Cloud Tool Routing)
    const executedTool = await detectAndExecuteTool(cleanPrompt);
    if (executedTool) {
      logDebug('TOOL', `Tool executed: "${executedTool.tool}" -> ${executedTool.result}`);

      let toolSpokenReply = executedTool.result;
      if (executedTool.tool === 'change_avatar') {
        persona = getActiveAvatarPersona(executedTool.avatarId || AppState.avatarId);
        toolSpokenReply = getAvatarWelcomeSpeech(persona.name);
      } else if (executedTool.tool === 'change_space') {
        toolSpokenReply = getSpaceArrivalSpeech(executedTool.name || executedTool.spaceId);
      } else if (executedTool.tool === 'get_time') {
        toolSpokenReply = `It is currently ${liveContext.time} on ${liveContext.date}.`;
      } else if (executedTool.tool === 'recenter_view') {
        toolSpokenReply = "I have re-centered our 3D view and squared our alignment.";
      } else if (executedTool.tool === 'repeat_last_turn') {
        const lastAssistantTurn = [...history].reverse().find(t => t.role === 'assistant');
        toolSpokenReply = lastAssistantTurn ? lastAssistantTurn.content : "I am right here with you! What would you like to explore?";
      }

      const finalReply = cleanAndValidateSpeech(toolSpokenReply, cleanPrompt, persona);
      recordDialogueTurn('user', cleanPrompt);
      recordDialogueTurn('assistant', finalReply);
      return finalReply;
    }

    const systemPrompt = buildAgentSystemPrompt({ persona, liveContext });
    logDebug('AGENT', `System prompt: "${systemPrompt.replace(/\n/g, ' ')}"`);

    const context = { systemPrompt, history, persona, liveContext };

    let rawReply = '';
    const t0 = performance.now();
    if (AppState.engine === 'cloud') {
      rawReply = await callGeminiAPI(cleanPrompt, signal, context);
    } else {
      rawReply = await callLocalWebLLM(cleanPrompt, onProgress, signal, context);
    }
    const elapsed = Math.round(performance.now() - t0);

    logDebug('AI', `Raw model output in ${elapsed}ms (${rawReply.length} chars): "${rawReply}"`);

    // Process any action tags emitted by model [ACTION: name(param)]
    const actionResult = await processActionTagsInModelOutput(rawReply);
    if (actionResult.actions.length > 0) {
      logDebug('TOOL', `Executed ${actionResult.actions.length} action tags from model output`);
    }

    // Agentic Response Validation & Healing
    const validatedReply = cleanAndValidateSpeech(actionResult.cleanText, cleanPrompt, persona);
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
  loadPersistedHistory,
  persistHistory,
  getActiveAvatarPersona,
  buildAgentSystemPrompt,
  cleanAndValidateSpeech,
  AVATAR_PERSONAS,
  TOOL_DEFINITIONS,
  executeTool,
  detectAndExecuteTool,
  getLiveEnvironmentContext,
  getGeminiToolDeclarations,
  processActionTagsInModelOutput,
  executeChangeSpace,
  executeChangeAvatar
};
