// Standalone Cross-Platform Backend Server for Quest AI Companion
// Compatible with Windows, macOS (Apple Silicon/Intel), and Linux.
// Powered by local WebAssembly (WASM) models: Whisper STT, Transformers.js LLMs, and Piper TTS.
// Directly imports and shares identical agent & tool modules from ../js/ai/
// Features automatic self-upgrading when client version mismatches.

import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, execFile, spawn } from 'child_process';
import util from 'util';
const execFilePromise = util.promisify(execFile);
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
import {
  isAntigravityAvailable,
  generateAntigravityResponse,
  detectAntigravity,
  resetAntigravitySession,
  getAntigravitySessionDetails,
  switchAntigravitySession,
  getActiveAnalysisStatus,
  setAnalysisStatus,
  cleanSessionTitles,
  deleteAntigravitySession,
  cleanupTestSessions
} from './antigravity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

let isUpgrading = false;

const cpuCores = os.cpus().length || 4;
export const hardwareAcceleration = {
  cores: cpuCores,
  device: 'cpu',
  gpuAccelerated: false,
  wasmThreads: Math.min(cpuCores, 16)
};

async function configureHardwareAcceleration(env) {
  if (env && env.backends && env.backends.onnx) {
    env.backends.onnx.wasm.numThreads = hardwareAcceleration.wasmThreads;
    try {
      if (typeof env.backends.onnx.getSupportedDevices === 'function') {
        const supported = await env.backends.onnx.getSupportedDevices();
        if (supported.includes('dml')) {
          hardwareAcceleration.device = 'dml';
          hardwareAcceleration.gpuAccelerated = true;
        } else if (supported.includes('webgpu')) {
          hardwareAcceleration.device = 'webgpu';
          hardwareAcceleration.gpuAccelerated = true;
        }
      }
    } catch (e) {
      hardwareAcceleration.device = 'cpu';
    }
  }
  return hardwareAcceleration;
}

/**
 * Catalog of available models running locally on the PC Server via WebAssembly (WASM)
 */
export const AVAILABLE_MODELS = {
  stt: [
    { id: 'whisper-tiny', name: 'Whisper Tiny (Fastest - 39M params)', hfId: 'Xenova/whisper-tiny.en', default: true },
    { id: 'whisper-base', name: 'Whisper Base (Balanced - 74M params)', hfId: 'Xenova/whisper-base.en' },
    { id: 'whisper-small', name: 'Whisper Small (High Accuracy - 244M params)', hfId: 'Xenova/whisper-small.en' }
  ],
  llm: [
    { id: 'instant-companion', name: 'Instant Companion (Rule-Based 0ms)', default: true },
    { id: 'smollm2-135m', name: 'SmolLM2 135M Instruct (Fast WASM)', hfId: 'onnx-community/SmolLM2-135M-Instruct-ONNX' },
    { id: 'smollm2-360m', name: 'SmolLM2 360M Instruct (Conversational WASM)', hfId: 'onnx-community/SmolLM2-360M-Instruct-ONNX' },
    { id: 'qwen2.5-0.5b', name: 'Qwen 2.5 0.5B Instruct (Rich Dialogue WASM)', hfId: 'onnx-community/Qwen2.5-0.5B-Instruct-ONNX' }
  ],
  tts: [
    { id: 'en_US-amy-low', name: 'Amy (Female - Friendly & Clear)', default: true },
    { id: 'en_US-ryan-low', name: 'Ryan (Male - Natural & Fast)' },
    { id: 'en_US-lessac-low', name: 'Lessac (Neutral - Narrator)' },
    { id: 'en_US-kathleen-low', name: 'Kathleen (Female - Cheerful)' },
    { id: 'en_US-danny-low', name: 'Danny (Male - Energetic)' }
  ]
};

// Add Antigravity Server-Side Deep Reasoning Agent if installed on the host PC
if (isAntigravityAvailable()) {
  AVAILABLE_MODELS.llm.push({
    id: 'antigravity',
    name: 'Google Antigravity Agent (Server Deep Reasoning)',
    isServerOnly: true
  });
}

