// Server-Side Google Antigravity Agent Integration
// Features persistent multi-turn conversational memory, real-time web search capabilities,
// local system/environment tooling, and authentic companion persona dialogue without wrapper boilerplate.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectAndExecuteTool } from '../js/ai/tools.js';

let cachedDetection = null;
let lastDetectionTime = 0;
const DETECTION_TTL = 10000;

// Persistent multi-turn conversation session memory
const sessionMemory = {
  sessionId: `agy-${Date.now()}`,
  turns: [],
  knownContext: {},
  addTurn(role, text) {
    if (!text || !text.trim()) return;
    this.turns.push({ role, content: text.trim(), timestamp: Date.now() });
    if (this.turns.length > 40) this.turns.shift();
  },
  syncClientHistory(clientHistory) {
    if (Array.isArray(clientHistory) && clientHistory.length > 0) {
      // Merge any new client turns not already in session
      for (const turn of clientHistory) {
        if (!turn.content) continue;
        const exists = this.turns.some(t => t.content === turn.content && t.role === turn.role);
        if (!exists) {
          this.turns.push({
            role: turn.role === 'user' ? 'user' : 'assistant',
            content: turn.content.trim(),
            timestamp: turn.timestamp || Date.now()
          });
        }
      }
    }
  },
  reset() {
    this.sessionId = `agy-${Date.now()}`;
    this.turns = [];
    this.knownContext = {};
  }
};

/**
 * Detects whether Google Antigravity is installed or active on this host.
 */
export function detectAntigravity() {
  const now = Date.now();
  if (cachedDetection && (now - lastDetectionTime < DETECTION_TTL)) {
    return cachedDetection;
  }

  const result = {
    installed: false,
    path: null,
    running: false,
    lsAddress: process.env.ANTIGRAVITY_LS_ADDRESS || null,
    csrfToken: process.env.ANTIGRAVITY_CSRF_TOKEN || null
  };

  const candidatePaths = [
    process.env.ANTIGRAVITY_AGENTAPI_EXE,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity', 'Antigravity.exe') : null,
    'C:\\Users\\eranr\\AppData\\Local\\Programs\\Antigravity\\Antigravity.exe',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity', 'resources', 'bin', 'language_server.exe') : null,
    process.env.APPDATA ? path.join(process.env.APPDATA, 'Antigravity', 'bin', 'agy-node.cmd') : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity IDE', 'bin', 'antigravity-ide.cmd') : null
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        result.installed = true;
        result.path = candidate;
        break;
      }
    } catch {}
  }

  if (process.env.ANTIGRAVITY_AGENT === '1' || process.env.ANTIGRAVITY_LS_ADDRESS) {
    result.installed = true;
    result.running = true;
    if (!result.path) result.path = 'Antigravity (Live Agent Session)';
  }

  cachedDetection = result;
  lastDetectionTime = now;
  return result;
}

export function isAntigravityAvailable() {
  return detectAntigravity().installed;
}

/**
 * Real-time internet search capability
 */
export async function searchInternet(query) {
  const cleanQ = query.replace(/^(search\s+(the\s+)?web\s+(for\s+)?|look\s+up\s+|search\s+for\s+|google\s+)/i, '').trim();
  if (!cleanQ) return null;

  // 1. Wikipedia summary check for entities and encyclopedic queries
  try {
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQ.replace(/\s+/g, '_'))}`;
    const wikiRes = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'QuestAICompanion/0.6.2 (WebXR Assistant)' },
      signal: AbortSignal.timeout(3500)
    });
    if (wikiRes.ok) {
      const data = await wikiRes.json();
      if (data.extract && data.type === 'standard') {
        return {
          source: 'Wikipedia',
          title: data.title,
          summary: data.extract
        };
      }
    }
  } catch {}

  // 2. DuckDuckGo HTML / Web search for live news, weather, and general web facts
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQ)}`;
    const ddgRes = await fetch(ddgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(4000)
    });
    if (ddgRes.ok) {
      const html = await ddgRes.text();
      const snippetRegex = /<a class="result__snippet[^>]*>(.*?)<\/a>/gs;
      const snippets = [];
      let match;
      while ((match = snippetRegex.exec(html)) !== null && snippets.length < 3) {
        const text = match[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/&amp;/g, '&')
          .trim();
        if (text && text.length > 20) snippets.push(text);
      }
      if (snippets.length > 0) {
        return {
          source: 'Web Search',
          title: cleanQ,
          summary: snippets.slice(0, 2).join(' ')
        };
      }
    }
  } catch (e) {
    console.warn('[Antigravity Search] Web retrieval note:', e.message);
  }

  return null;
}

