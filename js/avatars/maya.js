// Realistic Female Humanoid Avatar (Maya)
import * as THREE from 'three';
import { rig, bindBonesFromHierarchy } from './rig.js';
import { loadGLBAvatar } from './loader.js';

export function buildMayaHumanoid(avatarGroup) {
  rig.isFloating = false;
  const root = new THREE.Group();
  avatarGroup.add(root);
  rig.root = root;

  // Build temporary high-res placeholder while GLB loads
  const placeholder = buildProceduralMaya();
  root.add(placeholder);

  // Load realistic photorealistic GLB humanoid model
  loadGLBAvatar('assets/models/maya.glb').then(({ scene, animations }) => {
    // If user hasn't switched away from Maya
    if (rig.root === root) {
      root.remove(placeholder);
      
      scene.position.set(0, -0.15, 0);
      scene.scale.setScalar(0.85);
      root.add(scene);

      bindBonesFromHierarchy(scene);

      // Only play subtle idle animations, never wild dance clips
      if (animations && animations.length > 0) {
        const idleClip = animations.find(a => a.name.toLowerCase().includes('idle') || a.name.toLowerCase().includes('breath'));
        if (idleClip) {
          const mixer = new THREE.AnimationMixer(scene);
          const action = mixer.clipAction(idleClip);
          action.play();
          rig.mixer = mixer;
        }
      }
    }
  }).catch((err) => {
    console.warn('GLB Maya load error, keeping procedural avatar:', err);
  });
}

function buildProceduralMaya() {
  const container = new THREE.Group();
  const matSkin = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.6 });
  const matHair = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
  const matJacket = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.5 });
  const matPants = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const matShoes = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const matEyes = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
  const matLips = new THREE.MeshBasicMaterial({ color: 0xe11d48 });

  const hips = new THREE.Group();
  hips.position.set(0, 0.82, 0);
  container.add(hips);
  rig.hips = hips;

  const chest = new THREE.Group();
  const torsoGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.42, 16);
  const torso = new THREE.Mesh(torsoGeo, matJacket);
  torso.position.y = 0.22;
  chest.add(torso);
  hips.add(chest);
  rig.chest = chest;

  const head = new THREE.Group();
  head.position.set(0, 0.52, 0);
  const headGeo = new THREE.SphereGeometry(0.15, 32, 32);
  headGeo.scale(0.88, 1.15, 0.95);
  const headMesh = new THREE.Mesh(headGeo, matSkin);
  head.add(headMesh);

  const hairGeo = new THREE.SphereGeometry(0.165, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.6);
  hairGeo.scale(0.92, 1.15, 0.98);
  const hair = new THREE.Mesh(hairGeo, matHair);
  hair.position.y = 0.02;
  head.add(hair);

  const hairBun = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), matHair);
  hairBun.position.set(0, 0.16, -0.1);
  head.add(hairBun);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.026, 16, 16);
  const eyeL = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  eyeL.position.set(-0.048, 0.02, 0.125);
  eyeL.scale.set(1.0, 0.75, 0.5);
  head.add(eyeL);
  rig.eyeLeft = eyeL;

  rig.pupilLeft = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), matEyes);
  rig.pupilLeft.position.set(0, 0, 0.02);
  eyeL.add(rig.pupilLeft);

  const eyeR = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  eyeR.position.set(0.048, 0.02, 0.125);
  eyeR.scale.set(1.0, 0.75, 0.5);
  head.add(eyeR);
  rig.eyeRight = eyeR;

  rig.pupilRight = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), matEyes);
  rig.pupilRight.position.set(0, 0, 0.02);
  eyeR.add(rig.pupilRight);

  // Eyebrows
  const browGeo = new THREE.BoxGeometry(0.045, 0.008, 0.005);
  const browL = new THREE.Mesh(browGeo, matHair);
  browL.position.set(-0.05, 0.065, 0.135);
  browL.rotation.z = -0.05;
  head.add(browL);
  rig.browLeft = browL;

  const browR = new THREE.Mesh(browGeo, matHair);
  browR.position.set(0.05, 0.065, 0.135);
  browR.rotation.z = 0.05;
  head.add(browR);
  rig.browRight = browR;

  // Chin & Jaw
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.06, 0.06);
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matSkin);
  chin.scale.set(0.9, 0.6, 0.9);
  jaw.add(chin);
  head.add(jaw);
  rig.jaw = jaw;

  const lipGeo = new THREE.BoxGeometry(0.055, 0.016, 0.02);
  const lips = new THREE.Mesh(lipGeo, matLips);
  lips.position.set(0, -0.045, 0.14);
  head.add(lips);
  rig.mouth = lips;

  chest.add(head);
  rig.head = head;

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.038, 0.032, 0.28, 12);

  const armL = new THREE.Group();
  armL.position.set(-0.21, 0.38, 0);
  const upperArmL = new THREE.Mesh(armGeo, matJacket);
  upperArmL.position.y = -0.14;
  armL.add(upperArmL);

  const forearmL = new THREE.Group();
  forearmL.position.set(0, -0.28, 0);
  const lowerArmL = new THREE.Mesh(armGeo, matSkin);
  lowerArmL.position.y = -0.14;
  forearmL.add(lowerArmL);

  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), matSkin);
  handL.position.y = -0.3;
  forearmL.add(handL);
  armL.add(forearmL);
  chest.add(armL);
  rig.leftArm = armL;
  rig.leftForearm = forearmL;

  const armR = new THREE.Group();
  armR.position.set(0.21, 0.38, 0);
  const upperArmR = new THREE.Mesh(armGeo, matJacket);
  upperArmR.position.y = -0.14;
  armR.add(upperArmR);

  const forearmR = new THREE.Group();
  forearmR.position.set(0, -0.28, 0);
  const lowerArmR = new THREE.Mesh(armGeo, matSkin);
  lowerArmR.position.y = -0.14;
  forearmR.add(lowerArmR);

  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), matSkin);
  handR.position.y = -0.3;
  forearmR.add(handR);
  armR.add(forearmR);
  chest.add(armR);
  rig.rightArm = armR;
  rig.rightForearm = forearmR;

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.052, 0.042, 0.42, 12);

  const legL = new THREE.Group();
  legL.position.set(-0.09, 0, 0);
  const thighL = new THREE.Mesh(legGeo, matPants);
  thighL.position.y = -0.21;
  legL.add(thighL);

  const shinL = new THREE.Mesh(legGeo, matPants);
  shinL.position.y = -0.63;
  legL.add(shinL);

  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.15), matShoes);
  bootL.position.set(0, -0.84, 0.03);
  legL.add(bootL);
  hips.add(legL);
  rig.leftThigh = legL;

  const legR = new THREE.Group();
  legR.position.set(0.09, 0, 0);
  const thighR = new THREE.Mesh(legGeo, matPants);
  thighR.position.y = -0.21;
  legR.add(thighR);

  const shinR = new THREE.Mesh(legGeo, matPants);
  shinR.position.y = -0.63;
  legR.add(shinR);

  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.15), matShoes);
  bootR.position.set(0, -0.84, 0.03);
  legR.add(bootR);
  hips.add(legR);
  rig.rightThigh = legR;

  return container;
}
