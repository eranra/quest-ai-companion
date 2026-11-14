// GLTF Model Loader Utility with In-Memory Caching & Deep Skeleton Cloning
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const modelCache = new Map();
const loader = new GLTFLoader();

/**
 * Deep clones an Object3D hierarchy ensuring SkinnedMesh skeletons are properly
 * remapped to the newly cloned bones rather than referencing detached original bones.
 */
export function cloneSkinnedHierarchy(source) {
  if (!source) return null;
  const clone = source.clone(true);

  // Map original bones to newly cloned bones
  const boneMap = new Map();
  const origBones = [];
  source.traverse((n) => {
    if (n.isBone) origBones.push(n);
  });

  origBones.forEach((orig) => {
    const matching = clone.getObjectByName(orig.name);
    if (matching) {
      boneMap.set(orig, matching);
    }
  });

  // Rebind each cloned SkinnedMesh to the newly cloned skeleton
  clone.traverse((n) => {
    if (n.isSkinnedMesh && n.skeleton) {
      const clonedBones = n.skeleton.bones.map((b) => boneMap.get(b) || b);
      const newSkeleton = new THREE.Skeleton(clonedBones, n.skeleton.boneInverses);
      n.bind(newSkeleton, n.bindMatrix);
    }
  });

  return clone;
}

export async function loadGLBAvatar(url) {
  if (modelCache.has(url)) {
    const cached = modelCache.get(url);
    const cloneScene = cloneSkinnedHierarchy(cached.scene);
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

        // Return a fresh cloned instance so the master cache remains unmutated
        const initialClone = cloneSkinnedHierarchy(gltf.scene);
        resolve({
          scene: initialClone,
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
