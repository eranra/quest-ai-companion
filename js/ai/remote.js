// Remote PC Server Client Connector for Meta Quest AI Companion
// Connects Quest 3 headset over local Wi-Fi to a standalone server running on Mac / PC / Linux
import { AppState } from '../state.js';
import { logDebug } from '../ui/debug_logger.js';
import { executeTool } from './tools.js';

let clientVersion = 'v0.6.0';
let heartbeatTimer = null;
let onServerStatusChangeCallback = null;
let cachedRemoteModels = null;
let cachedActiveRemoteModels = null;

export function getCachedRemoteModels() {
  return cachedRemoteModels;
}

export function getCachedActiveRemoteModels() {
  return cachedActiveRemoteModels;
}

export function setClientVersion(v) {
  if (v) clientVersion = v;
}

export function getClientVersion() {
  return clientVersion;
}

/**
 * Normalizes URL string to guarantee protocol and remove trailing slashes
 */
export function normalizeServerUrl(url) {
  if (!url || !url.trim()) return 'http://localhost:8080';
  let clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) {
    clean = `http://${clean}`;
  }
  return clean.replace(/\/+$/, '');
}

/**
 * Checks connectivity to the standalone PC/Mac server and validates version lockstep
 */
export async function checkRemoteServerResponsiveness(targetUrl) {
  const url = normalizeServerUrl(targetUrl || AppState.remoteServerUrl);
  logDebug('REMOTE', `Checking connectivity to server: ${url}...`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${url}/api/health?v=${encodeURIComponent(clientVersion)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Client-Version': clientVersion,
        'bypass-tunnel-reminder': 'true'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.models) {
        cachedRemoteModels = data.models;
      }
      if (data.activeModels) {
        cachedActiveRemoteModels = data.activeModels;
      }
      if (data.status === 'upgrading' || data.upgradeTriggered) {
        AppState.remoteServerStatus = 'upgrading';
        logDebug('REMOTE', `Server is automatically upgrading to ${clientVersion}...`);
      } else {
        AppState.remoteServerStatus = 'online';
        logDebug('REMOTE', `Connected to server! ${data.server} on ${data.platform} (${data.cores} cores)`);
      }

      return {
        responsive: true,
        server: data.server,
        platform: data.platform,
        cores: data.cores,
        serverVersion: data.version,
        clientVersion: data.clientVersion,
        versionMatch: data.versionMatch,
        upgrading: data.status === 'upgrading' || data.upgradeTriggered,
        memoryFreeMb: data.memoryFreeMb,
        models: data.models || null,
        activeModels: data.activeModels || null
      };
    } else {
      AppState.remoteServerStatus = 'offline';
      return { responsive: false, reason: `Server returned HTTP ${res.status}` };
    }
  } catch (err) {
    AppState.remoteServerStatus = 'offline';
    const reason = err.name === 'AbortError' ? 'Connection timed out (Check IP & firewall)' : err.message;
    logDebug('REMOTE', `Server unreachable at ${url}: ${reason}`, 'error');
    return { responsive: false, reason };
  }
}

/**
 * Starts periodic heartbeat between Quest 3 and Standalone PC Server
 * Ensures live connectivity monitoring and automatic version synchronization
 */
export function startRemoteHeartbeat(onStatusChange, intervalMs = 6000) {
  stopRemoteHeartbeat();
  onServerStatusChangeCallback = onStatusChange;

  const ping = async () => {
    if (AppState.engine !== 'remote') return;
    try {
      const check = await checkRemoteServerResponsiveness();
      if (onServerStatusChangeCallback) {
        onServerStatusChangeCallback(check);
      }
    } catch (e) {
      // Status recorded in checkRemoteServerResponsiveness
    }
  };

  // Immediate initial check + scheduled interval
  ping();
  heartbeatTimer = setInterval(ping, intervalMs);
}

/**
 * Stops the periodic heartbeat timer
 */
export function stopRemoteHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Dispatch prompt to the Standalone PC Server over local Wi-Fi
 */
