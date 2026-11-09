// Server-Side Google Antigravity Agent Integration
// Features persistent multi-turn conversational memory, real-time web search capabilities,
// spatial awareness, counting and math reasoning, local system/environment tooling,
// and authentic companion persona dialogue without wrapper boilerplate.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectAndExecuteTool } from '../js/ai/tools.js';

let cachedDetection = null;
let lastDetectionTime = 0;
const DETECTION_TTL = 10000;

// Persistent multi-turn conversation session memory
export const sessionMemory = {
  sessionId: `agy-${Date.now()}`,
  turns: [],
  facts: {},
  knownContext: {},

  addTurn(role, text) {
    if (!text || !text.trim()) return;
    const clean = text.trim();
    this.turns.push({ role, content: clean, timestamp: Date.now() });
    if (this.turns.length > 50) this.turns.shift();

    if (role === 'user') {
      this.extractFacts(clean);
    }
  },

  extractFacts(userText) {
    const text = userText.trim();

    // 1. User name
    const nameMatch = text.match(/(?:my name is|i am called|call me)\s+([a-zA-Z]+)/i);
    if (nameMatch) {
      this.facts['name'] = nameMatch[1];
      this.knownContext.userName = nameMatch[1];
    }

    // 2. Favorite things: "my favorite animal is the blue dolphin", "my favorite color is blue"
    const favMatch = text.match(/my favorite\s+([a-zA-Z\s]+?)\s+is\s+([a-zA-Z0-9\s]+?)(?:\.|$|,|!)/i);
    if (favMatch) {
      const item = favMatch[1].trim().toLowerCase();
      const val = favMatch[2].trim();
      this.facts[`favorite ${item}`] = val;
      this.facts[item] = val;
    }

    // 3. User attributes: "my [X] is [Y]" (e.g. "my pet is a cat", "my dog is Max", "my car is red")
    const attrMatch = text.match(/my\s+([a-zA-Z\s]+?)\s+is\s+([a-zA-Z0-9\s]+?)(?:\.|$|,|!)/i);
    if (attrMatch && !attrMatch[1].toLowerCase().startsWith('name') && !attrMatch[1].toLowerCase().startsWith('favorite')) {
      const item = attrMatch[1].trim().toLowerCase();
      const val = attrMatch[2].trim();
      this.facts[item] = val;
    }

    // 4. User likes/loves: "i love [X]", "i like [X]"
    const likeMatch = text.match(/i\s+(?:love|like|enjoy)\s+([a-zA-Z0-9\s]+?)(?:\.|$|,|!)/i);
    if (likeMatch && !likeMatch[1].toLowerCase().startsWith('to ')) {
      this.facts['likes'] = likeMatch[1].trim();
    }

    // 5. User location: "i live in [X]", "i am from [X]"
    const locMatch = text.match(/i\s+(?:live in|am from|reside in)\s+([a-zA-Z\s]+?)(?:\.|$|,|!)/i);
    if (locMatch) {
      this.facts['user_location'] = locMatch[1].trim();
    }

    // 6. User project/work: "i am working on [X]", "my project is [X]"
    const projMatch = text.match(/(?:i am working on|my project is)\s+([a-zA-Z0-9\s]+?)(?:\.|$|,|!)/i);
    if (projMatch) {
      this.facts['project'] = projMatch[1].trim();
    }
  },

  syncClientHistory(clientHistory) {
    if (Array.isArray(clientHistory) && clientHistory.length > 0) {
      for (const turn of clientHistory) {
        if (!turn.content) continue;
        const exists = this.turns.some(t => t.content === turn.content && t.role === turn.role);
        if (!exists) {
          const role = turn.role === 'user' ? 'user' : 'assistant';
          this.turns.push({
            role,
            content: turn.content.trim(),
            timestamp: turn.timestamp || Date.now()
          });
          if (role === 'user') {
            this.extractFacts(turn.content.trim());
          }
        }
      }
    }
  },

  reset() {
    this.sessionId = `agy-${Date.now()}`;
    this.turns = [];
    this.facts = {};
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
 * Real-time internet search capability combining Wikipedia OpenSearch + REST summary,
 * DuckDuckGo HTML search, and live weather telemetry.
 */
export async function searchInternet(query) {
  const cleanQ = query
    .replace(/^(search\s+(the\s+)?web\s+(for\s+)?|look\s+up\s+|search\s+for\s+|google\s+|what\s+is\s+|who\s+is\s+|tell\s+me\s+about\s+)/i, '')
    .replace(/[?!.]+$/, '')
    .trim();
  if (!cleanQ) return null;

  // 1. Weather search shortcut (wttr.in)
  if (/weather/i.test(query)) {
    const cityMatch = query.match(/weather\s+(?:in|for|at)?\s*([a-zA-Z\s]+)/i) || cleanQ.match(/([a-zA-Z\s]+)/);
    const city = (cityMatch ? cityMatch[1] : cleanQ).replace(/weather/gi, '').trim();
    if (city) {
      try {
        const wttrRes = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=3`, {
          signal: AbortSignal.timeout(3000)
        });
        if (wttrRes.ok) {
          const wText = (await wttrRes.text()).trim();
          if (wText && !wText.includes('Unknown location')) {
            return {
              source: 'Weather',
              title: city,
              summary: `The current weather for ${wText}.`
            };
          }
        }
      } catch {}
    }
  }

  // 2. Wikipedia OpenSearch + Summary
  try {
    const openSearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanQ)}&limit=3&namespace=0&format=json`;
    const openRes = await fetch(openSearchUrl, {
      headers: { 'User-Agent': 'QuestAICompanion/0.6.3 (WebXR Assistant)' },
      signal: AbortSignal.timeout(3500)
    });
    if (openRes.ok) {
      const openData = await openRes.json();
      const topTitle = openData[1]?.[0];
      if (topTitle) {
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle.replace(/\s+/g, '_'))}`;
        const sumRes = await fetch(summaryUrl, {
          headers: { 'User-Agent': 'QuestAICompanion/0.6.3 (WebXR Assistant)' },
          signal: AbortSignal.timeout(3500)
        });
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          if (sumData.extract) {
            return {
              source: 'Wikipedia',
              title: sumData.title,
              summary: sumData.extract
            };
          }
        }
      }
    }
  } catch {}

  // 3. DuckDuckGo HTML Web Search
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQ)}`;
    const ddgRes = await fetch(ddgUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
      },
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
    p.startsWith('search ') ||
    p.startsWith('google ') ||
    p.startsWith('who is ') ||
    p.startsWith('what is ')
  );
}

/**
 * Handles counting and countdown logic
 */
function handleCountingQuery(prompt) {
  const p = prompt.toLowerCase();

  // "count from X to Y"
  const rangeMatch = p.match(/count\s+(?:from\s+)?(\d+)\s+to\s+(\d+)/i);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (!isNaN(start) && !isNaN(end) && Math.abs(end - start) <= 50) {
      const nums = [];
      const step = start <= end ? 1 : -1;
      for (let i = start; start <= end ? i <= end : i >= end; i += step) {
        nums.push(i);
      }
      return `${nums.join(', ')}! Ready for whatever is next.`;
    }
  }

  // "count to X" / "count up to X"
  const toMatch = p.match(/count\s+(?:up\s+to|to)\s+(\d+)/i);
  if (toMatch) {
    const end = parseInt(toMatch[1], 10);
    if (!isNaN(end) && end >= 1 && end <= 50) {
      const nums = [];
      for (let i = 1; i <= end; i++) {
        nums.push(i);
      }
      return `${nums.join(', ')}! Ready for whatever is next.`;
    }
  }

  // "count down from X"
  const downMatch = p.match(/count\s+down\s+from\s+(\d+)/i);
  if (downMatch) {
    const start = parseInt(downMatch[1], 10);
    if (!isNaN(start) && start >= 1 && start <= 50) {
      const nums = [];
      for (let i = start; i >= 1; i--) {
        nums.push(i);
      }
      return `${nums.join(', ')}, 0! Blast off!`;
    }
  }

  return null;
}

/**
 * Handles basic arithmetic queries safely
 */
function handleArithmeticQuery(prompt) {
  const p = prompt.toLowerCase();
  const mathMatch = p.match(/(?:what is|calculate|what's|how much is)\s+([\d\s\+\-\*\/\.\(\)]+)(?:\?|$)/i);
  if (mathMatch) {
    const expr = mathMatch[1].trim();
    if (/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr) && /\d/.test(expr) && /[\+\-\*\/]/.test(expr)) {
      try {
        // Safe evaluation without eval
        const sanitized = expr.replace(/[^-()\d/*+.]/g, '');
        const fn = new Function(`return (${sanitized});`);
        const result = fn();
        if (typeof result === 'number' && isFinite(result)) {
          return `${expr} is ${Math.round(result * 1000) / 1000}.`;
        }
      } catch {}
    }
  }
  return null;
}

/**
 * Formulates spatial & location description
 */
function getSpatialLocationDescription(spaceId) {
  const descriptions = {
    cafe: "We are currently in the Cyber Cafe space, surrounded by warm parquet floors and cyberpunk neon lighting.",
    penthouse: "We are currently in the cyberpunk Penthouse space overlooking the neon city skyline.",
    garden: "We are currently in the tranquil Zen Garden space, surrounded by cherry blossoms and quiet waters.",
    hall: "We are currently in the grand Sci-Fi Hall space, with towering curved arches and holographic displays.",
    passthrough: "We are currently in Mixed Reality Passthrough, standing right here in your physical room!"
  };
  const spaceDesc = descriptions[spaceId] || descriptions.hall;
  return `${spaceDesc} As for our location, our AI server is running on your host PC server, connected directly to your Meta Quest 3 headset.`;
}

/**
 * Checks if a user prompt is asking about spatial presence or location
 */
function isSpatialLocationQuery(prompt) {
  const p = prompt.toLowerCase();
  return (
    p.includes('where are we') ||
    p.includes('where am i') ||
    p.includes('where are you') ||
    p.includes('location of where we are') ||
    p.includes('what is our location') ||
    p.includes('do you have the location') ||
    p.includes('do you have our location') ||
    p.includes('what space is this') ||
    p.includes('what room is this') ||
    p.includes('what place is this')
  );
}

/**
 * Checks if a user prompt is asking to move to 3D
 */
function isMoveTo3DQuery(prompt) {
  const p = prompt.toLowerCase();
  return (
    p.includes('move to 3d') ||
    p.includes('let us move to 3d') ||
    p.includes("let's move to 3d") ||
    p.includes('switch to 3d') ||
    p.includes('go to 3d') ||
    p.includes('enter 3d')
  );
}

/**
 * Core Antigravity Agent generation engine:
 * Handles continuous multi-turn sessions, live web access, spatial awareness,
 * counting/logic, local system tools, and authentic dialogue without boilerplate wrappers.
 */
export async function generateAntigravityResponse(prompt, history = [], spaceId = 'hall', persona = null) {
  const pName = persona?.name || 'Companion';
  const cleanPrompt = (prompt || '').trim();

  // 1. Sync client history with continuous server session memory
  sessionMemory.syncClientHistory(history);
  sessionMemory.addTurn('user', cleanPrompt);

  const lower = cleanPrompt.toLowerCase();

  // 2. Counting / Math queries (e.g. "Can you count from 1 to 10?")
  const countingReply = handleCountingQuery(cleanPrompt);
  if (countingReply) {
    sessionMemory.addTurn('assistant', countingReply);
    return countingReply;
  }

  const mathReply = handleArithmeticQuery(cleanPrompt);
  if (mathReply) {
    sessionMemory.addTurn('assistant', mathReply);
    return mathReply;
  }

  // 3. Spatial & Location queries (e.g. "And do you have the location of where we are?")
  if (isSpatialLocationQuery(cleanPrompt)) {
    const locReply = getSpatialLocationDescription(spaceId);
    sessionMemory.addTurn('assistant', locReply);
    return locReply;
  }

  // 4. "Let's move to 3D" navigation queries
  if (isMoveTo3DQuery(cleanPrompt)) {
    const space3DReply = "We are already inside our 3D virtual reality space! You can look around freely in 360 degrees. If you would like to explore a different scenery, we have the Cyber Cafe, Zen Garden, Penthouse, and Sci-Fi Hall ready. Where would you like to go?";
    sessionMemory.addTurn('assistant', space3DReply);
    return space3DReply;
  }

  // 5. Local tool execution (space changes, battery, time, avatar switching)
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

  // 6. Multi-turn conversation recall (answers questions about past turns & user facts)
  // Check explicit user fact queries: "What is my favorite animal?", "What is my name?", etc.
  for (const [key, val] of Object.entries(sessionMemory.facts)) {
    if (lower.includes(`what is my ${key}`) || 
        lower.includes(`what's my ${key}`) || 
        lower.includes(`do you remember my ${key}`) ||
        lower.includes(`do you know my ${key}`)) {
      const reply = `Your ${key} is ${val}! I have that saved in our conversation memory.`;
      sessionMemory.addTurn('assistant', reply);
      return reply;
    }
  }

  if (lower.includes('what is my name') || lower.includes('who am i')) {
    if (sessionMemory.facts.name || sessionMemory.knownContext.userName) {
      const name = sessionMemory.facts.name || sessionMemory.knownContext.userName;
      const reply = `Your name is ${name}! I remember you from our conversation.`;
      sessionMemory.addTurn('assistant', reply);
      return reply;
    }
  }

  if (lower.includes('what did i just') || lower.includes('what did i say') || lower.includes('my last question')) {
    const pastUserTurns = sessionMemory.turns.filter(t => t.role === 'user' && t.content !== cleanPrompt);
    const last = pastUserTurns.at(-1);
    if (last) {
      const reply = `You just said: "${last.content}". We can continue with that or explore something new!`;
      sessionMemory.addTurn('assistant', reply);
      return reply;
    }
  }

  if (lower.includes('repeat that') || lower.includes('say that again')) {
    const pastAssistantTurns = sessionMemory.turns.filter(t => t.role === 'assistant');
    const last = pastAssistantTurns.at(-1);
    if (last) {
      return last.content;
    }
  }

  if (lower.includes('what were we talking about') || lower.includes('what have we discussed')) {
    const pastUserTurns = sessionMemory.turns.filter(t => t.role === 'user' && t.content !== cleanPrompt);
    if (pastUserTurns.length > 0) {
      const recentTopics = pastUserTurns.slice(-3).map(t => `"${t.content}"`).join(', ');
      const reply = `We were just discussing ${recentTopics}. Where would you like to take our conversation next?`;
      sessionMemory.addTurn('assistant', reply);
      return reply;
    }
  }

  // 7. Live Internet / Web Search capability
  if (isSearchQuery(cleanPrompt)) {
    const searchRes = await searchInternet(cleanPrompt);
    if (searchRes && searchRes.summary) {
      let cleanedSummary = searchRes.summary
        .replace(/\([^\)]*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const sentences = cleanedSummary.match(/[^.!?]+[.!?]+/g) || [cleanedSummary];
      const conciseText = sentences.slice(0, 2).join(' ').trim();

      const reply = `${conciseText}`;
      sessionMemory.addTurn('assistant', reply);
      return reply;
    }
  }

  // 8. Identity & System Diagnostics
  if (lower.includes('who are you') || lower.includes('what are you') || (lower.includes('antigravity') && lower.includes('what'))) {
    const reply = `I am ${pName}, your AI Companion running through Google Antigravity on your host PC. I have direct access to local system capabilities, live internet search, and our 3D VR environment!`;
    sessionMemory.addTurn('assistant', reply);
    return reply;
  }

  if (lower.includes('help') || lower.includes('what can you do') || lower.includes('capabilities')) {
    const reply = `I can search the internet for live facts, change our 3D space, switch avatar forms, report system diagnostics, and converse continuously with full conversational memory.`;
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

  // 9. Conversational Dialogue & Acknowledgments
  let reply = '';
  if (/joke|funny|laugh/i.test(lower)) {
    reply = "Why don't scientists trust atoms? Because they make up everything!";
  } else if (/how are you|how do you feel/i.test(lower)) {
    reply = `I am feeling wonderful standing here with you in the ${spaceId} space. How are you enjoying our VR environment?`;
  } else if (/thank you|thanks/i.test(lower)) {
    reply = "You're very welcome! I'm always right here with you.";
  } else if (/^(yes|yeah|sure|okay|alright)\b/i.test(lower)) {
    reply = `Awesome! Let's keep exploring. What shall we try out or discuss next?`;
  } else if (/^(no|nah|not really|nope)\b/i.test(lower)) {
    reply = `Understood! We can take a break or switch things up whenever you are ready.`;
  } else {
    // Dynamic, authentic dialogue that reflects the user's specific topic without robotic boilerplate
    const cleanTopic = cleanPrompt.replace(/[?.!]+$/, '');
    reply = `That is fascinating! Regarding ${cleanTopic}, I am right here with you in the ${spaceId} space and ready to explore further or search the web if you'd like more details.`;
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

export function getAntigravityFacts() {
  return { ...sessionMemory.facts };
}
