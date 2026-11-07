// Camera and Framing Module
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.25, 2.5);
  return camera;
}

export function createOrbitControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 1.0, 0);
  controls.minDistance = 0.5;
  controls.maxDistance = 6.0;
  controls.maxPolarAngle = Math.PI / 2 + 0.1;
  return controls;
}

export function applyResponsiveFraming(camera, controls, renderer) {
  if (!camera || !renderer) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;

  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);

  if (controls) {
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
}
