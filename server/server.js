// Standalone Cross-Platform Backend Server for Quest AI Companion
// Compatible with Windows, macOS (Apple Silicon/Intel), and Linux.
// Uses Node.js standard library with zero external dependencies required to start.
// Directly imports and shares identical agent & tool modules from ../js/ai/
// Features automatic self-upgrading when client version mismatches.

import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';
import {
  AVATAR_PERSONAS,
  getActiveAvatarPersona,
  buildAgentSystemPrompt,
  classifyUserIntent,
  cleanAndValidateSpeech,
  recordDialogueTurn,
  clearConversationHistory,
  getConversationHistory,
  getOfflineCompanionAnswer
} from '../js/ai/agent.js';
import {
  TOOL_DEFINITIONS,
  executeTool,
  detectAndExecuteTool,
  processActionTagsInModelOutput,
  getLiveEnvironmentContext
} from '../js/ai/tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

let isUpgrading = false;

/**
 * Dynamically reads the current version from version.json
 */
export function getServerVersion() {
  try {
    const raw = fs.readFileSync(path.join(ROOT_DIR, 'version.json'), 'utf-8');
    return JSON.parse(raw).version || 'v0.6.0';
  } catch {
    return 'v0.6.0';
  }
}

/**
 * Performs automatic self-upgrade when client and server versions differ
 */
export async function performAutoUpgrade(targetVersion) {
  if (isUpgrading) return { status: 'already_upgrading' };
  isUpgrading = true;
  const currentVer = getServerVersion();
  console.log(`[AutoUpgrade] 🔄 Version mismatch detected: Client is on ${targetVersion}, server is on ${currentVer}. Initiating automatic upgrade...`);

  return new Promise((resolve) => {
    exec('git pull origin main', { cwd: ROOT_DIR }, (err, stdout) => {
      if (err) {
        console.warn(`[AutoUpgrade] Note during git pull:`, err.message);
      } else {
        console.log(`[AutoUpgrade] Git pull completed:`, stdout.trim());
      }

      const updatedVer = getServerVersion();
      console.log(`[AutoUpgrade] Post-upgrade server version: ${updatedVer}`);

      // If in automated test environment, avoid process.exit()
      if (process.env.TEST_MODE === '1' || process.env.NODE_ENV === 'test') {
        isUpgrading = false;
        resolve({ status: 'reloaded_in_test', from: currentVer, version: updatedVer, target: targetVersion });
        return;
      }

      // In real standalone server mode, respawn detached process and gracefully exit current
      setTimeout(() => {
        try {
          const child = spawn(process.argv[0], process.argv.slice(1), {
            cwd: ROOT_DIR,
            detached: true,
            stdio: 'inherit'
          });
          child.unref();
          console.log(`[AutoUpgrade] ✅ Respawned upgraded server process (PID: ${child.pid}). Shutting down previous instance.`);
          process.exit(0);
        } catch (spawnErr) {
          console.error(`[AutoUpgrade] Respawn error:`, spawnErr);
          isUpgrading = false;
        }
      }, 500);

      resolve({ status: 'restarting', from: currentVer, version: updatedVer, target: targetVersion });
    });
  });
}

/**
 * Checks if a local Ollama instance is accessible on the host machine
 */
async function checkOllamaAvailability() {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      const data = await res.json();
      return { available: true, models: data.models?.map(m => m.name) || [] };
    }
  } catch {
    // Ollama not active
  }
  return { available: false, models: [] };
}

/**
 * Generate response using local Ollama if available, otherwise fast agent companion reasoning
 */
async function generateServerResponse(prompt, persona, spaceId, history) {
  const systemPrompt = buildAgentSystemPrompt({ persona, spaceId });

  // 1. Try local Ollama if host computer has it running
  const ollama = await checkOllamaAvailability();
  if (ollama.available && ollama.models.length > 0) {
    const modelToUse = ollama.models.find(m => m.includes('qwen') || m.includes('llama') || m.includes('mistral')) || ollama.models[0];
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(t => ({ role: t.role, content: t.content })),
        { role: 'user', content: prompt }
      ];

      const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          messages,
          stream: false,
          options: { temperature: 0.7, num_predict: 80 }
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (res.ok) {
        const data = await res.json();
        const rawContent = data.message?.content || '';
        if (rawContent && rawContent.trim()) {
          return { text: rawContent, source: `ollama:${modelToUse}` };
        }
      }
    } catch (e) {
      console.warn(`[Server] Ollama generation failed, falling back to built-in reasoning:`, e.message);
    }
  }

  // 2. High-speed built-in agent reasoning (Shared single-source-of-truth)
  const intent = classifyUserIntent(prompt);
  let reply = '';

  if (intent === 'identity') {
    reply = `I am ${persona.name}, your ${persona.archetype}. I am running connected to your PC server with enhanced reasoning!`;
  } else if (intent === 'greeting') {
    reply = `Hello! It is great to see you in our ${spaceId}. I am ${persona.name}, ready to explore with you.`;
  } else if (intent === 'status') {
    reply = `I am running smoothly on your computer server, feeling energized and ready to guide you in VR!`;
  } else if (intent === 'spatial') {
    reply = `We are currently in the ${spaceId} space. You can ask me to change spaces or avatars anytime!`;
  } else {
    const offlineAns = getOfflineCompanionAnswer(prompt);
    if (offlineAns) {
      reply = offlineAns;
    } else {
      reply = `I received your thought about "${prompt}". As ${persona.name}, I am processing everything over our high-speed local connection!`;
    }
  }

  return { text: reply, source: 'server-agent' };
}