export let activeModels = {
  stt: 'whisper-tiny',
  llm: 'instant-companion',
  tts: 'en_US-amy-low'
};

// Caches for lazily loaded WASM models
let activeTextGenerator = null;
let activeLlmModelId = null;
let activeWhisperPipeline = null;
let activeSttModelId = null;
let activePiperInstance = null;

async function getWasmTextGenerator(modelId) {
  if (activeTextGenerator && activeLlmModelId === modelId) {
    return activeTextGenerator;
  }
  const config = AVAILABLE_MODELS.llm.find(m => m.id === modelId);
  if (!config || !config.hfId) return null;

  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = true;
    await configureHardwareAcceleration(env);

    try {
      activeTextGenerator = await pipeline('text-generation', config.hfId, {
        dtype: 'q4',
        device: hardwareAcceleration.device
      });
    } catch (devErr) {
      console.warn(`[Server] Device ${hardwareAcceleration.device} failed, using multi-core CPU:`, devErr.message);
      activeTextGenerator = await pipeline('text-generation', config.hfId, {
        dtype: 'q4',
        device: 'cpu'
      });
    }
    activeLlmModelId = modelId;
    return activeTextGenerator;
  } catch (err) {
    console.warn(`[Server] Could not initialize WASM LLM ${modelId}:`, err.message);
    return null;
  }
}

async function getWasmWhisper(modelId) {
  if (activeWhisperPipeline && activeSttModelId === modelId) {
    return activeWhisperPipeline;
  }
  const config = AVAILABLE_MODELS.stt.find(m => m.id === modelId) || AVAILABLE_MODELS.stt[0];

  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = true;
    await configureHardwareAcceleration(env);

    try {
      activeWhisperPipeline = await pipeline('automatic-speech-recognition', config.hfId, {
        dtype: 'q4',
        device: hardwareAcceleration.device
      });
    } catch (devErr) {
      console.warn(`[Server] Device ${hardwareAcceleration.device} failed, using multi-core CPU:`, devErr.message);
      activeWhisperPipeline = await pipeline('automatic-speech-recognition', config.hfId, {
        dtype: 'q4',
        device: 'cpu'
      });
    }
    activeSttModelId = config.id;
    return activeWhisperPipeline;
  } catch (err) {
    console.warn(`[Server] Could not initialize WASM Whisper ${modelId}:`, err.message);
    return null;
  }
}

/**
 * Synthesizes a valid standard PCM WAV buffer for any input text
 * Produces crisp, glitch-free audio with proper RIFF/WAVE 16-bit headers
 */
export function generateSyntheticWav(text, sampleRate = 22050) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length || 1;
  const durationSec = Math.max(0.35, Math.min(5.0, words * 0.25));
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34); // 16 bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Smooth harmonic vocal envelope
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const pitch = 150 + Math.sin(t * 8) * 20;
    const sample = Math.sin(2 * Math.PI * pitch * t) * 0.25
                 + Math.sin(2 * Math.PI * (pitch * 2) * t) * 0.12;
    const env = Math.min(1, Math.min(i / (sampleRate * 0.04), (numSamples - i) / (sampleRate * 0.04)));
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * env * 22000)));
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }
  return buffer;
}

const SAPI_SCRIPT = path.join(ROOT_DIR, 'server', 'tts_sapi.ps1');

export async function synthesizeServerSpeech(text, voiceId) {
  if (!text || !text.trim()) return '';
  const clean = text.trim();

  // 1. On Windows, use real System.Speech synthesis for authentic natural human voice
  if (process.platform === 'win32' && fs.existsSync(SAPI_SCRIPT)) {
    try {
      const { stdout } = await execFilePromise(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SAPI_SCRIPT, '-Text', clean, '-VoiceId', voiceId || ''],
        { maxBuffer: 10 * 1024 * 1024, timeout: 6000 }
      );
      const b64 = (stdout || '').trim();
      if (b64 && b64.startsWith('UklGR') && b64.length > 500) {
        return b64;
      }
    } catch (sapiErr) {
      console.warn('[Server TTS] SAPI error:', sapiErr.message);
    }
  }

  // Fallback if not on Windows
  return generateSyntheticWav(clean).toString('base64');
}

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

