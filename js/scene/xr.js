// WebXR and Meta Quest Controller Input Module
// Supports Full 360° VR Immersion (immersive-vr), In-VR 3D HUD Console, and Hardware Button Shortcuts
import * as THREE from 'three';
import { AppState } from '../state.js';
import { unlockAudio } from '../audio.js';
import { setSpaceVisibility } from '../spaces/index.js';
import {
  initVRHUD,
  setVRHUDVisibility,
  updateVRHUDState,
  testVRHUDIntersection
} from './vr_hud.js';

let xrSession = null;
let isEnteringXR = false;
let xrControllers = [];
let registeredActionCallbacks = {};

// Button debouncing map per controller
const prevButtonState = {
  left: { b0: false, b1: false, b4: false, b5: false },
  right: { b0: false, b1: false, b4: false, b5: false }
};
let lastThumbstickSwitchTime = 0;

const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();

export function setXRActionCallbacks(callbacks) {
  registeredActionCallbacks = { ...registeredActionCallbacks, ...callbacks };
}

function createControllerLaser() {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -2.5], 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute([
    0.3, 0.7, 1.0,
    0.1, 0.3, 0.8
  ], 3));
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.6
  });
  const line = new THREE.Line(geom, mat);
  line.name = 'controller_laser';
  return line;
}

export function setupXRControllers(scene, renderer) {
  xrControllers = [];
  initVRHUD(scene);

  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    controller.addEventListener('selectstart', () => unlockAudio());
    controller.addEventListener('select', () => unlockAudio());

    // Laser pointer beam
    controller.add(createControllerLaser());

    // Hand pointer sphere marker
    const gripSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x6366f1 })
    );
    controller.add(gripSphere);

    scene.add(controller);
    xrControllers.push(controller);
  }
  return xrControllers;
}

/**
 * Meta Quest 3 Touch Controller Hardware Inputs:
 * - Button B (Right) / Button Y (Left): Exit VR back to Regular Browser Mode!
 * - Button A (Right) / Button X (Left): Push-to-Talk / Toggle Mic!
 * - Grip Button: Toggle Live Mode!
 * - Trigger: Click interactive In-VR 3D Console buttons!
 * - Stick Y: Avatar distance / scale!
 * - Stick X: Cycle spaces (Left stick) / cycle avatars (Right stick)!
 */
