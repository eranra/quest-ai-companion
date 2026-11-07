// Three.js Scene, WebXR Session, Camera Framing, and Meta Quest 3 Controller Manipulation
import * as THREE from 'three';
import { AppState } from '../state.js';
import { animateRig } from '../avatars/rig.js';
import { initSpaces, updateCurrentSpace, setSpaceVisibility } from '../spaces/index.js';
import { createCamera, createOrbitControls, applyResponsiveFraming as applyCameraFraming } from './camera.js';
import { setupXRControllers, handleXRControllerInput, toggleWebXR as toggleXR } from './xr.js';

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
  initSpaces(scene);

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
  avatarGroup.position.z = AppState.avatarDistance;
  avatarGroup.rotation.y = AppState.avatarRotationY;

  if (hudElement) {
    const scaleVal = hudElement.querySelector('#hud-scale-val');
    const distVal = hudElement.querySelector('#hud-dist-val');
    if (scaleVal) scaleVal.textContent = `${AppState.avatarScale.toFixed(2)}x`;
    if (distVal) distVal.textContent = `${(1.5 + AppState.avatarDistance).toFixed(2)}m`;
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

export async function toggleWebXR(onSessionChange) {
  return toggleXR(renderer, scene, onSessionChange);
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
  handleXRControllerInput
};