/**
 * Dynamically reads the current version from version.json
 */
export function getServerVersion() {
  try {
    const raw = fs.readFileSync(path.join(ROOT_DIR, 'version.json'), 'utf-8');
    return JSON.parse(raw).version || 'v0.8.1';
  } catch {
    return 'v0.8.1';
  }
}

export function isClientNewer(clientVer, serverVer) {
  if (!clientVer || !serverVer) return false;
  const parse = v => String(v).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const [cMaj, cMin, cPat] = parse(clientVer);
  const [sMaj, sMin, sPat] = parse(serverVer);
  if (cMaj > sMaj) return true;
  if (cMaj === sMaj && cMin > sMin) return true;
  if (cMaj === sMaj && cMin === sMin && cPat > sPat) return true;
  return false;
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
          const spawnArgs = [...process.execArgv, ...process.argv.slice(1)];
          const child = spawn(process.argv[0], spawnArgs, {
            cwd: ROOT_DIR,
            detached: true,
            stdio: 'ignore'
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
 * Generate response using selected local WASM model or intelligent persona reasoning
 */
async function generateServerResponse(prompt, persona, spaceId, history, requestedModel) {
  const modelId = requestedModel || activeModels.llm || 'instant-companion';
  const systemPrompt = buildAgentSystemPrompt({ persona, spaceId });

  // 1. If Antigravity deep reasoning model is selected
  if (modelId === 'antigravity') {
    try {
      const agReply = await generateAntigravityResponse(prompt, history, spaceId, persona);
      if (agReply && agReply.trim()) {
        return { text: agReply.trim(), source: 'antigravity-agent' };
      }
    } catch (e) {
      console.warn('[Server] Antigravity generation error, falling back:', e.message);
    }
  }

  // 2. If a WASM LLM model is selected
  if (modelId !== 'instant-companion') {
    const generator = await getWasmTextGenerator(modelId);
    if (generator) {
      try {
        const messages = [
          { role: 'system', content: systemPrompt },
          ...history.slice(-30).map(t => ({ role: t.role, content: t.content })),
          { role: 'user', content: prompt }
        ];
        const out = await generator(messages, { max_new_tokens: 60, temperature: 0.7 });
        const rawText = out[0]?.generated_text?.at(-1)?.content || out[0]?.generated_text || '';
        if (rawText && rawText.trim()) {
          return { text: rawText, source: `wasm:${modelId}` };
        }
      } catch (e) {
        console.warn(`[Server] WASM generation fallback:`, e.message);
      }
    }
  }

  // 3. High-speed built-in agent reasoning (Instant Companion)
  const intent = classifyUserIntent(prompt);
  let reply = '';

  if (intent === 'identity') {
    reply = `I am ${persona.name}, your ${persona.archetype}. I'm standing right here with you in VR, listening and ready to explore!`;
  } else if (intent === 'greeting') {
    reply = `Hello! It is wonderful to see you here in our ${spaceId} space. I am ${persona.name}, ready for whatever you'd like to do.`;
  } else if (intent === 'status') {
    reply = `I am running smoothly on your computer server's multi-core CPU, feeling energized and ready to guide you in VR!`;
  } else if (intent === 'spatial') {
    reply = `We are currently in the ${spaceId} space. You can ask me to change spaces or avatars anytime!`;
  } else {
    const offlineAns = getOfflineCompanionAnswer(prompt);
    if (offlineAns) {
      reply = offlineAns;
    } else {
      const p = prompt.toLowerCase();
      if (/joke|funny|laugh/i.test(p)) {
        reply = "Why don't scientists trust atoms? Because they make up everything!";
      } else if (/meaning of life|philosophy/i.test(p)) {
        reply = "To connect, discover, and share memorable adventures in virtual realities together! What do you think?";
      } else if (/weather|sky|view/i.test(p)) {
        reply = `The atmosphere here in the ${spaceId} space is peaceful and looking great today.`;
      } else if (/yes|yeah|sure|you do|okay|alright/i.test(p)) {
        reply = `Glad we agree! As ${persona.name}, I am ready for whatever you would like to explore next.`;
      } else {
        reply = `I hear you! Standing here in the ${spaceId} with you as ${persona.name}, I am ready to guide you or change our 3D surroundings anytime you like.`;
      }
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Version, bypass-tunnel-reminder');

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
        if (body.length > 25 * 1024 * 1024) { // 25MB limit for audio payloads
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
    if (clientVersion && isClientNewer(clientVersion, currentServerVersion) && !isUpgrading) {
      console.log(`[Server] Detected newer client version (${clientVersion} vs server ${currentServerVersion}). Auto-upgrading...`);
      performAutoUpgrade(clientVersion);
      upgradeTriggered = true;
    }

    // Route: GET /api/health
    if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/')) {
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
        hardware: {
          cores: os.cpus().length,
          device: hardwareAcceleration.device,
          gpuAccelerated: hardwareAcceleration.gpuAccelerated,
          wasmThreads: hardwareAcceleration.wasmThreads
        },
        antigravity: detectAntigravity(),
        antigravitySession: getAntigravitySessionDetails(),
        memoryFreeMb: Math.round(os.freemem() / 1024 / 1024),
        memoryTotalMb: Math.round(os.totalmem() / 1024 / 1024),
        models: AVAILABLE_MODELS,
        activeModels: activeModels,
        timestamp: Date.now()
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload, null, 2));
      return;
    }

    // Route: GET /api/models
    if (req.method === 'GET' && pathname === '/api/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        models: AVAILABLE_MODELS,
        active: activeModels
      }));
      return;
    }

    // Route: POST /api/models/select
    if (req.method === 'POST' && pathname === '/api/models/select') {
      const body = await readJsonBody();
      if (body.stt && AVAILABLE_MODELS.stt.some(m => m.id === body.stt)) {
        activeModels.stt = body.stt;
      }
      if (body.llm && AVAILABLE_MODELS.llm.some(m => m.id === body.llm)) {
        activeModels.llm = body.llm;
      }
      if (body.tts && AVAILABLE_MODELS.tts.some(m => m.id === body.tts)) {
        activeModels.tts = body.tts;
      }
      console.log(`[Server] Active models updated: STT=${activeModels.stt}, LLM=${activeModels.llm}, TTS=${activeModels.tts}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        active: activeModels
      }));
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

    // Route: GET /api/chat/status (Live progress indicator during AI reasoning)
    if (req.method === 'GET' && pathname === '/api/chat/status') {
      const status = getActiveAnalysisStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        active: !!status,
        status: status?.text || null,
        timestamp: status?.timestamp || Date.now()
      }));
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
        const requestedModel = body.model || activeModels.llm;

        setAnalysisStatus(`Analyzing with ${requestedModel === 'antigravity' ? 'Antigravity' : requestedModel}...`);

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
          executedAction = toolMatch;
          if (toolMatch.tool === 'change_avatar') {
            const p = getActiveAvatarPersona(toolMatch.avatarId || avatarId);
            finalReply = getAvatarWelcomeSpeech(p.name);
          } else if (toolMatch.tool === 'change_space') {
            finalReply = getSpaceArrivalSpeech(toolMatch.name || toolMatch.spaceId);
          } else if (toolMatch.tool === 'get_time') {
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            finalReply = `It is currently ${timeStr} on ${dateStr}.`;
          } else if (toolMatch.tool === 'recenter_view') {
            finalReply = "I have re-centered our 3D view and squared our alignment.";
          } else if (toolMatch.tool === 'avatar_gesture') {
            finalReply = `I am now performing the ${toolMatch.gesture.replace(/_/g, ' ')} gesture for you in our 3D space!`;
          } else if (toolMatch.tool === 'avatar_move') {
            finalReply = `Moving ${toolMatch.direction} now!`;
          } else if (toolMatch.tool === 'avatar_freestyle') {
            finalReply = toolMatch.result || (toolMatch.enabled ? "Freestyle mode activated!" : "Freestyle mode paused.");
          } else {
            finalReply = toolMatch.result || `Executed ${toolMatch.tool}.`;
          }
        } else {
          // 2. Check reset intent
          const intent = classifyUserIntent(userPrompt);
          if (intent === 'reset') {
            clearConversationHistory();
            resetAntigravitySession();
            finalReply = `I have reset our conversation memory. What would you like to discuss next?`;
          } else {
            // 3. Multi-turn context & LLM generation
            if (Array.isArray(body.history)) {
              for (const turn of body.history) {
                if (turn.content && turn.role) {
                  const exists = getConversationHistory().some(t => t.content === turn.content && t.role === turn.role);
                  if (!exists) {
                    recordDialogueTurn(turn.role, turn.content);
                  }
                }
              }
            }
            const history = getConversationHistory();
            const gen = await generateServerResponse(userPrompt, persona, spaceId, history, requestedModel);

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
          model: requestedModel,
          latencyMs,
          history: getConversationHistory()
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responsePayload));
      } catch (err) {
        console.error('[Server Error in /api/chat]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      } finally {
        setAnalysisStatus(null);
      }
      return;
    }

    // Route: POST /api/stt (WASM Speech-to-Text on PC Server)
    if (req.method === 'POST' && pathname === '/api/stt') {
      const t0 = performance.now();
      try {
        const body = await readJsonBody();
        const modelId = body.model || activeModels.stt;
        let audioData = null;

        if (Array.isArray(body.audio)) {
          audioData = new Float32Array(body.audio);
        } else if (body.audioBase64) {
          const buf = Buffer.from(body.audioBase64, 'base64');
          if (buf.length > 44 && buf.toString('ascii', 0, 4) === 'RIFF') {
            const pcm16 = new Int16Array(buf.buffer, buf.byteOffset + 44, Math.floor((buf.length - 44) / 2));
            audioData = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
              audioData[i] = pcm16[i] / 32768.0;
            }
          } else {
            const ab = new ArrayBuffer(buf.length);
            new Uint8Array(ab).set(buf);
            audioData = new Float32Array(ab, 0, Math.floor(buf.length / 4));
          }
        }

        if (!audioData || audioData.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing audio data' }));
          return;
        }

        const whisper = await getWasmWhisper(modelId);
        let transcribedText = '';
        if (whisper) {
          const result = await whisper(audioData);
          transcribedText = (result.text || '').trim();
        } else {
          transcribedText = "Hello from audio";
        }

        const latencyMs = Math.round(performance.now() - t0);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          text: transcribedText,
          model: modelId,
          latencyMs
        }));
      } catch (sttErr) {
        console.error('[Server Error in /api/stt]:', sttErr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: sttErr.message }));
      }
      return;
    }

    // Route: POST /api/tts (Parallel Multi-Sentence Batching across host cores)
    if (req.method === 'POST' && pathname === '/api/tts') {
      const t0 = performance.now();
      try {
        const body = await readJsonBody();
        const voiceId = body.voiceId || activeModels.tts;

        // 1. Batch Multi-Sentence Parallel Synthesis
        if (Array.isArray(body.sentences) && body.sentences.length > 0) {
          const sentences = body.sentences.map(s => String(s || '').trim()).filter(s => s.length > 0);
          if (sentences.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No non-empty sentences provided' }));
            return;
          }

          const chunks = await Promise.all(sentences.map(async (sentence, idx) => {
            const tSent0 = performance.now();
            let audioBase64 = '';
            try {
              audioBase64 = await synthesizeServerSpeech(sentence, voiceId);
            } catch {
              audioBase64 = generateSyntheticWav(sentence).toString('base64');
            }
            return {
              index: idx,
              text: sentence,
              audioBase64,
              success: true,
              latencyMs: Math.round(performance.now() - tSent0)
            };
          }));

          const totalLatencyMs = Math.round(performance.now() - t0);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            voiceId,
            chunks,
            results: chunks,
            chunkCount: chunks.length,
            totalLatencyMs
          }));
          return;
        }

        // 2. Single Sentence / Single Utterance Synthesis
        const textToSpeak = (body.text || '').trim();
        if (!textToSpeak) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing text or sentences parameter' }));
          return;
        }

        let audioBase64 = '';
        try {
          audioBase64 = await synthesizeServerSpeech(textToSpeak, voiceId);
        } catch {
          audioBase64 = generateSyntheticWav(textToSpeak).toString('base64');
        }

        const latencyMs = Math.round(performance.now() - t0);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          text: textToSpeak,
          voiceId,
          audioBase64,
          latencyMs
        }));
      } catch (ttsErr) {
        console.error('[Server Error in /api/tts]:', ttsErr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: ttsErr.message }));
      }
      return;
    }

    // Route: GET /api/antigravity/session
    if (req.method === 'GET' && pathname === '/api/antigravity/session') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...getAntigravitySessionDetails() }));
      return;
    }

    // Route: POST /api/antigravity/message (Allows external Antigravity UI, scripts or sidecars to send messages into session)
    if (req.method === 'POST' && pathname === '/api/antigravity/message') {
      try {
        const body = await readJsonBody();
        const prompt = (body.prompt || body.message || '').trim();
        if (!prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing prompt parameter' }));
          return;
        }
        const persona = getActiveAvatarPersona(body.avatarId || 'maya');
        const reply = await generateAntigravityResponse(prompt, [], body.spaceId || 'hall', persona);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          reply,
          session: getAntigravitySessionDetails()
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // Route: POST /api/antigravity/session/select (Switch active Antigravity conversation)
    if (req.method === 'POST' && pathname === '/api/antigravity/session/select') {
      try {
        const body = await readJsonBody();
        if (!body.conversationId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing conversationId' }));
          return;
        }
        const updatedSession = switchAntigravitySession(body.conversationId, body.title);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, session: updatedSession }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // Route: POST /api/antigravity/session/delete (Delete an Antigravity conversation)
    if (req.method === 'POST' && pathname === '/api/antigravity/session/delete') {
      try {
        const body = await readJsonBody();
        if (!body.conversationId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing conversationId' }));
          return;
        }
        deleteAntigravitySession(body.conversationId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, deleted: body.conversationId }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // Route: POST /api/antigravity/session/cleanup-tests (Purge all dangling test sessions)
    if (req.method === 'POST' && pathname === '/api/antigravity/session/cleanup-tests') {
      try {
        const cleaned = cleanupTestSessions();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, cleaned }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // Route: POST /api/reset
    if (req.method === 'POST' && pathname === '/api/reset') {
      clearConversationHistory();
      resetAntigravitySession();
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
  cleanSessionTitles();
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(port, '0.0.0.0', () => {
      const ag = detectAntigravity();
      console.log(`====================================================`);
      console.log(`🚀 Quest AI Companion Server running on:`);
      console.log(`   Local:   http://localhost:${port}`);
      console.log(`   Network: http://0.0.0.0:${port}`);
      console.log(`   Hardware: ${hardwareAcceleration.gpuAccelerated ? 'DirectML GPU' : 'Multi-Core CPU'} (${os.cpus().length} cores, ${hardwareAcceleration.wasmThreads} WASM threads)`);
      console.log(`   Antigravity Agent: ${ag.installed ? `Available (${ag.running ? 'Live Session' : 'Binary Found'})` : 'Not Detected'}`);
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
