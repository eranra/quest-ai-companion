// Space 3: Sky Penthouse / Cyber Skyline (360° Photorealistic Environment)
import * as THREE from 'three';

export function createPenthouseSpace() {
  const group = new THREE.Group();

  // 1. 360° Photorealistic Equirectangular Spherical Panorama
  const sphereGeo = new THREE.SphereGeometry(35, 60, 40);
  sphereGeo.scale(-1, 1, 1);
  const texLoader = new THREE.TextureLoader();
  const panoTexture = texLoader.load('assets/spaces/penthouse.jpg');
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

  // 3. Twilight Mood Lighting
  const ambientLight = new THREE.AmbientLight(0x1e1b4b, 1.4);
  const cityGlow = new THREE.DirectionalLight(0x38bdf8, 1.2);
  cityGlow.position.set(-3, 5, -2);
  const neonPurple = new THREE.PointLight(0xa855f7, 1.4, 10);
  neonPurple.position.set(2, 3, 1);
  const neonCyan = new THREE.PointLight(0x06b6d4, 1.1, 10);
  neonCyan.position.set(-2, 2.5, 0);
  group.add(ambientLight, cityGlow, neonPurple, neonCyan);

  // 4. Dynamic Living Elements:
  // Animated Aerial Skycars / Cruising City Traffic in the distance
  const skycars = [];
  const carCount = 5;

  for (let i = 0; i < carCount; i++) {
    const carGroup = new THREE.Group();
    const isEast = i % 2 === 0;

    // Streamlined craft body
    const carMat = new THREE.MeshBasicMaterial({
      color: isEast ? 0x38bdf8 : 0xf43f5e
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.1), carMat);
    carGroup.add(body);

    // Glowing headlight / trail
    const lightMat = new THREE.MeshBasicMaterial({
      color: isEast ? 0x67e8f9 : 0xfb7185
    });
    const headLight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.04), lightMat);
    headLight.position.x = isEast ? 0.16 : -0.16;
    carGroup.add(headLight);

    const laneY = 2.2 + (i * 0.45);
    const laneZ = -7.5 - (i * 0.8);
    carGroup.position.set((Math.random() - 0.5) * 14, laneY, laneZ);

    group.add(carGroup);
    skycars.push({
      group: carGroup,
      speed: (isEast ? 1.5 : -1.8) * (0.8 + Math.random() * 0.4),
      laneY,
      isEast
    });
  }

  return {
    group,
    update(delta, elapsed) {
      // Animate flying skycars along aerial lanes
      skycars.forEach(car => {
        car.group.position.x += delta * car.speed;
        car.group.position.y = car.laneY + Math.sin(elapsed * 2.5 + car.group.position.x) * 0.03;

        if (car.isEast && car.group.position.x > 11) {
          car.group.position.x = -11;
        } else if (!car.isEast && car.group.position.x < -11) {
          car.group.position.x = 11;
        }
      });

      // Subtle pulse on city neon
      neonPurple.intensity = 1.3 + Math.sin(elapsed * 2.0) * 0.15;
      neonCyan.intensity = 1.1 + Math.cos(elapsed * 2.5) * 0.12;
    }
  };
}
