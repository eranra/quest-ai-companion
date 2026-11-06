// Three.js Scene, WebXR Session, Camera Framing, and Meta Quest 3 Controller Manipulation
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AppState } from './state.js';
import { animateRig, rig } from './avatars/rig.js';
import { unlockAudio } from './audio.js';

export let scene, camera, renderer, controls, clock;
export let avatarGroup;
let gridHelper;
let xrSession = null;
let xrControllers = [];
let hudElement = null;

export function initScene(container, hud) {
  hudElement = hud;
  clock = new THREE.Clock();

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070f);

  // Camera
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.25, 2.5);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  // Orbit Controls (Mobile touch & desktop mouse)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 1.0, 0);
  controls.minDistance = 0.5;
  controls.maxDistance = 6.0;
  controls.maxPolarAngle = Math.PI / 2 + 0.1;

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

  // Floor Grid (Visible in 3D mode, hidden in WebXR passthrough)
  gridHelper = new THREE.GridHelper(10, 20, 0x4f46e5, 0x1e1b4b);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Avatar Root Group
  avatarGroup = new THREE.Group();
  scene.add(avatarGroup);
  applyAvatarTransform();

  // Setup WebXR Controllers
  setupXRControllers();

  // Resize and Orientation Listener
  window.addEventListener('resize', applyResponsiveFraming);
  applyResponsiveFraming();

  // Animation Loop
  renderer.setAnimationLoop(renderLoop);

  return { scene, camera, renderer, avatarGroup };
}

export function applyAvatarTransform() {
  if (!avatarGroup) return;
  // Apply Quest 3 / user scale and distance
  avatarGroup.scale.setScalar(AppState.avatarScale);
  avatarGroup.position.z = AppState.avatarDistance;

  if (hudElement) {
    const scaleVal = hudElement.querySelector('#hud-scale-val');
    const distVal = hudElement.querySelector('#hud-dist-val');
    if (scaleVal) scaleVal.textContent = `${AppState.avatarScale.toFixed(2)}x`;
    if (distVal) distVal.textContent = `${(1.5 + AppState.avatarDistance).toFixed(2)}m`;
  }
}

function setupXRControllers() {
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    controller.addEventListener('selectstart', () => unlockAudio());
    scene.add(controller);
    xrControllers.push(controller);
  }
}

// -------------------------------------------------------------
// Meta Quest 3 Touch Controller Thumbstick Inputs:
// Right Stick Y: Move avatar distance closer/further
// Left Stick Y: Scale avatar size up/down
// -------------------------------------------------------------
function handleXRControllerInput(delta) {
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
    applyAvatarTransform();
    AppState.save();
    if (hudElement) {
      hudElement.classList.add('visible');
      if (hudElement._hideTimeout) clearTimeout(hudElement._hideTimeout);
      hudElement._hideTimeout = setTimeout(() => hudElement.classList.remove('visible'), 2000);
    }
  }
}

export function applyResponsiveFraming() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;

  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);

  if (aspect < 0.8) {
    // Android Mobile Vertical Portrait
    camera.position.set(0, 1.15, 3.1);
    controls.target.set(0, 0.95, 0);
  } else if (aspect < 1.2) {
    // Tablet / Square
    camera.position.set(0, 1.15, 2.6);
    controls.target.set(0, 1.0, 0);
  } else {
    // Desktop & Android Landscape
    camera.position.set(0, 1.2, 2.2);
    controls.target.set(0, 1.05, 0);
  }
  controls.update();
}

export async function toggleWebXR(onSessionChange) {
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
        if (gridHelper) gridHelper.visible = false;
      }

      session.addEventListener('end', () => {
        xrSession = null;
        scene.background = new THREE.Color(0x05070f);
        if (gridHelper) gridHelper.visible = true;
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

function renderLoop(timestamp, frame) {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Quest 3 Controller input handling in XR
  if (frame) {
    handleXRControllerInput(delta);
  }

  // Update Procedural Rig Animations
  animateRig(delta, elapsed, camera, avatarGroup);

  if (!renderer.xr.isPresenting) {
    controls.update();
  }

  renderer.render(scene, camera);
}
