// Space 1: Modern Study Hall / Academic Forum (Default Environment)
import * as THREE from 'three';

export function createStudyHallSpace() {
  const group = new THREE.Group();
  const dynamicObjects = [];

  // 1. Warm Hardwood Plank Flooring
  const floorGeo = new THREE.PlaneGeometry(14, 14);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x8b5a2b,
    roughness: 0.35,
    metalness: 0.08
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  group.add(floor);

  // Subtle floor plank grid lines for wood parquet feel
  const plankGrid = new THREE.GridHelper(14, 28, 0x5c3a1e, 0x704214);
  plankGrid.position.y = 0.002;
  group.add(plankGrid);

  // 2. Back Architectural Wall with Wainscoting
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
  const woodPanelMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.5 });

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), wallMat);
  backWall.position.set(0, 3.5, -4);
  backWall.receiveShadow = true;
  group.add(backWall);

  // Lower Wood Wainscoting Panel
  const wainscot = new THREE.Mesh(new THREE.BoxGeometry(14, 1.4, 0.06), woodPanelMat);
  wainscot.position.set(0, 0.7, -3.96);
  group.add(wainscot);

  // Chair Rail Trim
  const chairRail = new THREE.Mesh(new THREE.BoxGeometry(14, 0.08, 0.1), trimMat);
  chairRail.position.set(0, 1.44, -3.94);
  group.add(chairRail);

  // 3. Bookshelves on Left & Right
  function createBookshelf(x) {
    const shelfGroup = new THREE.Group();
    shelfGroup.position.set(x, 0, -3.8);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.8, 0.45), frameMat);
    frame.position.y = 1.9;
    shelfGroup.add(frame);

    // Book rows with varied colors
    const bookColors = [0x991b1b, 0x1e3a8a, 0x065f46, 0x854d0e, 0x4c1d95, 0xd97706];
    for (let r = 0; r < 4; r++) {
      const shelfY = 0.8 + r * 0.75;
      for (let b = 0; b < 9; b++) {
        const bHeight = 0.32 + Math.sin(b * 1.5 + r) * 0.06;
        const bMat = new THREE.MeshStandardMaterial({
          color: bookColors[(b + r * 3) % bookColors.length],
          roughness: 0.6
        });
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.12, bHeight, 0.3), bMat);
        book.position.set(-0.6 + b * 0.15, shelfY + bHeight / 2, 0.05);
        shelfGroup.add(book);
      }
    }
    return shelfGroup;
  }

  group.add(createBookshelf(-4.2));
  group.add(createBookshelf(4.2));

  // 4. Large Panoramic Courtyard Windows
  function createWindow(x) {
    const winGroup = new THREE.Group();
    winGroup.position.set(x, 3.2, -3.95);

    // Window Frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.08), frameMat);
    winGroup.add(frame);

    // Sky & Courtyard Backdrop behind glass
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.0), skyMat);
    sky.position.z = -0.05;
    winGroup.add(sky);

    // Distant Green Campus Hill
    const hillMat = new THREE.MeshBasicMaterial({ color: 0x15803d });
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 8, 0, Math.PI), hillMat);
    hill.rotation.x = Math.PI / 2;
    hill.position.set(0.3, -0.6, -0.04);
    winGroup.add(hill);

    // Glass pane with subtle reflection
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      roughness: 0.1,
      transmission: 0.85
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.0), glassMat);
    glass.position.z = 0.04;
    winGroup.add(glass);

    // Window Mullions (cross bars)
    const mullionMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const mullH = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.09), mullionMat);
    const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.0, 0.09), mullionMat);
    winGroup.add(mullH);
    winGroup.add(mullV);

    return winGroup;
  }

  group.add(createWindow(-1.8));
  group.add(createWindow(1.8));

  // 5. LIVING DYNAMIC ELEMENTS: Drifting Clouds & Flying Birds
  // Clouds behind windows
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 3; i++) {
    const cloud = new THREE.Group();
    const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), cloudMat);
    const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), cloudMat);
    c2.position.set(0.2, -0.05, 0);
    const c3 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), cloudMat);
    c3.position.set(-0.18, -0.06, 0);
    cloud.add(c1, c2, c3);
    cloud.position.set(-3 + i * 2.5, 3.8 + (i % 2) * 0.4, -4.0);
    cloud.scale.setScalar(0.7 + i * 0.2);
    group.add(cloud);
    clouds.push(cloud);
  }

  // Flying Birds outside the windows
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, side: THREE.DoubleSide });
  const birds = [];
  for (let i = 0; i < 2; i++) {
    const bird = new THREE.Group();
    const wingGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      -0.08, 0, 0,
      0, 0, -0.03,
      0.08, 0, 0
    ]);
    wingGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const mesh = new THREE.Mesh(wingGeo, birdMat);
    bird.add(mesh);
    bird.position.set(-2.5 + i * 3.0, 3.4 + i * 0.5, -3.99);
    group.add(bird);
    birds.push({ group: bird, speed: 0.35 + i * 0.15, flapOffset: i * 2.0 });
  }

  // 6. Floating Sunlight Dust Motes (Subtle Living Ambiance)
  const moteCount = 25;
  const moteGeo = new THREE.BufferGeometry();
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePositions[i * 3] = (Math.random() - 0.5) * 5.0;
    motePositions[i * 3 + 1] = 0.5 + Math.random() * 2.8;
    motePositions[i * 3 + 2] = -1.0 + (Math.random() - 0.5) * 4.0;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xfef08a,
    size: 0.03,
    transparent: true,
    opacity: 0.65
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  group.add(motes);

  // Warm Ambient Light from Windows & Chandelier
  const studyLight = new THREE.PointLight(0xffedd5, 1.2, 10);
  studyLight.position.set(0, 3.2, 0);
  group.add(studyLight);

  return {
    group,
    update(delta, elapsed) {
      // 1. Drift clouds across the windows
      clouds.forEach((c, idx) => {
        c.position.x += delta * (0.08 + idx * 0.02);
        if (c.position.x > 3.8) c.position.x = -3.8;
      });

      // 2. Animate flying birds
      birds.forEach(b => {
        b.group.position.x += delta * b.speed;
        b.group.position.y += Math.sin(elapsed * 2.0 + b.flapOffset) * 0.003;
        // Wing flap
        b.group.children[0].rotation.z = Math.sin(elapsed * 8.0 + b.flapOffset) * 0.4;
        if (b.group.position.x > 3.6) b.group.position.x = -3.6;
      });

      // 3. Gentle floating dust motes in sunbeam
      const pos = moteGeo.attributes.position.array;
      for (let i = 0; i < moteCount; i++) {
        pos[i * 3 + 1] += Math.sin(elapsed * 0.8 + i) * 0.002;
        pos[i * 3] += Math.cos(elapsed * 0.5 + i) * 0.001;
      }
      moteGeo.attributes.position.needsUpdate = true;
    }
  };
}
