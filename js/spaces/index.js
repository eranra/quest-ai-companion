import * as THREE from 'three';
import { AppState } from '../state.js';
import { createStudyHallSpace } from './hall.js';
import { createGardenSpace } from './garden.js';
import { createPenthouseSpace } from './penthouse.js';
import { createCafeSpace } from './cafe.js';

export function createPassthroughSpace() {
  const group = new THREE.Group();
  group.name = 'space_passthrough';

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
  group.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xfff8ee, 0.9);
  dirLight.position.set(2, 4, 3);
  group.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.4);
  fillLight.position.set(-2, 3, -1);
  group.add(fillLight);

  return {
    group,
    update: (delta, elapsed) => {}
  };
}

export const SPACE_DEFINITIONS = [
  {
    id: 'hall',
    name: 'Study Hall',
    icon: '🏛️',
    tagline: '360° Photorealistic grand forum with sunbeams & gliding birds',
    factory: createStudyHallSpace
  },
  {
    id: 'garden',
    name: 'Zen Garden',
    icon: '🌿',
    tagline: '360° Photorealistic Japanese courtyard with falling petals & birds',
    factory: createGardenSpace
  },
  {
    id: 'penthouse',
    name: 'Sky Penthouse',
    icon: '🌌',
    tagline: '360° Photorealistic luxury skyline with cruising skycars',
    factory: createPenthouseSpace
  },
  {
    id: 'cafe',
    name: 'Cozy Cafe',
    icon: '☕',
    tagline: '360° Photorealistic coffeehouse with rising steam & window rain',
    factory: createCafeSpace
  },
  {
    id: 'passthrough',
    name: 'Real Room (Immersed)',
    icon: '🪟',
    tagline: 'Mixed Reality Passthrough: See your real physical room with the avatar right in front of you',
    factory: createPassthroughSpace
  }
];

let sceneRef = null;
let rendererRef = null;
let currentSpaceInstance = null;
let currentSpaceId = null;
let contactShadowMesh = null;

/**
 * Creates a soft radial contact shadow texture for avatar grounding
 */
function createContactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  gradient.addColorStop(0.35, 'rgba(0, 0, 0, 0.4)');
  gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.12)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function initSpaces(scene, renderer) {
  sceneRef = scene;
  if (renderer) rendererRef = renderer;

  // Create realistic contact shadow that stays beneath the character's feet
  const shadowGeo = new THREE.PlaneGeometry(1.2, 1.2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  });
  contactShadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadowMesh.rotation.x = -Math.PI / 2;
  contactShadowMesh.position.set(0, 0.005, -AppState.avatarDistance);
  scene.add(contactShadowMesh);

  // Load saved or default space
  const targetSpace = AppState.spaceId || 'hall';
  switchSpace(targetSpace);
}

export function switchSpace(spaceId) {
  if (!sceneRef) return;

  const def = SPACE_DEFINITIONS.find(s => s.id === spaceId) || SPACE_DEFINITIONS[0];

  // Remove existing space
  if (currentSpaceInstance && currentSpaceInstance.group) {
    sceneRef.remove(currentSpaceInstance.group);
    // Dispose geometries and materials
    currentSpaceInstance.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  // Create new space
  currentSpaceInstance = def.factory();
  currentSpaceId = def.id;
  AppState.spaceId = def.id;
  AppState.save();

  // Handle transparent background for Passthrough WebXR mode vs 3D photo environments
  if (def.id === 'passthrough') {
    sceneRef.background = null;
    if (rendererRef) {
      rendererRef.setClearColor(0x000000, 0);
      rendererRef.setClearAlpha(0);
    }
  } else {
    if (rendererRef) {
      rendererRef.setClearColor(0x05070f, 1);
      rendererRef.setClearAlpha(1);
    }
    if (sceneRef && (!rendererRef || !rendererRef.xr || !rendererRef.xr.isPresenting)) {
      sceneRef.background = new THREE.Color(0x05070f);
    }
  }

  sceneRef.add(currentSpaceInstance.group);
  return def;
}

export function updateCurrentSpace(delta, elapsed, avatarPos, avatarScale) {
  if (currentSpaceInstance && typeof currentSpaceInstance.update === 'function') {
    currentSpaceInstance.update(delta, elapsed);
  }

  // Keep contact shadow perfectly grounded beneath the avatar
  if (contactShadowMesh && avatarPos) {
    contactShadowMesh.position.x = avatarPos.x;
    contactShadowMesh.position.z = avatarPos.z;
    // Scale shadow with avatar scale
    const scale = (avatarScale || 1.0) * 1.1;
    contactShadowMesh.scale.set(scale, scale, 1.0);
  }
}

export function setSpaceVisibility(visible) {
  if (currentSpaceInstance && currentSpaceInstance.group) {
    currentSpaceInstance.group.visible = visible;
  }
  if (contactShadowMesh) {
    contactShadowMesh.visible = visible;
  }
}

export function getCurrentSpaceId() {
  return currentSpaceId;
}

export function cycleSpace(direction = 1) {
  const currentId = getCurrentSpaceId() || 'hall';
  const index = SPACE_DEFINITIONS.findIndex(s => s.id === currentId);
  const nextIndex = (index + direction + SPACE_DEFINITIONS.length) % SPACE_DEFINITIONS.length;
  const nextDef = switchSpace(SPACE_DEFINITIONS[nextIndex].id);
  return nextDef;
}
