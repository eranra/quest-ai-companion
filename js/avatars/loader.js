// GLTF Model Loader Utility with In-Memory Caching & Three.js r128 Compatibility
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const modelCache = new Map();
const loader = new GLTFLoader();

export async function loadGLBAvatar(url) {
  if (modelCache.has(url)) {
    const cached = modelCache.get(url);
    // Clone scene and skeleton
    const cloneScene = cached.scene.clone(true);
    return {
      scene: cloneScene,
      animations: cached.animations || []
    };
  }

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        gltf.scene.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) {
              node.material.side = THREE.DoubleSide;
              // Ensure proper lighting response
              if (node.material.roughness !== undefined) {
                node.material.roughness = Math.max(0.2, node.material.roughness);
              }
            }
          }
        });

        modelCache.set(url, {
          scene: gltf.scene,
          animations: gltf.animations || []
        });

        resolve({
          scene: gltf.scene,
          animations: gltf.animations || []
        });
      },
      undefined,
      (err) => {
        console.error(`Failed to load GLB from ${url}:`, err);
        reject(err);
      }
    );
  });
}
