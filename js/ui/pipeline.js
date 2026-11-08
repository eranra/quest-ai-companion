// 4-Phase Conversational Pipeline Stepper & Real-Time Audio Level Indicator
// States: 'idle' | 'listening' | 'analyzing' | 'ready' | 'speaking' | 'mic-denied'
// Includes collapsible toggle to minimize bubble and stepper for unobstructed 360° VR viewing

let pipelineElement = null;
let statusTextElement = null;
let statusPillElement = null;
let micMeterElement = null;
let bubbleContainer = null;
let btnToggleBubble = null;
let bubbleToggleIcon = null;
let meterBars = [];
let idleDimTimeout = null;
let isCollapsed = false;

export function initPipelineUI() {
  pipelineElement = document.getElementById('pipeline-stepper');
  statusTextElement = document.getElementById('status-text');
  statusPillElement = document.getElementById('status-pill');
  micMeterElement = document.getElementById('mic-level-meter');
  bubbleContainer = document.querySelector('.speech-bubble-container');
  btnToggleBubble = document.getElementById('btn-toggle-bubble');
  bubbleToggleIcon = document.getElementById('bubble-toggle-icon');

  if (micMeterElement) {
    meterBars = Array.from(micMeterElement.querySelectorAll('.meter-bar'));
  }

  // Restore collapsed state from localStorage
  const savedCollapsed = localStorage.getItem('quest_bubble_collapsed');
  if (savedCollapsed === 'true') {
    setBubbleCollapsed(true);
  }

  if (btnToggleBubble) {
    btnToggleBubble.addEventListener('click', (e) => {
      e.stopPropagation();
      setBubbleCollapsed(!isCollapsed);
    });
  }

  // Waking the speech bubble when user interacts with screen or input
  window.addEventListener('pointerdown', () => wakeSpeechBubble());
  window.addEventListener('keydown', () => wakeSpeechBubble());

  // Initial schedule after start
  scheduleIdleDim(6000);
}

export function isSpeechBubbleCollapsed() {
  return isCollapsed;
}

export function setBubbleCollapsed(collapsed) {
  isCollapsed = !!collapsed;
  if (bubbleContainer) {
    if (isCollapsed) {
      bubbleContainer.classList.add('collapsed');
    } else {
      bubbleContainer.classList.remove('collapsed');
    }
  }

  if (bubbleToggleIcon) {
    bubbleToggleIcon.textContent = isCollapsed ? '+' : '−';
  }
  if (btnToggleBubble) {
    btnToggleBubble.title = isCollapsed 
      ? 'Expand Subtitles & Pipeline Stepper' 
      : 'Collapse Subtitles & Stepper (Free up 360° view)';
  }

  try {
    localStorage.setItem('quest_bubble_collapsed', isCollapsed ? 'true' : 'false');
  } catch (e) {}
}

export function wakeSpeechBubble() {
  if (bubbleContainer) {
    bubbleContainer.classList.remove('idle-dim');
  }
}

export function scheduleIdleDim(delayMs = 5000) {
  if (idleDimTimeout) clearTimeout(idleDimTimeout);
  idleDimTimeout = setTimeout(() => {
    // Only dim if not actively analyzing or speaking
    if (bubbleContainer) {
      bubbleContainer.classList.add('idle-dim');
    }
  }, delayMs);
}

export function setPipelineState(state, detailText = '') {
  if (!statusTextElement || !statusPillElement) return;

  // Clear previous step highlights
  if (pipelineElement) {
    pipelineElement.querySelectorAll('.pipeline-step').forEach(step => {
      step.classList.remove('active', 'completed');
    });
  }

  switch (state) {
    case 'listening': {
      wakeSpeechBubble();
      statusTextElement.textContent = detailText || (window.innerWidth <= 540 ? 'Listening...' : 'Listening to you...');
      statusPillElement.className = 'avatar-state listening';
      setStepActive('step-listening');
      if (micMeterElement) micMeterElement.style.display = 'flex';
      // In listening mode, if idle waiting for speech, fade after 8 seconds
      scheduleIdleDim(8000);
      break;
    }
    case 'analyzing': {
      wakeSpeechBubble();
      if (idleDimTimeout) clearTimeout(idleDimTimeout);
      statusTextElement.textContent = detailText || (window.innerWidth <= 540 ? 'Thinking...' : '⚡ Sent to AI... Analyzing...');
      statusPillElement.className = 'avatar-state thinking';
      setStepActive('step-analyzing');
      if (micMeterElement) micMeterElement.style.display = 'none';
      break;
    }
    case 'ready': {
      wakeSpeechBubble();
      if (idleDimTimeout) clearTimeout(idleDimTimeout);
      statusTextElement.textContent = detailText || '💬 Answer Ready';
      statusPillElement.className = 'avatar-state ready';
      setStepActive('step-ready');
      break;
    }
    case 'speaking': {
      wakeSpeechBubble();
      if (idleDimTimeout) clearTimeout(idleDimTimeout);
      statusTextElement.textContent = detailText || (window.innerWidth <= 540 ? 'Speaking...' : '🗣️ Speaking Reply...');
      statusPillElement.className = 'avatar-state speaking';
      setStepActive('step-speaking');
      if (micMeterElement) micMeterElement.style.display = 'none';
      break;
    }
    case 'mic-denied': {
      wakeSpeechBubble();
      statusTextElement.textContent = '⚠️ Mic permission required';
      statusPillElement.className = 'avatar-state';
      if (micMeterElement) micMeterElement.style.display = 'none';
      scheduleIdleDim(5000);
      break;
    }
    case 'idle':
    default: {
      statusTextElement.textContent = detailText || 'Ready';
      statusPillElement.className = 'avatar-state';
      if (micMeterElement) micMeterElement.style.display = 'none';
      // Fade away cleanly when idle
      scheduleIdleDim(4500);
      break;
    }
  }
}

function setStepActive(stepId) {
  if (!pipelineElement) return;
  const target = document.getElementById(stepId);
  if (target) {
    target.classList.add('active');
  }
}

// Bounces real-time audio wave bars when user speaks
export function updateMicLevel(normalizedVolume) {
  if (normalizedVolume > 0.1) {
    wakeSpeechBubble();
  }
  if (!meterBars || meterBars.length === 0) return;
  // Normalized 0.0 to 1.0
  const heightMultiplier = Math.min(1.0, Math.max(0.12, normalizedVolume * 1.5));
  
  meterBars.forEach((bar, index) => {
    // Stagger heights for organic audio wave appearance
    const factor = 0.5 + 0.5 * Math.sin(index * 1.3 + Date.now() * 0.01);
    const heightPx = Math.round(4 + heightMultiplier * factor * 14);
    bar.style.height = `${heightPx}px`;
    bar.style.opacity = heightMultiplier > 0.15 ? '1' : '0.4';
  });
}
