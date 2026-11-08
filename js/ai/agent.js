// Agentic Conversational Engine & Context Memory Framework
// Manages multi-turn dialogue history, avatar persona alignment, intent routing, and response validation
import { AppState } from '../state.js';
import { logDebug } from '../ui/debug_logger.js';
import { getOfflineCompanionAnswer } from './local.js';

const TRAJECTORY_STORAGE_KEY = 'quest_dialogue_trajectory';
const MAX_HISTORY_TURNS = 6; // Sliding window of 3 complete user-assistant dialogue pairs
let conversationHistory = loadPersistedHistory();

export function loadPersistedHistory() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRAJECTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY_TURNS) : [];
  } catch {
    return [];
  }
}

export function persistHistory() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TRAJECTORY_STORAGE_KEY, JSON.stringify(conversationHistory));
  } catch (e) {
    console.warn('Could not persist dialogue trajectory:', e);
  }
}

export const AVATAR_PERSONAS = {
  maya: {
    name: 'Maya',
    archetype: 'Empathetic Human Guide',
    description: 'Warm, thoughtful, articulate, and supportive human friend in VR.'
  },
  alex: {
    name: 'Alex',
    archetype: 'Tech Adventurer',
    description: 'Energetic, knowledgeable, curious, and upbeat companion.'
  },
  ollie: {
    name: 'Ollie',
    archetype: 'Witty Robot Sidekick',
    description: 'Friendly, playful, clever robotic buddy with a cheerful personality.'
  },
  echo: {
    name: 'Echo',
    archetype: 'Holographic AI Guide',
    description: 'Calm, intelligent, poised, and efficient holographic presence.'
  },
  spark: {
    name: 'Spark',
    archetype: 'Lively Drone Companion',
    description: 'Quick, cheerful, enthusiastic holographic companion.'
  },
  pip: {
    name: 'Pip',
    archetype: 'Whimsical Cartoon Companion',
    description: 'Bubbly, lighthearted, cheerful, and entertaining cartoon companion.'
  }
};

/**
 * Returns persona profile for the currently active avatar
 */
export function getActiveAvatarPersona(avatarId) {
  const id = avatarId || AppState.avatarId || 'echo';
  return AVATAR_PERSONAS[id] || AVATAR_PERSONAS.echo;
}

/**
 * Returns formatted multi-turn conversation history
 */
export function getConversationHistory() {
  return [...conversationHistory];
}

/**
 * Adds a dialogue turn to conversational memory with sliding-window pruning
 */
export function recordDialogueTurn(role, content) {
  if (!content || !content.trim()) return;
  conversationHistory.push({
    role: role === 'user' ? 'user' : 'assistant',
    content: content.trim(),
    timestamp: Date.now()
  });

  // Keep within sliding window to protect small context windows & preserve CPU speed
  if (conversationHistory.length > MAX_HISTORY_TURNS) {
    conversationHistory = conversationHistory.slice(-MAX_HISTORY_TURNS);
  }
  persistHistory();
}

/**
 * Clears multi-turn conversational history
 */
export function clearConversationHistory() {
  const count = conversationHistory.length;
  conversationHistory = [];
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(TRAJECTORY_STORAGE_KEY);
  }
  logDebug('AGENT', `Conversation history cleared (${count} turns wiped from memory and storage)`);
}

/**
 * Analyzes user input to detect intent & conversation control
 */
