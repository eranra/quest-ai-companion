// WebXR and Meta Quest Controller Input Module
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

export async function toggleWebXR(renderer, scene, onSessionChange) {
  if (!navigator.xr) {
    throw new Error('WebXR is not supported on this device or browser.');
  }

  if (!xrSession) {
    try {
      const isArSupported = await navigator.xr.isSessionSupported('immersive-ar');
      const sessionType = isArSupported ? 'immersive-ar' : 'immersive-vr';
      const sessionInit = isArSupported ? {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['dom-overlay', 'hit-test', 'hand-tracking'],
        domOverlay: { root: document.body }
      } : {
        requiredFeatures: ['local-floor']
      };

      const session = await navigator.xr.requestSession(sessionType, sessionInit);
      await renderer.xr.setSession(session);
      xrSession = session;

      if (isArSupported) {
        scene.background = null;
        setSpaceVisibility(false);
      }

      session.addEventListener('end', () => {
        xrSession = null;
        scene.background = new THREE.Color(0x05070f);
        setSpaceVisibility(true);
        if (onSessionChange) onSessionChange(false);
      });

      if (onSessionChange) onSessionChange(true);
    } catch (err) {
      console.error('Failed to start WebXR session:', err);
      throw err;
    }
  } else {
    await xrSession.end();
  }
}
