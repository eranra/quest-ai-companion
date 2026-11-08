// Live Diagnostic Logger & Pipeline Stage Debugger
// Tracks end-to-end latencies, active execution stages, and system diagnostics for Meta Quest 3

const MAX_LOGS = 200;
const logs = [];

export const LatencyMetrics = {
  lastAudioDurationSec: 0,
  sttMs: null,
  llmMs: null,
  ttsMs: null,
  turnStartMs: null,
  totalTurnMs: null
};

export const ActiveStage = {
  name: 'idle',
  label: 'Idle / Ready',
  startedAt: Date.now()
};

let drawerElement = null;
let logContainerElement = null;
let metricsContainerElement = null;
let stageBadgeElement = null;
let isDrawerOpen = false;

function formatTimestamp(d = new Date()) {
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const ms = pad(d.getMilliseconds(), 3);
  return `${hh}:${mm}:${ss}.${ms}`;
}

/**
 * Appends a log event and updates live drawer if open
 */
export function logDebug(category, message, level = 'info') {
  const entry = {
    timestamp: formatTimestamp(),
    category: category.toUpperCase(),
    message: String(message),
    level
  };

  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  // Also print to browser console
  const consolePrefix = `[${entry.timestamp}] [${entry.category}]`;
  if (level === 'error') {
    console.error(consolePrefix, entry.message);
  } else if (level === 'warn') {
    console.warn(consolePrefix, entry.message);
  } else {
    console.log(consolePrefix, entry.message);
  }

  if (isDrawerOpen && logContainerElement) {
    appendLogToDOM(entry);
  }
}

/**
 * Sets current active stage with timestamp so hangs can be identified
 */
export function setActiveStage(name, label) {
  ActiveStage.name = name;
  ActiveStage.label = label || name;
  ActiveStage.startedAt = Date.now();
  logDebug('STAGE', `Transition to -> ${ActiveStage.label}`);
  updateStageUI();
}

/**
 * Sets timing for a pipeline stage and updates latency badges
 */
export function setStageTiming(stage, ms) {
  if (stage === 'stt') LatencyMetrics.sttMs = ms;
  if (stage === 'llm') LatencyMetrics.llmMs = ms;
  if (stage === 'tts') LatencyMetrics.ttsMs = ms;
  if (stage === 'audio_duration') LatencyMetrics.lastAudioDurationSec = ms;
  if (stage === 'turn_start') {
    LatencyMetrics.turnStartMs = performance.now();
    LatencyMetrics.totalTurnMs = null;
  }
  if (stage === 'turn_end' && LatencyMetrics.turnStartMs) {
    LatencyMetrics.totalTurnMs = Math.round(performance.now() - LatencyMetrics.turnStartMs);
  }

  updateMetricsUI();
}

export function getDebugLogs() {
  return [...logs];
}

export function clearDebugLogs() {
  logs.length = 0;
  if (logContainerElement) {
    logContainerElement.innerHTML = '<div class="debug-empty">Log cleared. Ready for new events.</div>';
  }
}

/**
 * Generates markdown-formatted diagnostic report for easy copying and pasting into chat
 */
export function generateDebugReport() {
  const isQuest = /OculusBrowser|Quest/i.test(navigator.userAgent);
  const now = new Date().toISOString();
  const stageElapsed = Math.round((Date.now() - ActiveStage.startedAt) / 1000);

  const report = [
    `=== Quest AI Companion Diagnostic Trace ===`,
    `Generated: ${now}`,
    `User Agent: ${navigator.userAgent}`,
    `Device: ${isQuest ? 'Meta Quest (OculusBrowser/HorizonOS)' : 'Desktop/Mobile Browser'}`,
    `WebGPU in navigator: ${'gpu' in navigator ? 'Yes (Detected)' : 'No'}`,
    `Web Speech API: ${'SpeechRecognition' in window || 'webkitSpeechRecognition' in window ? 'Supported' : 'Unavailable (Quest Normal)'}`,
    `Active Stage: ${ActiveStage.label} (Running for ${stageElapsed}s)`,
    ``,
    `--- Latency Metrics ---`,
    `Recorded Audio: ${LatencyMetrics.lastAudioDurationSec ? LatencyMetrics.lastAudioDurationSec.toFixed(2) + 's' : 'N/A'}`,
    `STT (Whisper): ${LatencyMetrics.sttMs !== null ? LatencyMetrics.sttMs + 'ms' : 'N/A'}`,
    `AI / LLM: ${LatencyMetrics.llmMs !== null ? LatencyMetrics.llmMs + 'ms' : 'N/A'}`,
    `TTS (Voice): ${LatencyMetrics.ttsMs !== null ? LatencyMetrics.ttsMs + 'ms' : 'N/A'}`,
    `Total Roundtrip: ${LatencyMetrics.totalTurnMs !== null ? LatencyMetrics.totalTurnMs + 'ms' : 'N/A'}`,
    ``,
    `--- Live Log Events (${logs.length} entries) ---`
  ];

  for (const l of logs) {
    report.push(`[${l.timestamp}] [${l.category}] ${l.message}`);
  }

  return report.join('\n');
}

/**
 * Copies the diagnostic report to clipboard
 */
