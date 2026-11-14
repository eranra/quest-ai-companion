// Three.js Scene, WebXR Session, Camera Framing, and Meta Quest 3 Controller Manipulation
import * as THREE from 'three';
import { AppState } from '../state.js';
import {
  animateRig,
  motionState,
  triggerAvatarGesture,
  moveAvatar,
  setFreestyleMode,
  getAvatarMotionStatus
} from '../avatars/rig.js';
import { initSpaces, updateCurrentSpace, setSpaceVisibility } from '../spaces/index.js';
import { createCamera, createOrbitControls, applyResponsiveFraming as applyCameraFraming } from './camera.js';
import {
  setupXRControllers,
  handleXRControllerInput,
  toggleWebXR as toggleXR,
  enterVR as xrEnterVR,
  enterAR as xrEnterAR,
  toggleFullscreen as xrToggleFullscreen,
  isXRSessionActive,
  setXRActionCallbacks,
  updateVRHUDState
} from './xr.js';

export let scene, camera, renderer, controls, clock;
export let avatarGroup;
let hudElement = null;

export function initScene(container, hud) {
  hudElement = hud;
  clock = new THREE.Clock();

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070f);

  // Camera
  camera = createCamera();

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  // Orbit Controls (Mobile touch & desktop mouse)
  controls = createOrbitControls(camera, renderer.domElement);

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e1b4b, 1.4);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(2, 4, 3);
  scene.add(dirLight);

  const fillLight = new THREE.PointLight(0x6366f1, 1.0, 10);
  fillLight.position.set(-2, 1, 2);
  scene.add(fillLight);

  // Initialize Atmospheric Spaces (Environments) & Avatar Grounding
  initSpaces(scene, renderer);

  // Avatar Root Group
  avatarGroup = new THREE.Group();
  scene.add(avatarGroup);
  applyAvatarTransform();

  // Setup WebXR Controllers
  setupXRControllers(scene, renderer);

  // Resize and Orientation Listener
  window.addEventListener('resize', applyResponsiveFraming);
  applyResponsiveFraming();

  // Animation Loop
  renderer.setAnimationLoop(renderLoop);

  return { scene, camera, renderer, avatarGroup };
}

export function applyAvatarTransform() {
  if (!avatarGroup) return;
  // Apply Quest 3 / user scale, distance, and orientation
  avatarGroup.scale.setScalar(AppState.avatarScale);

  // In WebXR: User stands at (0, 0, 0) looking down -Z axis.
  // The avatar stands comfortably in front of the user (at -1.8m + thumbstick adjustment).
  // In 2D: Camera is at +2.2m looking at (0, 1, 0), so avatar stands at 0.0m + adjustment.
  const isXR = renderer && renderer.xr && renderer.xr.isPresenting;
  const baseZ = isXR ? -1.8 : 0.0;
  avatarGroup.userData.baseZ = baseZ;
  avatarGroup.position.x = motionState.posX || 0.0;
  avatarGroup.position.z = (baseZ - AppState.avatarDistance) + (motionState.posZ || 0.0);
  avatarGroup.position.y = (AppState.avatarHeightOffset || 0.0) + (motionState.jumpY || 0.0);
  avatarGroup.rotation.y = AppState.avatarRotationY + (motionState.headingRotY || 0.0);

  if (hudElement) {
    const scaleVal = hudElement.querySelector('#hud-scale-val');
    const distVal = hudElement.querySelector('#hud-dist-val');
    const heightVal = hudElement.querySelector('#hud-height-val');
    if (scaleVal) scaleVal.textContent = `${AppState.avatarScale.toFixed(2)}x`;
    if (distVal) distVal.textContent = `${(1.8 + AppState.avatarDistance).toFixed(2)}m`;
    if (heightVal) heightVal.textContent = `${(AppState.avatarHeightOffset || 0.0).toFixed(2)}m`;
  }
}

export function flipAvatarOrientation() {
  if (!avatarGroup) return 0;
  AppState.avatarRotationY = (AppState.avatarRotationY + Math.PI) % (Math.PI * 2);
  AppState.save();
  applyAvatarTransform();
  return AppState.avatarRotationY;
}

export function resetCameraView() {
  applyCameraFraming(camera, controls, renderer);
}

export function applyResponsiveFraming() {
  applyCameraFraming(camera, controls, renderer);
}

export async function toggleWebXR(onSessionChange, mode = 'vr') {
  if (typeof onSessionChange === 'string') {
    // Called as toggleWebXR('vr', cb) or toggleWebXR('ar', cb)
    const tempMode = onSessionChange;
    const actualCb = mode && typeof mode === 'function' ? mode : null;
    return toggleXR(renderer, scene, actualCb, tempMode);
  }
  return toggleXR(renderer, scene, onSessionChange, mode);
}

export function enterVR(onSessionChange) {
  const wrappedCb = (isVR, mode) => {
    applyAvatarTransform();
    if (onSessionChange) onSessionChange(isVR, mode);
  };
  return xrEnterVR(renderer, scene, wrappedCb);
}

export function enterAR(onSessionChange) {
  const wrappedCb = (isAR, mode) => {
    applyAvatarTransform();
    if (onSessionChange) onSessionChange(isAR, mode);
  };
  return xrEnterAR(renderer, scene, wrappedCb);
}

export function toggleFullscreen() {
  return xrToggleFullscreen();
}

function renderLoop(timestamp, frame) {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Quest 3 Controller input handling in XR
  if (frame) {
    handleXRControllerInput(renderer, delta, applyAvatarTransform, hudElement);
  }

  // Animate dynamic elements in current 3D space (clouds, petals, steam, skycars)
  updateCurrentSpace(delta, elapsed, avatarGroup.position, AppState.avatarScale);

  // Update Procedural Rig Animations
  animateRig(delta, elapsed, camera, avatarGroup);

  if (!renderer.xr.isPresenting) {
    controls.update();
  }

  renderer.render(scene, camera);
}

export {
  createCamera,
  createOrbitControls,
  setupXRControllers,
  handleXRControllerInput,
  isXRSessionActive,
  setXRActionCallbacks,
  updateVRHUDState,
  motionState,
  triggerAvatarGesture,
  moveAvatar,
  setFreestyleMode,
  getAvatarMotionStatus
};
