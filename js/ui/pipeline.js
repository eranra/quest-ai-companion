// 4-Phase Conversational Pipeline Stepper & Real-Time Audio Level Indicator
// States: 'idle' | 'listening' | 'analyzing' | 'ready' | 'speaking' | 'mic-denied'

let pipelineElement = null;
let statusTextElement = null;
let statusPillElement = null;
let micMeterElement = null;
let meterBars = [];

export function initPipelineUI() {
  pipelineElement = document.getElementById('pipeline-stepper');
  statusTextElement = document.getElementById('status-text');
  statusPillElement = document.getElementById('status-pill');
  micMeterElement = document.getElementById('mic-level-meter');

  if (micMeterElement) {
    meterBars = Array.from(micMeterElement.querySelectorAll('.meter-bar'));
  }
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
      statusTextElement.textContent = detailText || (window.innerWidth <= 540 ? 'Listening...' : 'Listening to you...');
      statusPillElement.className = 'avatar-state listening';
      setStepActive('step-listening');
      if (micMeterElement) micMeterElement.style.display = 'flex';
      break;
    }
    case 'analyzing': {
      statusTextElement.textContent = detailText || (window.innerWidth <= 540 ? 'Thinking...' : '⚡ Sent to AI... Analyzing...');
      statusPillElement.className = 'avatar-state thinking';
      setStepActive('step-analyzing');
      if (micMeterElement) micMeterElement.style.display = 'none';
      break;
    }
    case 'ready': {
      statusTextElement.textContent = detailText || '💬 Answer Ready';
      statusPillElement.className = 'avatar-state ready';
      setStepActive('step-ready');
      break;
    }
    case 'speaking': {
      statusTextElement.textContent = detailText || (window.innerWidth <= 540 ? 'Speaking...' : '🗣️ Speaking Reply...');
      statusPillElement.className = 'avatar-state speaking';
      setStepActive('step-speaking');
      if (micMeterElement) micMeterElement.style.display = 'none';
      break;
    }
    case 'mic-denied': {
      statusTextElement.textContent = '⚠️ Mic permission required';
      statusPillElement.className = 'avatar-state';
      if (micMeterElement) micMeterElement.style.display = 'none';
      break;
    }
    case 'idle':
    default: {
      statusTextElement.textContent = detailText || 'Ready';
      statusPillElement.className = 'avatar-state';
      if (micMeterElement) micMeterElement.style.display = 'none';
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