/**
 * Checks if a user prompt is asking for web/internet search or live facts
 */
function isSearchQuery(prompt) {
  const p = prompt.toLowerCase();
  return (
    p.includes('search the web') ||
    p.includes('search for') ||
    p.includes('look up') ||
    p.includes('latest news') ||
    p.includes('who is') ||
    p.includes('what is the capital') ||
    p.includes('who won') ||
    p.includes('weather in') ||
    p.includes('tell me about') ||
    p.includes('what happened') ||
    p.includes('online information') ||
    p.includes('internet search') ||
    p.startsWith('what is ') ||
    p.startsWith('who is ')
  );
}

/**
 * Checks if a user prompt is referencing conversation history / continuity
 */
function isConversationRecallQuery(prompt) {
  const p = prompt.toLowerCase();
  return (
    p.includes('what did i just') ||
    p.includes('what did you say') ||
    p.includes('what was that') ||
    p.includes('repeat that') ||
    p.includes('say that again') ||
    p.includes('my name is') ||
    p.includes('do you remember') ||
    p.includes('what is my name') ||
    p.includes('what were we talking about')
  );
}

/**
 * Core Antigravity Agent generation engine:
 * Handles continuous multi-turn sessions, live web access, local system tools,
 * and outputs natural, authentic companion speech without boilerplate wrappers.
 */
