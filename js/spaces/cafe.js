// Space 4: Cozy Cafe / Coffee Lounge (360° Photorealistic Environment)
import * as THREE from 'three';

export function createCafeSpace() {
  const group = new THREE.Group();

  // 1. 360° Photorealistic Equirectangular Spherical Panorama
  const sphereGeo = new THREE.SphereGeometry(35, 60, 40);
  sphereGeo.scale(-1, 1, 1);
  const texLoader = new THREE.TextureLoader();
  const panoTexture = texLoader.load('assets/spaces/cafe.jpg');
  panoTexture.encoding = THREE.sRGBEncoding;

  const sphereMat = new THREE.MeshBasicMaterial({
    map: panoTexture,
    depthWrite: false
  });
  const skyDome = new THREE.Mesh(sphereGeo, sphereMat);
  skyDome.position.set(0, 1.2, 0);
  group.add(skyDome);

  // 2. Invisible Ground Plane
  const floorPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.position.y = 0;
  group.add(floorPlane);

  // 3. Warm Vintage Ambient & Edison Lighting
  const ambientLight = new THREE.AmbientLight(0xffedd5, 1.4);
  const warmLamp = new THREE.PointLight(0xf59e0b, 1.5, 8);
  warmLamp.position.set(-1.2, 2.6, -1.0);
  const fillLight = new THREE.PointLight(0xfef3c7, 1.0, 10);
  fillLight.position.set(1.5, 2.2, 0.5);
  group.add(ambientLight, warmLamp, fillLight);

  // 4. Dynamic Living Elements:
  // A. Rising Volumetric Coffee Steam Particles
  const steamCount = 35;
  const steamGeo = new THREE.BufferGeometry();
  const steamPositions = new Float32Array(steamCount * 3);
  for (let i = 0; i < steamCount; i++) {
    steamPositions[i * 3] = -0.9 + (Math.random() - 0.5) * 0.12;
    steamPositions[i * 3 + 1] = 0.85 + Math.random() * 0.6;
    steamPositions[i * 3 + 2] = -1.1 + (Math.random() - 0.5) * 0.12;
  }
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPositions, 3));
  const steamMat = new THREE.PointsMaterial({
    color: 0xfef3c7,
    size: 0.045,
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
        if (sPos[i * 3 + 1] > 1.45) {
          sPos[i * 3 + 1] = 0.85;
          sPos[i * 3] = -0.9 + (Math.random() - 0.5) * 0.08;
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