export function classifyUserIntent(prompt) {
  const clean = (prompt || '').toLowerCase().trim();

  if (/^(reset|start over|clear (chat|history|memory)|forget everything)\b/i.test(clean)) {
    return 'reset';
  }
  if (/^(what('?s| is) your name|who are you|who made you|what are you)\b/i.test(clean)) {
    return 'identity';
  }
  if (/^(hello|hi\b|hey\b|good morning|good afternoon|good evening|greetings)\b/i.test(clean)) {
    return 'greeting';
  }
  if (/^(how are you|are you feeling (okay|fine|good|well)|how do you feel)\b/i.test(clean)) {
    return 'status';
  }
  if (/^(where are we|what space is this|what room is this|change (space|room|background))\b/i.test(clean)) {
    return 'spatial';
  }
  return 'general';
}

/**
 * Constructs the contextual system prompt grounded in avatar persona & current 3D space
 */
export function buildAgentSystemPrompt(options = {}) {
  const persona = options.persona || getActiveAvatarPersona(AppState.avatarId);
  const spaceId = options.spaceId || AppState.spaceId || 'hall';
  const spaceName = spaceId === 'passthrough' ? 'the user\'s real physical room in Mixed Reality Passthrough' : `${spaceId} 360° virtual space`;
  const userName = options.userName || 'the user';
  const liveContext = options.liveContext ? `\nLive Facts: ${options.liveContext.formatted || options.liveContext}` : '';

  return `You are ${persona.name}, a warm 3D companion speaking directly to ${userName} in ${spaceName}.${liveContext}
Personality: ${persona.description}
Guidelines:
1. Answer the user's question directly and concisely in 1 or 2 conversational sentences.
2. Speak naturally as a friend in spoken dialogue; do not use markdown, emojis, asterisks, bullet points, or role prefixes like "Assistant:".
3. Maintain continuity with the prior conversation turns.
4. You have tool capabilities to control the 3D world (changing spaces to hall, garden, penthouse, cafe, passthrough, and transforming into avatars maya, alex, ollie, echo, spark, pip).`;
}

/**
 * Cleans and validates raw LLM output before passing to TTS voice synthesis
 */
export function cleanAndValidateSpeech(rawText, userPrompt, persona) {
  if (!rawText || typeof rawText !== 'string') {
    return getFallbackResponse(userPrompt, persona);
  }

  // 1. Strip special tokens and chat delimiters
  let text = rawText
    .replace(/<\|im_start\|>(system|user)[\s\S]*?<\|im_end\|>/gi, '') // strip any leaked system/user prompt reflections
    .replace(/<\|im_start\|>assistant\s*/gi, '')
    .replace(/<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>|<\|assistant\|>|<\|user\|>|<\|system\|>/gi, '')
    .replace(/<assistant>|<\/assistant>|<user>|<\/user>/gi, '')
    .trim();

  // 2. Strip hallucinated dialogue prefixes (e.g. "Assistant:", "Maya:", "Eran:")
  text = text.replace(/^(assistant|model|companion|[a-z]+):\s*/i, '');

  // 3. Strip stage directions, action tags, markdown, asterisks (*smiles*, *waves*) and emojis
  text = text.replace(/\[ACTION:[^\]]*\]/gi, '')
             .replace(/\*[^*]*\*/g, '')
             .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
             .replace(/[#`_~]/g, '')
             .replace(/\s+/g, ' ')
             .trim();

  // 4. Deduplicate runaway repetitive clauses/phrases (e.g. "I can change space, I can change space...")
  const rawClauses = text.split(/([,.;!?]+)/);
  const uniqueClauses = [];
  const seenNorms = new Set();
  for (let i = 0; i < rawClauses.length; i += 2) {
    const clause = (rawClauses[i] || '').trim();
    const punct = rawClauses[i + 1] || '';
    if (!clause) continue;
    const norm = clause.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenNorms.has(norm)) continue;
    seenNorms.add(norm);
    uniqueClauses.push(clause + punct);
  }
  if (uniqueClauses.length > 0) {
    text = uniqueClauses.join(' ').replace(/\s+/g, ' ').trim();
  }

  // 5. Handle abrupt cutoff (e.g. generated text cut off mid-word or mid-sentence at max_tokens)
  if (text.length > 25 && !/[.!?]$/.test(text)) {
    const lastPunctuation = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
    if (lastPunctuation > 15) {
      text = text.slice(0, lastPunctuation + 1).trim();
    } else {
      // Add closing punctuation if it appears to be a complete sentence missing a period
      text = text + '.';
    }
  }

  // 6. Coherence and length check
  if (text.length < 3 || text.split(/\s+/).length < 2) {
    return getFallbackResponse(userPrompt, persona);
  }

  return text;
}

/**
 * Returns a warm, persona-aligned fallback response when the LLM produces empty or disconnected tokens
 */
function getFallbackResponse(prompt, persona) {
  const pName = persona?.name || 'your companion';
  const offlineAns = getOfflineCompanionAnswer(prompt);
  if (offlineAns) return offlineAns;
  return `I am right here with you as ${pName}. What would you like to explore next?`;
}
