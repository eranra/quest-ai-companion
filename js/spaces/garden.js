// Space 2: Zen Garden / Japanese Courtyard (360° Photorealistic Environment)
import * as THREE from 'three';

export function createGardenSpace() {
  const group = new THREE.Group();

  // 1. 360° Photorealistic Equirectangular Spherical Panorama
  const sphereGeo = new THREE.SphereGeometry(35, 60, 40);
  sphereGeo.scale(-1, 1, 1);
  const texLoader = new THREE.TextureLoader();
  const panoTexture = texLoader.load('assets/spaces/garden.jpg');
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

  // 3. Natural Outdoor Daylight
  const ambientLight = new THREE.AmbientLight(0xf0fdf4, 1.3);
  const sunLight = new THREE.DirectionalLight(0xfef08a, 1.5);
  sunLight.position.set(4, 8, 3);
  const skyLight = new THREE.HemisphereLight(0x93c5fd, 0x166534, 0.8);
  group.add(ambientLight, sunLight, skyLight);

  // 4. Dynamic Living Elements:
  // A. Floating Cherry Blossom Petals gently swirling down in 3D space
  const petalCount = 75;
  const petalGeo = new THREE.BufferGeometry();
  const petalPositions = new Float32Array(petalCount * 3);
  for (let i = 0; i < petalCount; i++) {
    petalPositions[i * 3] = (Math.random() - 0.5) * 8.0;
    petalPositions[i * 3 + 1] = 0.2 + Math.random() * 4.2;
    petalPositions[i * 3 + 2] = -0.5 - Math.random() * 5.0;
  }
  petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3));
  const petalMat = new THREE.PointsMaterial({
    color: 0xfda4af, // Soft cherry blossom pink
    size: 0.05,
    transparent: true,
    opacity: 0.85
  });
  const petals = new THREE.Points(petalGeo, petalMat);
  group.add(petals);

  // B. Distant Soaring Birds across mountain vista
  const gardenBirds = [];
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.18, 0, 0,
    0, 0.04, 0.06,
    0.18, 0, 0
  ]), 3));
  const birdMat = new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 2 });

  for (let i = 0; i < 4; i++) {
    const bMesh = new THREE.Line(birdGeo, birdMat);
    bMesh.position.set(-8 + i * 4.5, 4.5 + Math.random() * 2.0, -8 - i * 1.5);
    group.add(bMesh);
    gardenBirds.push({
      mesh: bMesh,
      speed: 0.8 + i * 0.25,
      phase: i * 1.8
    });
  }

  return {
    group,
    update(delta, elapsed) {
      // 1. Cherry blossom petals gently fluttering downwards
      const pos = petalGeo.attributes.position.array;
      for (let i = 0; i < petalCount; i++) {
        pos[i * 3 + 1] -= delta * 0.28; // gentle fall
        pos[i * 3] += Math.sin(elapsed * 1.8 + i) * 0.007; // lateral drift
        pos[i * 3 + 2] += Math.cos(elapsed * 1.4 + i) * 0.005;

        // Reset if hitting ground
        if (pos[i * 3 + 1] < 0.03) {
          pos[i * 3 + 1] = 4.4;
          pos[i * 3] = (Math.random() - 0.5) * 8.0;
          pos[i * 3 + 2] = -0.5 - Math.random() * 5.0;
        }
      }
      petalGeo.attributes.position.needsUpdate = true;

      // 2. Soaring birds across garden sky
      gardenBirds.forEach(b => {
        b.mesh.position.x += delta * b.speed;
        b.mesh.position.y += Math.sin(elapsed * 2.2 + b.phase) * 0.003;
        b.mesh.rotation.z = Math.sin(elapsed * 7.0 + b.phase) * 0.25;
        if (b.mesh.position.x > 10.0) {
          b.mesh.position.x = -10.0;
        }
      });
    }
  };
}
