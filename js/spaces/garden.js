// Space 2: Zen Garden / Bamboo Courtyard (Outdoor Environment)
import * as THREE from 'three';

export function createGardenSpace() {
  const group = new THREE.Group();

  // 1. Ground: Stone Path + Manicured Moss + Fine Raked Gravel
  const groundGeo = new THREE.PlaneGeometry(16, 16);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x22381e,
    roughness: 0.9
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  group.add(ground);

  // Stepping Stone Walkway (Avatar stands directly on center stone)
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
  for (let z = -4; z <= 4; z += 1.4) {
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.04, 16), stoneMat);
    stone.scale.set(1.1, 1, 0.9);
    stone.position.set((Math.sin(z * 1.5) * 0.15), 0.01, z);
    stone.receiveShadow = true;
    group.add(stone);
  }

  // 2. Distant Horizon: Misty Mountains & Blue Sky
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), skyMat);
  sky.scale.set(1, 0.7, 1);
  group.add(sky);

  // Distant mountain ridges
  const mtnMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 });
  for (let m = -3; m <= 3; m++) {
    const mtn = new THREE.Mesh(new THREE.ConeGeometry(3.5, 4.5, 5), mtnMat);
    mtn.position.set(m * 3.8, 1.8, -10 + Math.abs(m) * 0.5);
    mtn.scale.set(1.4, 1, 0.8);
    group.add(mtn);
  }

  // 3. Bamboo Grove & Swaying Stalks
  const bambooStalks = [];
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.4 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.5, side: THREE.DoubleSide });

  for (let b = 0; b < 18; b++) {
    const stalk = new THREE.Group();
    const side = b % 2 === 0 ? -1 : 1;
    const xPos = side * (2.2 + Math.random() * 3.5);
    const zPos = -3.5 + Math.random() * 6.5;

    const height = 3.5 + Math.random() * 2.0;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, height, 8), bambooMat);
    trunk.position.y = height / 2;
    trunk.castShadow = true;
    stalk.add(trunk);

    // Bamboo leafy tufts
    for (let l = 0; l < 4; l++) {
      const leafGroup = new THREE.Group();
      leafGroup.position.set(0, height * 0.6 + l * 0.4, 0);
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.12), leafMat);
      leaf.rotation.x = Math.PI / 4;
      leaf.position.x = 0.15;
      leafGroup.add(leaf);
      leafGroup.rotation.y = l * 1.5;
      stalk.add(leafGroup);
    }

    stalk.position.set(xPos, 0, zPos);
    group.add(stalk);
    bambooStalks.push({ group: stalk, phase: Math.random() * Math.PI * 2 });
  }

  // 4. Stone Lanterns with warm glow
  function createStoneLantern(x, z) {
    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(x, 0, z);

    const lMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.5, 8), lMat);
    base.position.y = 0.25;
    const chamber = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), lMat);
    chamber.position.y = 0.65;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.25, 4), lMat);
    roof.position.y = 0.95;
    roof.rotation.y = Math.PI / 4;

    // Warm lantern light
    const light = new THREE.PointLight(0xf59e0b, 1.2, 3.5);
    light.position.y = 0.65;

    lanternGroup.add(base, chamber, roof, light);
    return lanternGroup;
  }

  group.add(createStoneLantern(-2.2, -1.5));
  group.add(createStoneLantern(2.2, -1.5));

  // 5. LIVING DYNAMIC ELEMENTS: Drifting Petals & Soaring Birds
  // Cherry Blossom Petals
  const petalCount = 40;
  const petalGeo = new THREE.BufferGeometry();
  const petalPositions = new Float32Array(petalCount * 3);
  for (let i = 0; i < petalCount; i++) {
    petalPositions[i * 3] = (Math.random() - 0.5) * 8.0;
    petalPositions[i * 3 + 1] = 0.5 + Math.random() * 4.0;
    petalPositions[i * 3 + 2] = (Math.random() - 0.5) * 8.0;
  }
  petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3));
  const petalMat = new THREE.PointsMaterial({
    color: 0xfbcfe8,
    size: 0.06,
    transparent: true,
    opacity: 0.85
  });
  const petals = new THREE.Points(petalGeo, petalMat);
  group.add(petals);

  // Birds in sky
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.DoubleSide });
  const gardenBirds = [];
  for (let i = 0; i < 3; i++) {
    const bird = new THREE.Group();
    const wingGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([-0.12, 0, 0, 0, 0, -0.04, 0.12, 0, 0]);
    wingGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const mesh = new THREE.Mesh(wingGeo, birdMat);
    bird.add(mesh);
    bird.position.set(-6 + i * 4, 4.5 + i * 0.4, -8);
    group.add(bird);
    gardenBirds.push({ group: bird, speed: 0.5 + i * 0.2, phase: i * 1.5 });
  }

  // Sunlight
  const sunLight = new THREE.DirectionalLight(0xfef08a, 1.3);
  sunLight.position.set(5, 8, 4);
  group.add(sunLight);

  return {
    group,
    update(delta, elapsed) {
      // 1. Bamboo swaying organically in breeze
      bambooStalks.forEach(b => {
        const sway = Math.sin(elapsed * 1.5 + b.phase) * 0.035;
        b.group.rotation.z = sway;
      });

      // 2. Cherry blossom petals gently fluttering downwards
      const pos = petalGeo.attributes.position.array;
      for (let i = 0; i < petalCount; i++) {
        pos[i * 3 + 1] -= delta * 0.35; // fall
        pos[i * 3] += Math.sin(elapsed * 2.0 + i) * 0.008; // drift x
        pos[i * 3 + 2] += Math.cos(elapsed * 1.5 + i) * 0.006; // drift z

        // Reset if hitting ground
        if (pos[i * 3 + 1] < 0.05) {
          pos[i * 3 + 1] = 4.5;
          pos[i * 3] = (Math.random() - 0.5) * 8.0;
        }
      }
      petalGeo.attributes.position.needsUpdate = true;

      // 3. Birds soaring across sky
      gardenBirds.forEach(b => {
        b.group.position.x += delta * b.speed;
        b.group.position.y += Math.sin(elapsed * 2.5 + b.phase) * 0.004;
        b.group.children[0].rotation.z = Math.sin(elapsed * 9.0 + b.phase) * 0.45;
        if (b.group.position.x > 8.0) b.group.position.x = -8.0;
      });
    }
  };
}
