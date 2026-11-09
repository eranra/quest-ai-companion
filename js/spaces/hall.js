// Space 1: Grand Study Hall / Academic Forum (360° Photorealistic Environment)
import * as THREE from 'three';
import { createHardwoodFloorTexture } from './textures.js';

export function createStudyHallSpace() {
  const group = new THREE.Group();

  // 1. 360° Photorealistic Equirectangular Spherical Panorama
  const sphereGeo = new THREE.SphereGeometry(60, 60, 40);
  const texLoader = new THREE.TextureLoader();
  const panoTexture = texLoader.load('assets/spaces/hall.jpg');
  panoTexture.colorSpace = THREE.SRGBColorSpace;

  const sphereMat = new THREE.MeshBasicMaterial({
    map: panoTexture,
    side: THREE.BackSide,
    depthWrite: false
  });
  const skyDome = new THREE.Mesh(sphereGeo, sphereMat);
  // Centered at y = 1.6m (average human eye height in WebXR local-floor) so horizon is perfectly aligned
  skyDome.position.set(0, 1.6, 0);
  group.add(skyDome);

  // 2. Physical 3D Hardwood Floor firmly grounding the avatar at y = 0
  const floorGeo = new THREE.PlaneGeometry(16, 16);
  const floorMat = new THREE.MeshStandardMaterial({
    map: createHardwoodFloorTexture(),
    roughness: 0.55,
    metalness: 0.04
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  group.add(floor);

  // 3. Tailored Atmosphere Lighting
  const ambientLight = new THREE.AmbientLight(0xfff5ea, 0.85);
  const sunLight = new THREE.DirectionalLight(0xffe4b5, 0.95);
  sunLight.position.set(3, 6, 2);
  const fillLight = new THREE.PointLight(0xe0e7ff, 0.5, 12);
  fillLight.position.set(-2, 3, 1);
  group.add(ambientLight, sunLight, fillLight);

  // 4. Dynamic Living Elements:
  // A. Floating Sunbeam Dust Motes across the hall
  const moteCount = 90;
  const moteGeo = new THREE.BufferGeometry();
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePositions[i * 3] = (Math.random() - 0.5) * 5.5;
    motePositions[i * 3 + 1] = 0.3 + Math.random() * 2.8;
    motePositions[i * 3 + 2] = -0.5 - Math.random() * 4.0;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xfef08a,
    size: 0.035,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  group.add(motes);

  // B. Animated Distant Birds gliding across high windows
  const birdCount = 3;
  const birds = [];
  const birdGeo = new THREE.BufferGeometry();
  const birdVertices = new Float32Array([
    -0.12, 0, 0,
    0, 0.03, 0.04,
    0.12, 0, 0
  ]);
  birdGeo.setAttribute('position', new THREE.BufferAttribute(birdVertices, 3));
  const birdMat = new THREE.LineBasicMaterial({ color: 0x1e293b, linewidth: 2 });

  for (let i = 0; i < birdCount; i++) {
    const bMesh = new THREE.Line(birdGeo, birdMat);
    bMesh.position.set(-6 + i * 4, 3.8 + Math.random() * 1.2, -6 - i * 2);
    group.add(bMesh);
    birds.push({
      mesh: bMesh,
      speed: 0.7 + i * 0.3,
      flapOffset: i * 2.1
    });
  }

  return {
    group,
    update(delta, elapsed) {
      // 1. Living motes drifting softly in sunbeams
      const pos = moteGeo.attributes.position.array;
      for (let i = 0; i < moteCount; i++) {
        pos[i * 3 + 1] += Math.sin(elapsed * 0.8 + i) * 0.002;
        pos[i * 3] += Math.cos(elapsed * 0.6 + i) * 0.001;
      }
      moteGeo.attributes.position.needsUpdate = true;

      // 2. Birds gliding across upper window view
      birds.forEach(b => {
        b.mesh.position.x += delta * b.speed;
        b.mesh.position.y += Math.sin(elapsed * 2.0 + b.flapOffset) * 0.002;
        b.mesh.rotation.z = Math.sin(elapsed * 6.0 + b.flapOffset) * 0.2;
        if (b.mesh.position.x > 8.0) {
          b.mesh.position.x = -8.0;
        }
      });

      // 3. Subtle daylight shift
      sunLight.intensity = 1.35 + Math.sin(elapsed * 0.3) * 0.06;
    }
  };
}