/**
 * Handle HTTP Requests
 */
export function createServer() {
  return http.createServer(async (req, res) => {
    // Set CORS Headers for Quest Browser local Wi-Fi connectivity
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Version');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const clientVersion = req.headers['x-client-version'] || parsedUrl.searchParams.get('v') || null;
    const currentServerVersion = getServerVersion();

    // Read POST JSON body helper
    const readJsonBody = () => new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 10 * 1024 * 1024) { // 10MB limit
          reject(new Error('Payload too large'));
        }
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });

    let upgradeTriggered = false;
    if (clientVersion && clientVersion !== currentServerVersion && !isUpgrading) {
      console.log(`[Server] Detected client version mismatch (${clientVersion} vs server ${currentServerVersion}). Auto-upgrading...`);
      performAutoUpgrade(clientVersion);
      upgradeTriggered = true;
    }

    // Route: GET /api/health
    if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/')) {
      const ollama = await checkOllamaAvailability();
      const payload = {
        status: isUpgrading ? 'upgrading' : 'ok',
        server: 'Quest AI Companion Standalone Server',
        version: currentServerVersion,
        clientVersion: clientVersion || currentServerVersion,
        versionMatch: !clientVersion || clientVersion === currentServerVersion,
        upgradeTriggered,
        platform: os.platform(),
        arch: os.arch(),
        cores: os.cpus().length,
        memoryFreeMb: Math.round(os.freemem() / 1024 / 1024),
        memoryTotalMb: Math.round(os.totalmem() / 1024 / 1024),
        ollama: ollama.available ? { active: true, models: ollama.models } : { active: false },
        timestamp: Date.now()
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload, null, 2));
      return;
    }

    // Route: POST /api/upgrade
    if (req.method === 'POST' && pathname === '/api/upgrade') {
      const body = await readJsonBody();
      const target = body.targetVersion || clientVersion || 'latest';
      const upgradeRes = await performAutoUpgrade(target);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(upgradeRes));
      return;
    }

    // Route: GET /api/personas
    if (req.method === 'GET' && pathname === '/api/personas') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ personas: AVATAR_PERSONAS }));
      return;
    }

    // Route: GET /api/tools
    if (req.method === 'GET' && pathname === '/api/tools') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tools: TOOL_DEFINITIONS }));
      return;
    }

    // Route: POST /api/chat
    if (req.method === 'POST' && pathname === '/api/chat') {
      const t0 = performance.now();
      try {
        const body = await readJsonBody();
        const userPrompt = (body.prompt || '').trim();
        const avatarId = body.avatarId || 'maya';
        const spaceId = body.spaceId || 'hall';
        const persona = getActiveAvatarPersona(avatarId);

        if (!userPrompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing prompt parameter' }));
          return;
        }

        // 1. Check tool execution matches (e.g. "What time is it", "Change space to garden")
        const toolMatch = await detectAndExecuteTool(userPrompt);
        let executedAction = null;
        let finalReply = '';

        if (toolMatch && toolMatch.success) {
          finalReply = toolMatch.result || `Executed ${toolMatch.tool}.`;
          executedAction = toolMatch;
        } else {
          // 2. Check reset intent
          const intent = classifyUserIntent(userPrompt);
          if (intent === 'reset') {
            clearConversationHistory();
            finalReply = `I have reset our conversation memory. What would you like to discuss next?`;
          } else {
            // 3. Multi-turn context & LLM generation
            const history = getConversationHistory();
            const gen = await generateServerResponse(userPrompt, persona, spaceId, history);

            // 4. Parse action tags in output
            const actionParsed = await processActionTagsInModelOutput(gen.text);
            executedAction = actionParsed.actionExecuted;
            finalReply = cleanAndValidateSpeech(actionParsed.cleanText, userPrompt, persona);
          }
        }

        // 5. Update dialogue trajectory memory
        recordDialogueTurn('user', userPrompt);
        recordDialogueTurn('assistant', finalReply);

        const latencyMs = Math.round(performance.now() - t0);

        const responsePayload = {
          success: true,
          reply: finalReply,
          action: executedAction,
          latencyMs,
          history: getConversationHistory()
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responsePayload));
      } catch (err) {
        console.error('[Server Error in /api/chat]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // Route: POST /api/reset
    if (req.method === 'POST' && pathname === '/api/reset') {
      clearConversationHistory();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Conversation memory cleared.' }));
      return;
    }

    // Static file serving fallback for non-API routes (Allows loading the full app directly from the PC)
    let filePath = path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.glb': 'model/gltf-binary',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2'
      };
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // Fallback 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Route not found: ${pathname}` }));
  });
}

/**
 * Starts the server instance
 */
export function startServer(port = DEFAULT_PORT) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(port, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`🚀 Quest AI Companion Server running on:`);
      console.log(`   Local:   http://localhost:${port}`);
      console.log(`   Network: http://0.0.0.0:${port}`);
      console.log(`====================================================`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

// When run directly from CLI (e.g. `node server/server.js`)
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer(DEFAULT_PORT).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