export function handleXRControllerInput(renderer, delta, applyAvatarTransformCallback, hudElement, customCallbacks) {
  const session = renderer.xr.getSession();
  if (!session) return;

  const callbacks = customCallbacks || registeredActionCallbacks;
  const now = Date.now();
  let transformChanged = false;

  for (let idx = 0; idx < session.inputSources.length; idx++) {
    const source = session.inputSources[idx];
    if (!source.gamepad) continue;

    const gamepad = source.gamepad;
    const handedness = source.handedness || (idx === 0 ? 'right' : 'left');
    const prev = prevButtonState[handedness] || (prevButtonState[handedness] = {});

    // 1. Button 5: Secondary Button (B on Right, Y on Left) -> EMERGENCY EXIT VR!
    const b5 = gamepad.buttons.length > 5 ? gamepad.buttons[5].pressed : false;
    if (b5 && !prev.b5) {
      console.log(`[XR] ${handedness} Controller B/Y button pressed: Exiting VR to Regular Mode`);
      if (callbacks.onExitVR) {
        callbacks.onExitVR();
      } else if (xrSession) {
        xrSession.end();
      }
    }
    prev.b5 = b5;

    // 2. Button 4: Primary Button (A on Right, X on Left) -> TALK / MIC
    const b4 = gamepad.buttons.length > 4 ? gamepad.buttons[4].pressed : false;
    if (b4 && !prev.b4) {
      console.log(`[XR] ${handedness} Controller A/X button pressed: Toggling Microphone`);
      if (callbacks.onToggleMic) {
        callbacks.onToggleMic();
      }
    }
    prev.b4 = b4;

    // 3. Button 1: Grip Squeeze -> TOGGLE LIVE MODE
    const b1 = gamepad.buttons.length > 1 ? gamepad.buttons[1].pressed : false;
    if (b1 && !prev.b1) {
      console.log(`[XR] ${handedness} Controller Grip squeezed: Toggling Live Mode`);
      if (callbacks.onToggleLive) {
        callbacks.onToggleLive();
      }
    }
    prev.b1 = b1;

    // 4. Button 0: Index Trigger -> Click In-VR 3D HUD Console
    const b0 = gamepad.buttons.length > 0 ? gamepad.buttons[0].pressed : false;
    const triggerClick = b0 && !prev.b0;
    prev.b0 = b0;

    // Controller Raycasting against In-VR Console (mapped to exact controller index)
    const controller = xrControllers[idx] || renderer.xr.getController(idx);
    if (controller && triggerClick) {
      tempMatrix.identity().extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

      testVRHUDIntersection(raycaster, true, callbacks);
    }

    // 5. Thumbstick Inputs
    if (gamepad.axes && gamepad.axes.length >= 2) {
      const axes = gamepad.axes;
      const stickX = axes.length >= 4 ? axes[2] : axes[0];
      const stickY = axes.length >= 4 ? axes[3] : axes[1];

      // Check if Grip button is held for height/floor level adjustment
      const isGripHeld = (gamepad.buttons[1] && gamepad.buttons[1].pressed) || (gamepad.buttons[2] && gamepad.buttons[2].pressed);

      // Vertical Stick: Move closer/further (Right) or Scale size (Left)
      // When Grip is held: adjust Avatar Height / Floor Level Offset (-1.5m to +1.5m)
      if (Math.abs(stickY) > 0.15) {
        if (isGripHeld) {
          AppState.avatarHeightOffset = Math.max(-1.5, Math.min(1.5, (AppState.avatarHeightOffset || 0.0) - stickY * delta * 0.9));
          transformChanged = true;
        } else if (handedness === 'right') {
          AppState.avatarDistance += stickY * delta * 1.5;
          AppState.avatarDistance = Math.max(-1.5, Math.min(2.5, AppState.avatarDistance));
          transformChanged = true;
        } else if (handedness === 'left') {
          AppState.avatarScale -= stickY * delta * 0.8;
          AppState.avatarScale = Math.max(0.3, Math.min(2.5, AppState.avatarScale));
          transformChanged = true;
        }
      }

      // Horizontal Stick: Cycle Avatar (Right) or Cycle Space (Left) with 400ms debounce
      if (Math.abs(stickX) > 0.65 && (now - lastThumbstickSwitchTime > 400)) {
        lastThumbstickSwitchTime = now;
        const dir = stickX > 0 ? 1 : -1;
        if (handedness === 'right') {
          if (callbacks.onCycleAvatar) callbacks.onCycleAvatar(dir);
        } else if (handedness === 'left') {
          if (callbacks.onCycleSpace) callbacks.onCycleSpace(dir);
        }
      }
    }
  }

  // Update In-VR HUD hover state from pointing controllers
  for (let i = 0; i < xrControllers.length; i++) {
    const c = xrControllers[i];
    if (c && c.visible) {
      tempMatrix.identity().extractRotation(c.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
      const hit = testVRHUDIntersection(raycaster, false, callbacks);
      if (hit && hit.buttonKey) break;
    }
  }

  if (transformChanged) {
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

  if (isEnteringXR) {
    console.log('WebXR entry already in progress, ignoring duplicate trigger.');
    return Promise.resolve(null);
  }

  isEnteringXR = true;

  // Ensure 360 photorealistic dome space is visible and show In-VR HUD
  setSpaceVisibility(true);
  setVRHUDVisibility(true);

  // Configure session based on selected space:
  // For 360 photo spaces (hall, garden, cafe, penthouse), use full 'immersive-vr' with required 'local-floor'
  // For real room passthrough, use 'immersive-ar'
  const isPassthrough = AppState.spaceId === 'passthrough';
  const primaryMode = isPassthrough ? 'immersive-ar' : 'immersive-vr';
  const sessionInit = isPassthrough
    ? { optionalFeatures: ['local-floor', 'hit-test', 'hand-tracking'] }
    : { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] };

  const sessionPromise = navigator.xr.requestSession(primaryMode, sessionInit)
    .catch((primaryErr) => {
      console.warn(`${primaryMode} request failed, attempting fallback session:`, primaryErr);
      const fallbackMode = isPassthrough ? 'immersive-vr' : 'immersive-ar';
      return navigator.xr.requestSession(fallbackMode, {
        optionalFeatures: ['local-floor', 'hand-tracking']
      });
    });

  return sessionPromise
    .then(async (session) => {
      xrSession = session;
      isEnteringXR = false;
      scene.background = null;
      setSpaceVisibility(true);
      setVRHUDVisibility(true);

      session.addEventListener('end', () => {
        xrSession = null;
        isEnteringXR = false;
        scene.background = new THREE.Color(0x05070f);
        setSpaceVisibility(true);
        setVRHUDVisibility(false);
        if (onSessionChange) onSessionChange(false, 'vr');
      });

      try {
        // Enforce physical Guardian floor calibration as reference space
        if (renderer.xr && typeof renderer.xr.setReferenceSpaceType === 'function') {
          renderer.xr.setReferenceSpaceType('local-floor');
        }
        await renderer.xr.setSession(session);
      } catch (xrErr) {
        console.warn('Primary local-floor reference space setSession failed, attempting local fallback:', xrErr);
        try {
          renderer.xr.setReferenceSpaceType('local');
          await renderer.xr.setSession(session);
        } catch (fatalErr) {
          console.error('Fatal WebXR setSession error:', fatalErr);
          session.end();
          xrSession = null;
          setVRHUDVisibility(false);
          throw fatalErr;
        }
      }

      setVRHUDVisibility(true);
      if (onSessionChange) onSessionChange(true, 'vr');
      return session;
    })
    .catch((err) => {
      isEnteringXR = false;
      setVRHUDVisibility(false);
      console.error('WebXR VR request failed:', err);
      if (!xrSession) {
        alert(`Could not launch 360° VR: ${err.message}\nMake sure you are viewing this page inside the Meta Quest Browser on Meta Quest 3.`);
      }
      throw err;
    });
}

/**
 * Consolidated AR alias: routes through the unified WebXR session
 */
export function enterAR(renderer, scene, onSessionChange) {
  return enterVR(renderer, scene, onSessionChange);
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

export { updateVRHUDState };
