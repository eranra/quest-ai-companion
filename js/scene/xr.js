// WebXR and Meta Quest Controller Input Module
// Supports Full 360° VR Immersion (immersive-vr) and Mixed Reality Passthrough (immersive-ar)
import * as THREE from 'three';
import { AppState } from '../state.js';
import { unlockAudio } from '../audio.js';
import { setSpaceVisibility } from '../spaces/index.js';

let xrSession = null;
let xrControllers = [];

export function setupXRControllers(scene, renderer) {
  xrControllers = [];
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    controller.addEventListener('selectstart', () => unlockAudio());
    scene.add(controller);
    xrControllers.push(controller);
  }
  return xrControllers;
}

// Meta Quest 3 Touch Controller Thumbstick Inputs:
// Right Stick Y: Move avatar distance closer/further
// Left Stick Y: Scale avatar size up/down
export function handleXRControllerInput(renderer, delta, applyAvatarTransformCallback, hudElement) {
  const session = renderer.xr.getSession();
  if (!session) return;

  let changed = false;

  for (const source of session.inputSources) {
    if (!source.gamepad || !source.gamepad.axes) continue;

    const axes = source.gamepad.axes;
    // axes[2] is Thumbstick X, axes[3] is Thumbstick Y on Quest Touch Plus controllers
    const stickY = axes.length >= 4 ? axes[3] : axes[1];

    if (Math.abs(stickY) > 0.15) {
      if (source.handedness === 'right') {
        // Right stick Y controls distance (back and forth)
        AppState.avatarDistance += stickY * delta * 1.5;
        AppState.avatarDistance = Math.max(-1.0, Math.min(3.5, AppState.avatarDistance));
        changed = true;
      } else if (source.handedness === 'left') {
        // Left stick Y controls size (scale up and down)
        AppState.avatarScale -= stickY * delta * 0.8;
        AppState.avatarScale = Math.max(0.3, Math.min(2.5, AppState.avatarScale));
        changed = true;
      }
    }
  }

  if (changed) {
    if (applyAvatarTransformCallback) applyAvatarTransformCallback();
    AppState.save();
    if (hudElement) {
      hudElement.classList.add('visible');
      if (hudElement._hideTimeout) clearTimeout(hudElement._hideTimeout);
      hudElement._hideTimeout = setTimeout(() => hudElement.classList.remove('visible'), 2000);
    }
  }
}

/**
 * Enters Full 360° VR Immersion (Quest 3 Headset + 360 Photorealistic Environment)
 */
export async function enterVR(renderer, scene, onSessionChange) {
  if (!navigator.xr) {
    throw new Error('WebXR is not supported on this device or browser. On Meta Quest 3, make sure you are using Meta Horizon Browser.');
  }

  const isVRSupported = await navigator.xr.isSessionSupported('immersive-vr');
  if (!isVRSupported) {
    throw new Error('Immersive 360° VR is not supported on this browser.');
  }

  if (xrSession) {
    await xrSession.end();
    xrSession = null;
  }

  try {
    // Crucial for Meta Quest: DO NOT request dom-overlay in immersive-vr!
    // Quest Browser rejects dom-overlay in immersive-vr with "Feature not supported".
    const sessionInit = {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
    };

    const session = await navigator.xr.requestSession('immersive-vr', sessionInit);
    await renderer.xr.setSession(session);
    xrSession = session;

    // In 360° VR: keep the photorealistic 3D environment dome completely visible
    setSpaceVisibility(true);

    session.addEventListener('end', () => {
      xrSession = null;
      setSpaceVisibility(true);
      if (onSessionChange) onSessionChange(false, 'vr');
    });

    if (onSessionChange) onSessionChange(true, 'vr');
    return session;
  } catch (err) {
    console.error('Failed to start 360° VR session:', err);
    throw err;
  }
}

/**
 * Enters Mixed Reality Passthrough (See your real room with the avatar)
 */
export async function enterAR(renderer, scene, onSessionChange) {
  if (!navigator.xr) {
    throw new Error('WebXR is not supported on this device or browser.');
  }

  const isARSupported = await navigator.xr.isSessionSupported('immersive-ar');
  if (!isARSupported) {
    throw new Error('Passthrough AR is not supported on this browser.');
  }

  if (xrSession) {
    await xrSession.end();
    xrSession = null;
  }

  try {
    let session;
    try {
      session = await navigator.xr.requestSession('immersive-ar', {
        optionalFeatures: ['local-floor', 'hit-test', 'hand-tracking']
      });
    } catch (e1) {
      session = await navigator.xr.requestSession('immersive-ar', {
        optionalFeatures: ['local-floor']
      });
    }

    await renderer.xr.setSession(session);
    xrSession = session;

    // In AR Passthrough: hide virtual dome so user sees their actual physical room
    scene.background = null;
    setSpaceVisibility(false);

    session.addEventListener('end', () => {
      xrSession = null;
      scene.background = new THREE.Color(0x05070f);
      setSpaceVisibility(true);
      if (onSessionChange) onSessionChange(false, 'ar');
    });

    if (onSessionChange) onSessionChange(true, 'ar');
    return session;
  } catch (err) {
    console.error('Failed to start Passthrough AR session:', err);
    throw err;
  }
}

/**
 * Toggles WebXR session (defaults to 360° VR immersion)
 */
export async function toggleWebXR(renderer, scene, onSessionChange, mode = 'vr') {
  if (xrSession) {
    await xrSession.end();
    xrSession = null;
    return false;
  }

  if (mode === 'ar') {
    await enterAR(renderer, scene, onSessionChange);
    return true;
  } else {
    await enterVR(renderer, scene, onSessionChange);
    return true;
  }
}

/**
 * Toggles HTML5 Fullscreen for 2D browser window expansion
 */
export function toggleFullscreen() {
  if (!document.fullscreenElement) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
      return true;
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
      return false;
    }
  }
  return false;
}

export function isXRSessionActive() {
  return !!xrSession;
}