export async function callRemoteBackend(prompt, signal, context = {}) {
  const url = normalizeServerUrl(AppState.remoteServerUrl);
  const cleanPrompt = (prompt || '').trim();

  logDebug('REMOTE', `Sending prompt to PC server (${url}): "${cleanPrompt}"`);

  try {
    const payload = {
      prompt: cleanPrompt,
      avatarId: AppState.avatarId,
      spaceId: AppState.spaceId,
      model: AppState.remoteLlmModel || 'instant-companion',
      history: context.history || []
    };

    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Version': clientVersion,
        'bypass-tunnel-reminder': 'true'
      },
      body: JSON.stringify(payload),
      signal
    });

    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }

    const data = await res.json();
    logDebug('REMOTE', `PC server response received in ${data.latencyMs || 0}ms`);

    // If server dispatched an environment action (e.g. space change or avatar switch), apply it locally on Quest 3!
    if (data.action && data.action.tool) {
      try {
        logDebug('REMOTE', `Executing server-dispatched action: ${data.action.tool}`);
        await executeTool(data.action.tool, data.action);
      } catch (actErr) {
        console.warn('Could not execute server action:', actErr);
      }
    }

    return data.reply || "I didn't receive an answer from the server.";
  } catch (err) {
    if (signal && signal.aborted) throw new Error('Aborted');
    console.error('Remote server request error:', err);
    logDebug('REMOTE', `Remote request failed: ${err.message}`, 'error');
    throw new Error(`PC Server Connection Error (${url}): ${err.message}. Ensure the server is running on your computer.`);
  }
}

/**
 * Resets conversational memory on the remote server
 */
export async function resetRemoteServerMemory() {
  const url = normalizeServerUrl(AppState.remoteServerUrl);
  try {
    const res = await fetch(`${url}/api/reset`, { 
      method: 'POST',
      headers: { 
        'X-Client-Version': clientVersion,
        'bypass-tunnel-reminder': 'true'
      }
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetches available WASM models catalog from the PC server
 */
export async function fetchRemoteModels() {
  const url = normalizeServerUrl(AppState.remoteServerUrl);
  try {
    const res = await fetch(`${url}/api/models`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Client-Version': clientVersion,
        'bypass-tunnel-reminder': 'true'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.models) {
        cachedRemoteModels = data.models;
      }
      if (data.active) {
        cachedActiveRemoteModels = data.active;
      }
      return data;
    }
  } catch (err) {
    console.warn('Could not fetch remote models:', err);
  }
  return null;
}

/**
 * Updates the active models on the standalone PC server
 */
export async function selectRemoteModel({ stt, llm, tts }) {
  const url = normalizeServerUrl(AppState.remoteServerUrl);
  try {
    const res = await fetch(`${url}/api/models/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Version': clientVersion,
        'bypass-tunnel-reminder': 'true'
      },
      body: JSON.stringify({ stt, llm, tts })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.active) {
        cachedActiveRemoteModels = data.active;
      }
      return data;
    }
  } catch (err) {
    console.warn('Could not select remote model:', err);
  }
  return null;
}

/**
 * Optional: Transcribe audio on the standalone PC server via WASM Whisper
 */
export async function callRemoteStt(audioFloat32Array, model) {
  const url = normalizeServerUrl(AppState.remoteServerUrl);
  try {
    const res = await fetch(`${url}/api/stt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Version': clientVersion,
        'bypass-tunnel-reminder': 'true'
      },
      body: JSON.stringify({
        audio: Array.from(audioFloat32Array),
        model: model || AppState.remoteSttModel || 'whisper-tiny'
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.text;
    }
  } catch (err) {
    console.warn('Remote STT request failed:', err);
  }
  return null;
}

/**
 * Optional: Synthesize speech on the standalone PC server via WASM Piper
 */
export async function callRemoteTts(text, voiceId) {
  const url = normalizeServerUrl(AppState.remoteServerUrl);
  try {
    const res = await fetch(`${url}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Version': clientVersion,
        'bypass-tunnel-reminder': 'true'
      },
      body: JSON.stringify({
        text,
        voiceId: voiceId || AppState.remoteTtsModel || 'en_US-amy-low'
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Remote TTS request failed:', err);
  }
  return null;
}
