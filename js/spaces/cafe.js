// Space 4: Cozy Library Cafe / Coffee Lounge
import * as THREE from 'three';

export function createCafeSpace() {
  const group = new THREE.Group();

  // 1. Herringbone Wood Parquet Flooring
  const floorGeo = new THREE.PlaneGeometry(14, 14);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x5c3a21,
    roughness: 0.45,
    metalness: 0.05
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // 2. Warm Exposed Brick Back Wall
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.9 });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), brickMat);
  backWall.position.set(0, 3.5, -4);
  backWall.receiveShadow = true;
  group.add(backWall);

  // 3. Cafe Window overlooking rainy street
  const winGroup = new THREE.Group();
  winGroup.position.set(2.0, 3.0, -3.95);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5 });
  const winFrame = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.0, 0.1), frameMat);
  winGroup.add(winFrame);

  // Outside Rainy Night Backdrop
  const nightMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
  const nightBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.8), nightMat);
  nightBackdrop.position.z = -0.06;
  winGroup.add(nightBackdrop);

  // Distant warm streetlamps outside
  const streetlampMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  for (let s = 0; s < 3; s++) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), streetlampMat);
    lamp.position.set(-1.0 + s * 1.0, 0.2, -0.05);
    winGroup.add(lamp);
  }

  // Window Glass
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.2,
    roughness: 0.1,
    transmission: 0.8
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.8), glassMat);
  glass.position.z = 0.04;
  winGroup.add(glass);
  group.add(winGroup);

  // 4. Side Bistro Table with Steaming Coffee Cup
  const tableGroup = new THREE.Group();
  tableGroup.position.set(-2.0, 0, -1.5);

  const tableMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.6 });
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 24), tableMat);
  tableTop.position.y = 0.76;
  const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.74, 12), tableMat);
  tableLeg.position.y = 0.37;
  const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 16), tableMat);
  tableBase.position.y = 0.015;
  tableGroup.add(tableTop, tableLeg, tableBase);

  // Ceramic Coffee Mug
  const mugMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 16), mugMat);
  mug.position.set(0.1, 0.83, 0.05);

  const coffeeMat = new THREE.MeshStandardMaterial({ color: 0x3b1d11, roughness: 0.1 });
  const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.01, 16), coffeeMat);
  coffee.position.set(0.1, 0.87, 0.05);
  tableGroup.add(mug, coffee);
  group.add(tableGroup);

  // 5. LIVING DYNAMIC ELEMENTS: Rising Coffee Steam & Window Rain
  // Coffee Steam Particles
  const steamCount = 18;
  const steamGeo = new THREE.BufferGeometry();
  const steamPositions = new Float32Array(steamCount * 3);
  for (let i = 0; i < steamCount; i++) {
    steamPositions[i * 3] = -1.9 + (Math.random() - 0.5) * 0.06;
    steamPositions[i * 3 + 1] = 0.88 + Math.random() * 0.4;
    steamPositions[i * 3 + 2] = -1.45 + (Math.random() - 0.5) * 0.06;
  }
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPositions, 3));
  const steamMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.04,
    transparent: true,
    opacity: 0.45
  });
  const steam = new THREE.Points(steamGeo, steamMat);
  group.add(steam);

  // Rain Drops outside window
  const rainCount = 45;
  const rainGeo = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = 0.6 + Math.random() * 2.8;
    rainPositions[i * 3 + 1] = 1.6 + Math.random() * 2.6;
    rainPositions[i * 3 + 2] = -3.98;
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

  // Warm Edison Bulb Light
  const edisonLight = new THREE.PointLight(0xf59e0b, 1.4, 6);
  edisonLight.position.set(-1.0, 2.8, -1.0);
  group.add(edisonLight);

  return {
    group,
    update(delta, elapsed) {
      // 1. Rising coffee steam
      const sPos = steamGeo.attributes.position.array;
      for (let i = 0; i < steamCount; i++) {
        sPos[i * 3 + 1] += delta * 0.18; // rise
        sPos[i * 3] += Math.sin(elapsed * 3.0 + i) * 0.002;
        if (sPos[i * 3 + 1] > 1.35) {
          sPos[i * 3 + 1] = 0.88;
          sPos[i * 3] = -1.9 + (Math.random() - 0.5) * 0.06;
        }
      }
      steamGeo.attributes.position.needsUpdate = true;

      // 2. Falling rain streaks outside window
      const rPos = rainGeo.attributes.position.array;
      for (let i = 0; i < rainCount; i++) {
        rPos[i * 3 + 1] -= delta * 3.2; // fast fall
        if (rPos[i * 3 + 1] < 1.6) {
          rPos[i * 3 + 1] = 4.2;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;

      // 3. Subtle warm light flicker
      edisonLight.intensity = 1.35 + Math.sin(elapsed * 12) * 0.05;
    }
  };
}
