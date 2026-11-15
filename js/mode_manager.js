/**
 * Quest AI Companion - Mode Manager Module
 * Encapsulates Live Mode, Push-to-Talk / Mic Toggling, and Focus Mode (Pure Immersive View).
 * Manages state snapshots, audio/visual transitions, and exact pre-focus restoration.
 */

import { AppState } from './state.js';
import { setPipelineState, updateMicLevel } from './ui/pipeline.js';
import {
  setLiveMode,
  startListening,
  stopListening
} from './audio/speech.js';
import { stopSpeaking } from './audio/tts.js';
import { initMicAnalyser, stopMicAnalyser } from './audio/vad.js';
import { isMusicMuted, setMusicMuted } from './audio/ambient_music.js';
import { updateVRHUDState } from './scene/vr_hud.js';

const getBtnMic = () => (typeof document !== 'undefined' ? document.getElementById('btn-mic') : null);
const getSpeechText = () => (typeof document !== 'undefined' ? document.getElementById('speech-text') : null);

let _context = {
  getAvatarGroup: () => null,
  getDockController: () => null,
  applyAvatarTransform: () => {},
  setAvatarShadowVisibility: () => {},
  setSpaceVisibility: () => {},
  ensureSTTReady: async () => {},
  ensureTTSReady: async () => {},
  isNeuralTTSReady: () => true
};

let lastToggleLiveTime = 0;
let focusSnapshot = null;

/**
 * Configure dynamic scene/UI dependencies needed for mode transitions
 */
export function setModeManagerContext(ctx = {}) {
  _context = { ..._context, ...ctx };
}

/**
 * Returns current focus snapshot (or null if not in focus mode)
 */
export function getFocusSnapshot() {
  return focusSnapshot;
}

/**
 * Toggle or force Live Mode (hands-free continuous listening)
 */
export async function handleToggleLiveMode(forceState = null) {
  const now = Date.now();
  if (forceState === null && now - lastToggleLiveTime < 350) return;
  lastToggleLiveTime = now;

  const nextMode = forceState !== null ? forceState : !AppState.isLiveMode;
  setLiveMode(nextMode);

  const dock = _context.getDockController();
  if (dock) dock.updateLiveModeUI();
  updateVRHUDState({ status: nextMode ? 'Live Mode: Listening...' : 'Ready' });

  const btnMic = getBtnMic();
  const speechText = getSpeechText();

  if (nextMode) {
    setPipelineState('listening', 'Live Mode: Listening...');
    if (btnMic) btnMic.classList.add('listening');
    if (dock) dock.updateMicUI(true);
    try {
      if (AppState.engine !== 'remote' || AppState.remoteServerStatus !== 'online') {
        await _context.ensureSTTReady();
        if (AppState.ttsEngine === 'neural' && !_context.isNeuralTTSReady()) {
          _context.ensureTTSReady();
        }
      }
    } catch (err) {
      if (speechText) speechText.textContent = `Voice load error: ${err.message}`;
    }
    initMicAnalyser((level) => {
      updateMicLevel(level);
      updateVRHUDState({ volume: level });
    });
    startListening();
    if (speechText) {
      speechText.textContent = '⚡ Live Mode active: Listening hands-free. Speak anytime, or tap to stop me while speaking.';
      updateVRHUDState({ text: speechText.textContent });
    }
  } else {
    stopListening();
    stopMicAnalyser();
    setPipelineState('idle');
    if (btnMic) btnMic.classList.remove('listening');
    if (dock) dock.updateMicUI(false);
    updateVRHUDState({ text: '⚡ Live Mode turned OFF. Press A/X to talk or B/Y to exit VR.' });
  }

  return nextMode;
}

/**
 * Focus Void Mode / Pure Immersive View:
 * State Snapshot, Avatar hiding, Music muting, and exact restoration on exit.
 */
