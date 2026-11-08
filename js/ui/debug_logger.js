// Live Diagnostic Logger & Pipeline Stage Profiler for Meta Quest 3 & VR Browsers
// Non-modal floating HUD window with deep CPU, memory, RTF, and stage profiling

const MAX_LOGS = 250;
const logs = [];

let currentDebugLevel = localStorage.getItem('quest_debug_level') || 'standard'; // 'standard' | 'verbose'

export const LatencyMetrics = {
  lastAudioDurationSec: 0,
  lastRTF: null,
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

let floatingWindow = null;
let logContainerElement = null;
let metricsContainerElement = null;
let stageBadgeElement = null;
let stageTimerElement = null;
let systemBannerElement = null;
let stageTickerInterval = null;
let isWindowOpen = false;
let isMinimized = false;

function formatTimestamp(d = new Date()) {
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const ms = pad(d.getMilliseconds(), 3);
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function getSystemProfile() {
  const isQuest = /OculusBrowser|Quest/i.test(navigator.userAgent);
  let memoryMB = null;
  if (window.performance && performance.memory) {
    memoryMB = {
      used: Math.round(performance.memory.usedJSHeapSize / 1048576),
      total: Math.round(performance.memory.totalJSHeapSize / 1048576),
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
    };
  }

  return {
    isQuest,
    cores: navigator.hardwareConcurrency || 1,
    crossOriginIsolated: !!window.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    deviceMemoryGB: navigator.deviceMemory || null,
    hasWebGPU: 'gpu' in navigator,
    hasSpeechRec: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
    hasSpeechSynth: 'speechSynthesis' in window,
    memoryMB
  };
}

/**
 * Sets verbosity level: 'standard' or 'verbose'
 */
export function setDebugLevel(level) {
  currentDebugLevel = level === 'verbose' ? 'verbose' : 'standard';
  try {
    localStorage.setItem('quest_debug_level', currentDebugLevel);
  } catch (e) {}
  logDebug('SYSTEM', `Diagnostic verbosity set to: ${currentDebugLevel.toUpperCase()}`);
}

export function getDebugLevel() {
  return currentDebugLevel;
}

export function isVerbose() {
  return currentDebugLevel === 'verbose';
}

/**
 * Appends a log event and updates live floating window if open
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

  // Console output
  const consolePrefix = `[${entry.timestamp}] [${entry.category}]`;
  if (level === 'error') {
    console.error(consolePrefix, entry.message);
  } else if (level === 'warn') {
    console.warn(consolePrefix, entry.message);
  } else {
    console.log(consolePrefix, entry.message);
  }

  if (isWindowOpen && logContainerElement) {
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
  logDebug('STAGE', `Transition -> ${ActiveStage.label}`);
  updateStageUI();
}

/**
 * Sets timing for a pipeline stage and updates latency badges & RTF
 */
export function setStageTiming(stage, ms) {
  if (stage === 'stt') LatencyMetrics.sttMs = ms;
  if (stage === 'llm') LatencyMetrics.llmMs = ms;
  if (stage === 'tts') LatencyMetrics.ttsMs = ms;
  if (stage === 'audio_duration') LatencyMetrics.lastAudioDurationSec = ms;
  if (stage === 'rtf') LatencyMetrics.lastRTF = ms;
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
    logContainerElement.innerHTML = '<div class="debug-empty">Log cleared. Ready for new profiling events.</div>';
  }
}

/**
 * Generates markdown-formatted diagnostic report for easy copying and pasting into chat
 */
export function generateDebugReport() {
  const sys = getSystemProfile();
  const now = new Date().toISOString();
  const stageElapsed = Math.round((Date.now() - ActiveStage.startedAt) / 1000);

  const report = [
    `=== Quest AI Companion Diagnostic & Performance Trace ===`,
    `Generated: ${now}`,
    `Verbosity: ${currentDebugLevel.toUpperCase()}`,
    `User Agent: ${navigator.userAgent}`,
    `Device: ${sys.isQuest ? 'Meta Quest (OculusBrowser / HorizonOS)' : 'Desktop/Mobile Browser'}`,
    `Logical CPU Cores: ${sys.cores}`,
    `Memory (JS Heap): ${sys.memoryMB ? `${sys.memoryMB.used}MB used / ${sys.memoryMB.total}MB total (Limit: ${sys.memoryMB.limit}MB)` : 'Not exposed by browser'}`,
    `WASM Multi-threading (SharedArrayBuffer): ${sys.crossOriginIsolated ? 'ENABLED (Multi-core WASM)' : 'DISABLED (Single-threaded WASM fallback - Standard on Web)'}`,
    `WebGPU in navigator: ${sys.hasWebGPU ? 'Present' : 'Not detected'}`,
    `Web Speech API: ${sys.hasSpeechRec ? 'Supported' : 'Unavailable (Quest Normal)'}`,
    `Speech Synthesis: ${sys.hasSpeechSynth ? 'Supported' : 'Unavailable'}`,
    `Active Stage: ${ActiveStage.label} (Running for ${stageElapsed}s)`,
    ``,
    `--- Latency Metrics & Profiling ---`,
    `Audio Captured: ${LatencyMetrics.lastAudioDurationSec ? LatencyMetrics.lastAudioDurationSec.toFixed(2) + 's' : 'N/A'}`,
    `STT (Whisper): ${LatencyMetrics.sttMs !== null ? LatencyMetrics.sttMs + 'ms' : 'N/A'}`,
    `AI / LLM: ${LatencyMetrics.llmMs !== null ? LatencyMetrics.llmMs + 'ms' : 'N/A'}`,
    `TTS (Voice): ${LatencyMetrics.ttsMs !== null ? LatencyMetrics.ttsMs + 'ms' : 'N/A'}`,
    `TTS Real-Time Factor (RTF): ${LatencyMetrics.lastRTF !== null ? LatencyMetrics.lastRTF.toFixed(2) + 'x' : 'N/A'}`,
    `Total Roundtrip: ${LatencyMetrics.totalTurnMs !== null ? LatencyMetrics.totalTurnMs + 'ms' : 'N/A'}`,
    ``,
    `--- Live Event Log (${logs.length} entries) ---`
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

function updateSystemBannerUI() {
  if (!systemBannerElement) return;
  const sys = getSystemProfile();
  const memStr = sys.memoryMB ? `${sys.memoryMB.used}MB / ${sys.memoryMB.total}MB` : 'N/A';
  const threadStr = sys.crossOriginIsolated ? 'Multi-thread WASM' : 'Single-thread WASM';

  systemBannerElement.innerHTML = `
    <div class="sys-chip"><span class="sys-chip-title">Device:</span> ${sys.isQuest ? '🥽 Quest 3' : '💻 Browser'}</div>
    <div class="sys-chip"><span class="sys-chip-title">CPU:</span> ${sys.cores} Cores (${threadStr})</div>
    <div class="sys-chip"><span class="sys-chip-title">Heap:</span> ${memStr}</div>
  `;
}

function updateMetricsUI() {
  if (!metricsContainerElement) return;

  const stt = LatencyMetrics.sttMs !== null ? `${LatencyMetrics.sttMs}ms` : '--';
  const llm = LatencyMetrics.llmMs !== null ? `${LatencyMetrics.llmMs}ms` : '--';
  const tts = LatencyMetrics.ttsMs !== null ? `${LatencyMetrics.ttsMs}ms` : '--';
  const rtf = LatencyMetrics.lastRTF !== null ? `${LatencyMetrics.lastRTF.toFixed(2)}x` : '--';
  const total = LatencyMetrics.totalTurnMs !== null ? `${LatencyMetrics.totalTurnMs}ms` : '--';

  metricsContainerElement.innerHTML = `
    <div class="metric-chip"><span class="chip-label">🎙️ STT:</span> <span class="chip-val">${stt}</span></div>
    <div class="metric-chip"><span class="chip-label">⚡ AI:</span> <span class="chip-val">${llm}</span></div>
    <div class="metric-chip"><span class="chip-label">🗣️ TTS:</span> <span class="chip-val">${tts}</span></div>
    <div class="metric-chip"><span class="chip-label">📊 RTF:</span> <span class="chip-val">${rtf}</span></div>
    <div class="metric-chip"><span class="chip-label">⏱️ Total:</span> <span class="chip-val">${total}</span></div>
  `;
}

function updateStageUI() {
  if (!stageBadgeElement) return;
  const elapsedSec = Math.round((Date.now() - ActiveStage.startedAt) / 1000);
  const isHung = elapsedSec > 15 && ActiveStage.name !== 'idle' && ActiveStage.name !== 'listening';

  stageBadgeElement.innerHTML = `
    <span class="stage-dot ${isHung ? 'hung' : ''}"></span>
    <span class="stage-name">${ActiveStage.label}</span>
    ${isHung ? `<span class="hung-warning">⚠️ High latency (${elapsedSec}s)</span>` : ''}
  `;

  if (stageTimerElement) {
    stageTimerElement.textContent = `${elapsedSec}s`;
    stageTimerElement.style.color = isHung ? '#f87171' : '#94a3b8';
  }
}

/**
 * Initializes Draggable functionality for the floating window header
 */
function setupDraggableWindow(windowEl, handleEl) {
  if (!windowEl || !handleEl) return;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  handleEl.addEventListener('pointerdown', (e) => {
    // Only drag on left mouse / touch and not on buttons
    if (e.target.closest('button')) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = windowEl.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    // Reset right/bottom positioning to explicit top/left
    windowEl.style.right = 'auto';
    windowEl.style.bottom = 'auto';
    windowEl.style.left = `${initialLeft}px`;
    windowEl.style.top = `${initialTop}px`;

    handleEl.setPointerCapture(e.pointerId);
  });

  handleEl.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const maxLeft = Math.max(10, window.innerWidth - windowEl.offsetWidth - 10);
    const maxTop = Math.max(10, window.innerHeight - windowEl.offsetHeight - 10);

    const nextLeft = Math.min(maxLeft, Math.max(10, initialLeft + dx));
    const nextTop = Math.min(maxTop, Math.max(10, initialTop + dy));

    windowEl.style.left = `${nextLeft}px`;
    windowEl.style.top = `${nextTop}px`;
  });

  const stopDrag = (e) => {
    if (isDragging) {
      isDragging = false;
      try { handleEl.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  };

  handleEl.addEventListener('pointerup', stopDrag);
  handleEl.addEventListener('pointercancel', stopDrag);
}

/**
 * Initializes Debug Floating Window and DOM bindings
 */
export function initDebugDrawer() {
  floatingWindow = document.getElementById('debug-floating-window');
  logContainerElement = document.getElementById('debug-log-entries');
  metricsContainerElement = document.getElementById('debug-metrics-grid');
  stageBadgeElement = document.getElementById('debug-active-stage-pill');
  stageTimerElement = document.getElementById('debug-stage-timer');
  systemBannerElement = document.getElementById('debug-system-banner');

  const dragHandle = document.getElementById('debug-drag-handle');
  const btnClose = document.getElementById('btn-close-debug');
  const btnMinimize = document.getElementById('btn-debug-minimize');
  const btnCopy = document.getElementById('btn-copy-debug');
  const btnClear = document.getElementById('btn-clear-debug');
  const btnToggleFromSettings = document.getElementById('btn-toggle-floating-debug');
  const cfgDebugLevel = document.getElementById('cfg-debug-level');

  if (dragHandle && floatingWindow) {
    setupDraggableWindow(floatingWindow, dragHandle);
  }

  if (cfgDebugLevel) {
    cfgDebugLevel.value = currentDebugLevel;
    cfgDebugLevel.addEventListener('change', () => {
      setDebugLevel(cfgDebugLevel.value);
    });
  }

  if (btnToggleFromSettings) {
    btnToggleFromSettings.addEventListener('click', () => {
      toggleFloatingDebug();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      closeFloatingDebug();
    });
  }

  if (btnMinimize) {
    btnMinimize.addEventListener('click', () => {
      isMinimized = !isMinimized;
      if (floatingWindow) {
        if (isMinimized) {
          floatingWindow.classList.add('minimized');
          btnMinimize.textContent = '+';
          btnMinimize.title = 'Expand Window';
        } else {
          floatingWindow.classList.remove('minimized');
          btnMinimize.textContent = '−';
          btnMinimize.title = 'Minimize Window';
        }
      }
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

  // Ticker for stage timer
  if (stageTickerInterval) clearInterval(stageTickerInterval);
  stageTickerInterval = setInterval(() => {
    if (isWindowOpen) {
      updateStageUI();
    }
  }, 1000);

  logDebug('SYSTEM', 'Diagnostic Profiler initialized (Floating Non-blocking HUD)');
}

export function isFloatingDebugOpen() {
  return isWindowOpen;
}

export function openFloatingDebug() {
  if (!floatingWindow) return;
  isWindowOpen = true;
  floatingWindow.style.display = 'flex';
  floatingWindow.classList.add('open');

  const btnToggleFromSettings = document.getElementById('btn-toggle-floating-debug');
  if (btnToggleFromSettings) {
    btnToggleFromSettings.innerHTML = '🪟 Close Floating Diagnostics Window';
    btnToggleFromSettings.style.background = '#374151';
  }

  // Populate system info, metrics, and logs
  updateSystemBannerUI();
  updateMetricsUI();
  updateStageUI();

  if (logContainerElement) {
    logContainerElement.innerHTML = '';
    if (logs.length === 0) {
      logContainerElement.innerHTML = '<div class="debug-empty">No events logged yet. Speak, type, or test voice to profile.</div>';
    } else {
      for (const entry of logs) {
        appendLogToDOM(entry);
      }
    }
  }
}

export function closeFloatingDebug() {
  if (!floatingWindow) return;
  isWindowOpen = false;
  floatingWindow.style.display = 'none';
  floatingWindow.classList.remove('open');

  const btnToggleFromSettings = document.getElementById('btn-toggle-floating-debug');
  if (btnToggleFromSettings) {
    btnToggleFromSettings.innerHTML = '🪟 Open Floating Diagnostics Window';
    btnToggleFromSettings.style.background = '#4f46e5';
  }
}

export function getActiveStage() {
  return ActiveStage.label || ActiveStage.name;
}

export function toggleFloatingDebug() {
  if (isWindowOpen) {
    closeFloatingDebug();
  } else {
    openFloatingDebug();
  }
}
