// Camera and Framing Module
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createCamera() {
  const width = (typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth : 1024;
  const height = (typeof window !== 'undefined' && window.innerHeight > 0) ? window.innerHeight : 768;
  const aspect = height > 0 ? (width / height) : 1.33;
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
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
  const width = (typeof window !== 'undefined' && window.innerWidth > 0)
    ? window.innerWidth
    : (typeof document !== 'undefined' && document.documentElement && document.documentElement.clientWidth > 0 ? document.documentElement.clientWidth : 1024);
  const height = (typeof window !== 'undefined' && window.innerHeight > 0)
    ? window.innerHeight
    : (typeof document !== 'undefined' && document.documentElement && document.documentElement.clientHeight > 0 ? document.documentElement.clientHeight : 768);

  if (width <= 0 || height <= 0) return;
  const aspect = width / height;
  if (!isFinite(aspect) || aspect <= 0) return;

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
