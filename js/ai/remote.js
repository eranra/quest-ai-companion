// Remote PC Server Client Connector for Meta Quest AI Companion
// Connects Quest 3 headset over local Wi-Fi to a standalone server running on Mac / PC / Linux
import { AppState } from '../state.js';
import { logDebug } from '../ui/debug_logger.js';
import { executeTool } from './tools.js';

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
 * Checks connectivity to the standalone PC/Mac server
 */
export async function checkRemoteServerResponsiveness(targetUrl) {
  const url = normalizeServerUrl(targetUrl || AppState.remoteServerUrl);
  logDebug('REMOTE', `Checking connectivity to server: ${url}...`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${url}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      AppState.remoteServerStatus = 'online';
      logDebug('REMOTE', `Connected to server! ${data.server} on ${data.platform} (${data.cores} cores)`);
      return {
        responsive: true,
        server: data.server,
        platform: data.platform,
        cores: data.cores,
        memoryFreeMb: data.memoryFreeMb,
        ollama: data.ollama?.active || false
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
      history: context.history || []
    };

    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
    const res = await fetch(`${url}/api/reset`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}
