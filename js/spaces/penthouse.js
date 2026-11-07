// Space 3: Sky Penthouse / Cyberpunk Horizon (High-Tech Lounge)
import * as THREE from 'three';

export function createPenthouseSpace() {
  const group = new THREE.Group();

  // 1. Polished Reflective Dark Marble Floor
  const floorGeo = new THREE.PlaneGeometry(16, 16);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.15,
    metalness: 0.8
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Subtle interior floor edge lights
  const edgeLightMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
  const edgeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 10), edgeLightMat);
  edgeL.position.set(-3.5, 0.01, 0);
  const edgeR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 10), edgeLightMat);
  edgeR.position.set(3.5, 0.01, 0);
  group.add(edgeL, edgeR);

  // 2. High-Tech Panoramic Glass Window Wall & Pillars
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.7 });
  const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 0.3), pillarMat);
  pillarL.position.set(-3.2, 3.5, -3.8);
  const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 0.3), pillarMat);
  pillarR.position.set(3.2, 3.5, -3.8);
  group.add(pillarL, pillarR);

  // Ceiling
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), pillarMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 6.0, 0);
  group.add(ceiling);

  // 3. Cyberpunk City Skyline Outside Window
  const nightSkyMat = new THREE.MeshBasicMaterial({ color: 0x030712 });
  const nightSky = new THREE.Mesh(new THREE.PlaneGeometry(24, 12), nightSkyMat);
  nightSky.position.set(0, 5, -8.0);
  group.add(nightSky);

  // City skyscrapers with window lights
  const bldgColors = [0x0f172a, 0x1e1b4b, 0x172554, 0x111827];
  const bldgMatCache = bldgColors.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));

  for (let i = -7; i <= 7; i += 1.8) {
    const height = 4.0 + Math.abs(Math.sin(i * 2.3)) * 4.5;
    const width = 1.0 + Math.random() * 0.8;
    const mat = bldgMatCache[Math.abs(Math.round(i)) % bldgMatCache.length];
    const bldg = new THREE.Mesh(new THREE.BoxGeometry(width, height, 1.2), mat);
    bldg.position.set(i * 1.4, height / 2 - 1.0, -7.5 + Math.random() * 1.5);
    group.add(bldg);

    // Glowing rooftop antenna beacon
    const beaconMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xef4444 : 0x06b6d4
    });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), beaconMat);
    beacon.position.set(bldg.position.x, height - 0.9, bldg.position.z);
    group.add(beacon);
  }

  // 4. LIVING DYNAMIC ELEMENTS: Flying Skycars / Aerocars along Sky-lanes
  const skycars = [];
  for (let c = 0; c < 6; c++) {
    const carGroup = new THREE.Group();
    const isEastbound = c % 2 === 0;

    // Sleek vehicle chassis
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isEastbound ? 0x38bdf8 : 0xf43f5e,
      roughness: 0.3,
      metalness: 0.8
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.18), bodyMat);
    carGroup.add(body);

    // Headlights & Taillights
    const lightMat = new THREE.MeshBasicMaterial({
      color: isEastbound ? 0x67e8f9 : 0xf43f5e
    });
    const beam = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), lightMat);
    beam.position.set(isEastbound ? 0.22 : -0.22, 0, 0);
    carGroup.add(beam);

    const laneY = 1.8 + (c * 0.7);
    const laneZ = -5.5 - (c * 0.4);
    const startX = -10 + (c * 3.5);

    carGroup.position.set(startX, laneY, laneZ);
    group.add(carGroup);

    skycars.push({
      group: carGroup,
      speed: (isEastbound ? 1.8 : -2.2) + Math.random() * 0.4,
      isEast: isEastbound,
      laneY,
      laneZ
    });
  }

  // Interior Ambient Lights (Cyan & Purple Neon Ambiance)
  const neonCyan = new THREE.PointLight(0x06b6d4, 1.4, 8);
  neonCyan.position.set(-2.5, 3.5, 0);
  const neonPurple = new THREE.PointLight(0xa855f7, 1.2, 8);
  neonPurple.position.set(2.5, 3.5, 0);
  group.add(neonCyan, neonPurple);

  return {
    group,
    update(delta, elapsed) {
      // Animate flying skycars along aerial lanes
      skycars.forEach(car => {
        car.group.position.x += delta * car.speed;
        // Subtle hover altitude bob
        car.group.position.y = car.laneY + Math.sin(elapsed * 3.0 + car.group.position.x) * 0.04;

        if (car.isEast && car.group.position.x > 11) {
          car.group.position.x = -11;
        } else if (!car.isEast && car.group.position.x < -11) {
          car.group.position.x = 11;
        }
      });
    }
  };
}