export async function toggleFocusMode(forceState = null) {
  const nextFocus = forceState !== null ? !!forceState : !AppState.isFocusMode;
  if (AppState.isFocusMode === nextFocus) return nextFocus;

  AppState.isFocusMode = nextFocus;

  const btnFocus = typeof document !== 'undefined' ? document.getElementById('btn-focus-mode') : null;
  const btnFocusModal = typeof document !== 'undefined' ? document.getElementById('btn-focus-toggle-modal') : null;
  const focusLabelModal = typeof document !== 'undefined' ? document.getElementById('focus-toggle-label') : null;
  const hudOverlay = typeof document !== 'undefined' ? document.getElementById('hud-overlay') : null;
  const avatarGroup = _context.getAvatarGroup();

  if (nextFocus) {
    // 1. Snapshot complete state prior to entering Pure Immersive View
    focusSnapshot = {
      wasLiveMode: !!AppState.isLiveMode,
      wasMusicMuted: isMusicMuted(),
      spaceId: AppState.spaceId || 'hall'
    };

    // 2. Hide avatar completely
    if (avatarGroup) {
      avatarGroup.visible = false;
    }

    // 3. Hide avatar floor contact shadow, but KEEP 3D space environment visible (pure immersive view)
    _context.setAvatarShadowVisibility(false);
    _context.setSpaceVisibility(true);

    // 4. Mute background music for quiet companion interaction
    setMusicMuted(true);

    // 5. Automatically enable Live Mode if not already enabled
    if (!AppState.isLiveMode) {
      await handleToggleLiveMode(true);
    }

    // 6. Update UI elements
    if (hudOverlay) hudOverlay.classList.add('focus-mode-active');
    if (btnFocus) btnFocus.classList.add('active');
    if (btnFocusModal) btnFocusModal.style.background = '#059669';
    if (focusLabelModal) focusLabelModal.textContent = 'ON';

    updateVRHUDState({
      status: '🧘 Immersive View',
      text: 'Pure Immersive View: Avatar hidden. 360° space environment active with hands-free Live Mode.'
    });
  } else {
    // Restore pre-focus state exactly
    const snapshot = focusSnapshot || {
      wasLiveMode: false,
      wasMusicMuted: false,
      spaceId: AppState.spaceId || 'hall'
    };

    // 1. Show avatar
    if (avatarGroup) {
      avatarGroup.visible = true;
      _context.applyAvatarTransform();
    }

    // 2. Restore avatar floor shadow & ensure space visibility
    _context.setAvatarShadowVisibility(true);
    _context.setSpaceVisibility(true);

    // 3. Restore ambient music mute state
    setMusicMuted(snapshot.wasMusicMuted);

    // 4. Restore Live Mode state
    await handleToggleLiveMode(snapshot.wasLiveMode);

    // 5. Update UI elements
    if (hudOverlay) hudOverlay.classList.remove('focus-mode-active');
    if (btnFocus) btnFocus.classList.remove('active');
    if (btnFocusModal) btnFocusModal.style.background = '#4f46e5';
    if (focusLabelModal) focusLabelModal.textContent = 'OFF';

    focusSnapshot = null;

    updateVRHUDState({
      status: 'Ready',
      text: 'Immersive View exited: Avatar & audio restored.'
    });
  }

  return nextFocus;
}

/**
 * Handle push-to-talk mic button toggle or speech interruption
 */
export async function handleToggleMic() {
  const dock = _context.getDockController();
  const btnMic = getBtnMic();
  const speechText = getSpeechText();

  if (AppState.isSpeaking) {
    stopSpeaking();
    if (AppState.isLiveMode) {
      setPipelineState('listening', 'Interrupted. Listening...');
      updateVRHUDState({ status: 'Interrupted. Listening...' });
      if (btnMic) btnMic.classList.add('listening');
      if (dock) dock.updateMicUI(true);
      return;
    } else {
      setPipelineState('idle');
      updateVRHUDState({ status: 'Ready' });
      if (btnMic) btnMic.classList.remove('listening');
      if (dock) dock.updateMicUI(false);
      return;
    }
  }

  if (AppState.isListening) {
    stopListening(true);
    stopMicAnalyser();
    setPipelineState('idle');
    updateVRHUDState({ status: 'Ready' });
    if (btnMic) btnMic.classList.remove('listening');
    if (dock) dock.updateMicUI(false);
  } else {
    setPipelineState('listening', 'Listening to you...');
    updateVRHUDState({ status: 'Listening to you...' });
    if (btnMic) btnMic.classList.add('listening');
    if (dock) dock.updateMicUI(true);
    try {
      if (AppState.engine !== 'remote' || AppState.remoteServerStatus !== 'online') {
        await _context.ensureSTTReady();
        if (AppState.ttsEngine === 'neural' && !_context.isNeuralTTSReady()) {
          _context.ensureTTSReady();
        }
      }
    } catch (err) {
      if (speechText) speechText.textContent = `Voice model load error: ${err.message}`;
      setPipelineState('idle');
      if (btnMic) btnMic.classList.remove('listening');
      if (dock) dock.updateMicUI(false);
      return;
    }
    initMicAnalyser((level) => {
      updateMicLevel(level);
      updateVRHUDState({ volume: level });
    });
    startListening();
  }
}

// Register global window.toggleFocusMode for VR HUD and global access
if (typeof window !== 'undefined') {
  window.toggleFocusMode = toggleFocusMode;
}