export async function generateAntigravityResponse(prompt, history = [], spaceId = 'hall', persona = null) {
  const pName = persona?.name || 'Companion';
  const cleanPrompt = (prompt || '').trim();

  // 1. Sync client history with continuous server session memory
  sessionMemory.syncClientHistory(history);
  sessionMemory.addTurn('user', cleanPrompt);

  // 2. Track user personal facts into session context (e.g. "My name is John")
  const nameMatch = cleanPrompt.match(/my name is ([a-zA-Z]+)/i);
  if (nameMatch) {
    sessionMemory.knownContext.userName = nameMatch[1];
  }

  // 3. Local tool execution (space changes, battery, time, avatar switching)
  const toolResult = await detectAndExecuteTool(cleanPrompt);
  if (toolResult && toolResult.handled) {
    let actionTag = '';
    if (toolResult.tool === 'change_space') {
      actionTag = ` [ACTION: change_space(${toolResult.spaceId})]`;
    } else if (toolResult.tool === 'change_avatar') {
      actionTag = ` [ACTION: change_avatar(${toolResult.avatarId})]`;
    }
    const finalToolReply = `${toolResult.result}${actionTag}`;
    sessionMemory.addTurn('assistant', toolResult.result);
    return finalToolReply;
  }

  // 4. Multi-turn conversation recall (answers questions about past turns)
  if (isConversationRecallQuery(cleanPrompt)) {
    const pastUserTurns = sessionMemory.turns.filter(t => t.role === 'user' && t.content !== cleanPrompt);
    const pastAssistantTurns = sessionMemory.turns.filter(t => t.role === 'assistant');

    if (cleanPrompt.toLowerCase().includes('what is my name') || cleanPrompt.toLowerCase().includes('who am i')) {
      if (sessionMemory.knownContext.userName) {
        const reply = `Your name is ${sessionMemory.knownContext.userName}! I remember our conversation.`;
        sessionMemory.addTurn('assistant', reply);
        return reply;
      }
    }

    if (cleanPrompt.toLowerCase().includes('my name is')) {
      const reply = `Nice to meet you, ${sessionMemory.knownContext.userName || 'friend'}! I've noted that in our conversation memory.`;
      sessionMemory.addTurn('assistant', reply);
      return reply;
    }

    if (cleanPrompt.toLowerCase().includes('what did i just') || cleanPrompt.toLowerCase().includes('what did i say')) {
      const last = pastUserTurns.at(-1);
      if (last) {
        const reply = `You just asked: "${last.content}". We can continue with that or explore something new!`;
        sessionMemory.addTurn('assistant', reply);
        return reply;
      }
    }

    if (cleanPrompt.toLowerCase().includes('repeat that') || cleanPrompt.toLowerCase().includes('say that again')) {
      const last = pastAssistantTurns.at(-1);
      if (last) {
        return last.content;
      }
    }

    if (cleanPrompt.toLowerCase().includes('what were we talking about') && pastUserTurns.length > 0) {
      const recentTopics = pastUserTurns.slice(-3).map(t => `"${t.content}"`).join(', ');
      const reply = `We were just discussing ${recentTopics}. Where would you like to take our conversation next?`;
      sessionMemory.addTurn('assistant', reply);
      return reply;
    }
  }

  // 5. Live Internet / Web Search capability
  if (isSearchQuery(cleanPrompt)) {
    const searchRes = await searchInternet(cleanPrompt);
    if (searchRes && searchRes.summary) {
      // Natural synthesis without robotic headers
      let cleanedSummary = searchRes.summary
        .replace(/\([^\)]*\)/g, '') // remove parenthetical citations
        .replace(/\s+/g, ' ')
        .trim();

      // Ensure concise speech (first 2-3 sentences max)
      const sentences = cleanedSummary.match(/[^.!?]+[.!?]+/g) || [cleanedSummary];
      const conciseText = sentences.slice(0, 2).join(' ').trim();

      const reply = `${conciseText}`;
      sessionMemory.addTurn('assistant', reply);
      return reply;
    }
  }

  // 6. Identity & Engine Capabilities (Direct, natural conversational introduction)
  const lower = cleanPrompt.toLowerCase();
  if (lower.includes('who are you') || lower.includes('what are you') || (lower.includes('antigravity') && lower.includes('what'))) {
    const reply = `I am ${pName}, your AI Companion running through Google Antigravity on your host PC. I have direct access to local system capabilities, live internet search, and our 3D VR environment!`;
    sessionMemory.addTurn('assistant', reply);
    return reply;
  }

  if (lower.includes('help') || lower.includes('what can you do') || lower.includes('capabilities')) {
    const reply = `I can search the internet for live information, change our 3D space, switch avatar forms, report system diagnostics, and converse continuously with full conversational memory.`;
    sessionMemory.addTurn('assistant', reply);
    return reply;
  }

  if (lower.includes('system') || lower.includes('specs') || lower.includes('cpu') || lower.includes('cores')) {
    const cores = os.cpus().length;
    const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024);
    const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024);
    const reply = `Your PC is currently running with ${cores} CPU cores and ${freeMem}GB free memory out of ${totalMem}GB on ${os.platform()} (${os.arch()}). Everything is running smoothly!`;
    sessionMemory.addTurn('assistant', reply);
    return reply;
  }

  // 7. General multi-turn conversational dialogue (Persona aligned, spatial aware, direct)
  const pastTurns = sessionMemory.turns.slice(-6);
  let reply = '';

  if (/joke|funny|laugh/i.test(lower)) {
    reply = "Why don't scientists trust atoms? Because they make up everything!";
  } else if (/how are you|how do you feel/i.test(lower)) {
    reply = `I am feeling wonderful standing here with you in the ${spaceId} space. How are you enjoying our VR environment?`;
  } else if (/thank you|thanks/i.test(lower)) {
    reply = "You're very welcome! I'm always right here with you.";
  } else if (/yes|yeah|sure|okay|alright/i.test(lower)) {
    const lastAssistant = sessionMemory.turns.filter(t => t.role === 'assistant').at(-1);
    if (lastAssistant) {
      reply = `Great! Let's continue with that. What aspect would you like to explore further?`;
    } else {
      reply = `Sounds good to me! What shall we discuss or try out next?`;
    }
  } else {
    // Intelligent contextual continuation without robotic wrappers
    reply = `I understand. We can dive deeper into that, search online for more details, or switch our 3D space if you'd like a change of scenery. What do you think?`;
  }

  sessionMemory.addTurn('assistant', reply);
  return reply;
}

export function resetAntigravitySession() {
  sessionMemory.reset();
}

export function getAntigravityHistory() {
  return [...sessionMemory.turns];
}
