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
 * Enters Full 360° VR Immersion (Meta Quest 3 Headset + 360 Photorealistic Environment)
 * SYNCHRONOUS: Calls navigator.xr.requestSession synchronously to preserve user activation!
 */
export function enterVR(renderer, scene, onSessionChange) {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    alert('WebXR requires HTTPS. Please open https://eranra.github.io/quest-ai-companion/ in Meta Quest Browser (HTTP over local IP disables WebXR).');
    return Promise.reject(new Error('WebXR requires HTTPS'));
  }

  if (!navigator.xr) {
    alert('WebXR is not supported on this device/browser. Please open https://eranra.github.io/quest-ai-companion/ inside the Meta Quest Browser in your headset.');
    return Promise.reject(new Error('WebXR not available'));
  }

  if (xrSession) {
    xrSession.end();
    xrSession = null;
    return Promise.resolve(null);
  }

  // Ensure 360 photorealistic dome space is visible
  setSpaceVisibility(true);

  // Standard Three.js Quest 3 session configuration
  const sessionInit = {
    optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers']
  };

  // Synchronous call inside the user gesture event: zero await delay!
  return navigator.xr.requestSession('immersive-vr', sessionInit)
    .then(async (session) => {
      xrSession = session;
      await renderer.xr.setSession(session);

      session.addEventListener('end', () => {
        xrSession = null;
        setSpaceVisibility(true);
        if (onSessionChange) onSessionChange(false, 'vr');
      });

      if (onSessionChange) onSessionChange(true, 'vr');
      return session;
    })
    .catch((err1) => {
      console.warn('immersive-vr with optional features failed, attempting minimal session:', err1);
      // Fallback: minimal session without optional feature constraints
      return navigator.xr.requestSession('immersive-vr')
        .then(async (session) => {
          xrSession = session;
          await renderer.xr.setSession(session);

          session.addEventListener('end', () => {
            xrSession = null;
            setSpaceVisibility(true);
            if (onSessionChange) onSessionChange(false, 'vr');
          });

          if (onSessionChange) onSessionChange(true, 'vr');
          return session;
        })
        .catch((err2) => {
          console.error('WebXR VR request failed:', err2);
          alert(`Could not launch 360° VR: ${err2.message}\nMake sure you are viewing this page inside the Meta Quest Browser on Meta Quest 3.`);
          throw err2;
        });
    });
}

/**
 * Enters Mixed Reality Passthrough (See your real room with the avatar)
 * SYNCHRONOUS: Calls navigator.xr.requestSession synchronously to preserve user activation!
 */
export function enterAR(renderer, scene, onSessionChange) {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    alert('WebXR requires HTTPS. Please open https://eranra.github.io/quest-ai-companion/ in Meta Quest Browser (HTTP over local IP disables WebXR).');
    return Promise.reject(new Error('WebXR requires HTTPS'));
  }

  if (!navigator.xr) {
    alert('WebXR is not supported on this browser.');
    return Promise.reject(new Error('WebXR not available'));
  }

  if (xrSession) {
    xrSession.end();
    xrSession = null;
    return Promise.resolve(null);
  }

  const sessionInit = {
    optionalFeatures: ['local-floor', 'hit-test', 'hand-tracking']
  };

  return navigator.xr.requestSession('immersive-ar', sessionInit)
    .then(async (session) => {
      xrSession = session;
      scene.background = null;
      setSpaceVisibility(false);
      await renderer.xr.setSession(session);

      session.addEventListener('end', () => {
        xrSession = null;
        scene.background = new THREE.Color(0x05070f);
        setSpaceVisibility(true);
        if (onSessionChange) onSessionChange(false, 'ar');
      });

      if (onSessionChange) onSessionChange(true, 'ar');
      return session;
    })
    .catch((err1) => {
      console.warn('immersive-ar with features failed, attempting minimal:', err1);
      return navigator.xr.requestSession('immersive-ar')
        .then(async (session) => {
          xrSession = session;
          scene.background = null;
          setSpaceVisibility(false);
          await renderer.xr.setSession(session);

          session.addEventListener('end', () => {
            xrSession = null;
            scene.background = new THREE.Color(0x05070f);
            setSpaceVisibility(true);
            if (onSessionChange) onSessionChange(false, 'ar');
          });

          if (onSessionChange) onSessionChange(true, 'ar');
          return session;
        })
        .catch((err2) => {
          console.error('WebXR AR request failed:', err2);
          alert(`Passthrough AR error: ${err2.message}`);
          throw err2;
        });
    });
}

/**
 * Toggles WebXR session (defaults to 360° VR immersion)
 */
export function toggleWebXR(renderer, scene, onSessionChange, mode = 'vr') {
  if (xrSession) {
    xrSession.end();
    xrSession = null;
    return Promise.resolve(false);
  }

  if (mode === 'ar') {
    return enterAR(renderer, scene, onSessionChange);
  } else {
    return enterVR(renderer, scene, onSessionChange);
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
