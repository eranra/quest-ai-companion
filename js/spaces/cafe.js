// Space 4: Cozy Cafe / Coffee Lounge (360° Photorealistic Environment)
import * as THREE from 'three';
import { createParquetFloorTexture } from './textures.js';

export function createCafeSpace() {
  const group = new THREE.Group();

  // 1. 360° Photorealistic Equirectangular Spherical Panorama
  const sphereGeo = new THREE.SphereGeometry(60, 60, 40);
  const texLoader = new THREE.TextureLoader();
  const panoTexture = texLoader.load('assets/spaces/cafe.jpg');
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

  // 2. Physical 3D Warm Parquet Wood Floor at y = 0
  const floorGeo = new THREE.PlaneGeometry(14, 14);
  const floorMat = new THREE.MeshStandardMaterial({
    map: createParquetFloorTexture(),
    roughness: 0.55,
    metalness: 0.04
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  group.add(floor);

  // 3. Cafe Bistro Table & Ceramic Coffee Cup at y = 0
  const tableGroup = new THREE.Group();
  tableGroup.position.set(-0.9, 0, -1.0);

  const tabletop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.03, 24),
    new THREE.MeshStandardMaterial({ color: 0x291408, roughness: 0.3 })
  );
  tabletop.position.y = 0.72;
  const tableLeg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.035, 0.72, 12),
    new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8, roughness: 0.2 })
  );
  tableLeg.position.y = 0.36;
  const tableBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.22, 0.02, 16),
    new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8, roughness: 0.2 })
  );
  tableBase.position.y = 0.01;

  // Coffee cup on table
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.03, 0.07, 16),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 })
  );
  cup.position.y = 0.77;

  tableGroup.add(tabletop, tableLeg, tableBase, cup);
  group.add(tableGroup);

  // 4. Warm Vintage Ambient & Edison Lighting
  const ambientLight = new THREE.AmbientLight(0xffedd5, 1.0);
  const warmLamp = new THREE.PointLight(0xf59e0b, 1.1, 8);
  warmLamp.position.set(-0.9, 2.2, -1.0);
  const fillLight = new THREE.PointLight(0xfef3c7, 0.7, 10);
  fillLight.position.set(1.5, 2.0, 0.5);
  group.add(ambientLight, warmLamp, fillLight);

  // 5. Dynamic Living Elements:
  // A. Rising Volumetric Coffee Steam Particles from the cup
  const steamCount = 35;
  const steamGeo = new THREE.BufferGeometry();
  const steamPositions = new Float32Array(steamCount * 3);
  for (let i = 0; i < steamCount; i++) {
    steamPositions[i * 3] = -0.9 + (Math.random() - 0.5) * 0.08;
    steamPositions[i * 3 + 1] = 0.82 + Math.random() * 0.5;
    steamPositions[i * 3 + 2] = -1.0 + (Math.random() - 0.5) * 0.08;
  }
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPositions, 3));
  const steamMat = new THREE.PointsMaterial({
    color: 0xfef3c7,
    size: 0.035,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending
  });
  const steam = new THREE.Points(steamGeo, steamMat);
  group.add(steam);

  // B. Rain Streaks sliding outside the window
  const rainCount = 45;
  const rainGeo = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = -3.2 + (Math.random() - 0.5) * 2.5;
    rainPositions[i * 3 + 1] = 1.0 + Math.random() * 3.0;
    rainPositions[i * 3 + 2] = -4.5 + (Math.random() - 0.5) * 1.5;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0x93c5fd,
    size: 0.03,
    transparent: true,
    opacity: 0.65
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  group.add(rain);

  return {
    group,
    update(delta, elapsed) {
      // 1. Rising coffee steam
      const sPos = steamGeo.attributes.position.array;
      for (let i = 0; i < steamCount; i++) {
        sPos[i * 3 + 1] += delta * 0.16; // rise
        sPos[i * 3] += Math.sin(elapsed * 2.5 + i) * 0.0015;
        if (sPos[i * 3 + 1] > 1.35) {
          sPos[i * 3 + 1] = 0.82;
          sPos[i * 3] = -0.9 + (Math.random() - 0.5) * 0.06;
        }
      }
      steamGeo.attributes.position.needsUpdate = true;

      // 2. Falling rain streaks outside window
      const rPos = rainGeo.attributes.position.array;
      for (let i = 0; i < rainCount; i++) {
        rPos[i * 3 + 1] -= delta * 2.8; // fall
        if (rPos[i * 3 + 1] < 0.8) {
          rPos[i * 3 + 1] = 4.0;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;

      // 3. Warm Edison light subtle flicker
      warmLamp.intensity = 1.45 + Math.sin(elapsed * 10) * 0.05;
    }
  };
}