export async function copyDebugLogsToClipboard() {
  const report = generateDebugReport();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(report);
      return true;
    } catch (e) {
      console.warn('Clipboard writeText failed, trying fallback:', e);
    }
  }

  // Fallback for VR browsers where clipboard permissions might vary
  const ta = document.createElement('textarea');
  ta.value = report;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (err) {
    document.body.removeChild(ta);
    return false;
  }
}

function appendLogToDOM(entry) {
  if (!logContainerElement) return;

  const emptyPlaceholder = logContainerElement.querySelector('.debug-empty');
  if (emptyPlaceholder) emptyPlaceholder.remove();

  const row = document.createElement('div');
  row.className = `debug-row debug-${entry.level} cat-${entry.category.toLowerCase()}`;
  row.innerHTML = `<span class="dbg-time">${entry.timestamp}</span> <span class="dbg-cat">[${entry.category}]</span> <span class="dbg-msg">${escapeHTML(entry.message)}</span>`;
  logContainerElement.appendChild(row);

  // Auto-scroll to bottom
  logContainerElement.scrollTop = logContainerElement.scrollHeight;
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateMetricsUI() {
  if (!metricsContainerElement) return;

  const stt = LatencyMetrics.sttMs !== null ? `${LatencyMetrics.sttMs}ms` : '--';
  const llm = LatencyMetrics.llmMs !== null ? `${LatencyMetrics.llmMs}ms` : '--';
  const tts = LatencyMetrics.ttsMs !== null ? `${LatencyMetrics.ttsMs}ms` : '--';
  const total = LatencyMetrics.totalTurnMs !== null ? `${LatencyMetrics.totalTurnMs}ms` : '--';
  const audio = LatencyMetrics.lastAudioDurationSec ? `${LatencyMetrics.lastAudioDurationSec.toFixed(1)}s` : '--';

  metricsContainerElement.innerHTML = `
    <div class="metric-chip"><span class="chip-label">🎙️ STT:</span> <span class="chip-val">${stt}</span></div>
    <div class="metric-chip"><span class="chip-label">⚡ AI:</span> <span class="chip-val">${llm}</span></div>
    <div class="metric-chip"><span class="chip-label">🗣️ TTS:</span> <span class="chip-val">${tts}</span></div>
    <div class="metric-chip"><span class="chip-label">⏱️ Total:</span> <span class="chip-val">${total}</span></div>
    <div class="metric-chip"><span class="chip-label">🎤 Audio:</span> <span class="chip-val">${audio}</span></div>
  `;
}

function updateStageUI() {
  if (!stageBadgeElement) return;
  const isHung = (Date.now() - ActiveStage.startedAt) > 15000 && ActiveStage.name !== 'idle' && ActiveStage.name !== 'listening';
  stageBadgeElement.innerHTML = `
    <span class="stage-dot ${isHung ? 'hung' : ''}"></span>
    <span class="stage-name">${ActiveStage.label}</span>
    ${isHung ? '<span class="hung-warning">⚠️ High latency (&gt;15s)</span>' : ''}
  `;
}

/**
 * Initializes Debug Drawer modal and DOM bindings
 */
export function initDebugDrawer() {
  drawerElement = document.getElementById('modal-debug');
  logContainerElement = document.getElementById('debug-log-entries');
  metricsContainerElement = document.getElementById('debug-metrics-grid');
  stageBadgeElement = document.getElementById('debug-active-stage-pill');

  const btnDebug = document.getElementById('btn-debug');
  const btnClose = document.getElementById('btn-close-debug');
  const btnCopy = document.getElementById('btn-copy-debug');
  const btnClear = document.getElementById('btn-clear-debug');

  if (btnDebug) {
    btnDebug.addEventListener('click', () => {
      openDebugDrawer();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      closeDebugDrawer();
    });
  }

  if (drawerElement) {
    drawerElement.addEventListener('click', (e) => {
      if (e.target === drawerElement) closeDebugDrawer();
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      clearDebugLogs();
    });
  }

  if (btnCopy) {
    btnCopy.addEventListener('click', async () => {
      const ok = await copyDebugLogsToClipboard();
      const origText = btnCopy.textContent;
      if (ok) {
        btnCopy.textContent = 'Copied to Clipboard! ✓';
        btnCopy.style.background = '#10b981';
      } else {
        btnCopy.textContent = 'Copy Failed';
        btnCopy.style.background = '#ef4444';
      }
      setTimeout(() => {
        btnCopy.textContent = origText;
        btnCopy.style.background = '';
      }, 2000);
    });
  }

  logDebug('SYSTEM', 'Debug Logger initialized (v0.4.3)');
}

export function openDebugDrawer() {
  if (!drawerElement) return;
  isDrawerOpen = true;
  drawerElement.classList.add('open');

  // Populate metrics and logs
  updateMetricsUI();
  updateStageUI();

  if (logContainerElement) {
    logContainerElement.innerHTML = '';
    if (logs.length === 0) {
      logContainerElement.innerHTML = '<div class="debug-empty">No events logged yet. Speak or type to observe pipeline stages.</div>';
    } else {
      for (const entry of logs) {
        appendLogToDOM(entry);
      }
    }
  }
}

export function closeDebugDrawer() {
  if (!drawerElement) return;
  isDrawerOpen = false;
  drawerElement.classList.remove('open');
}
