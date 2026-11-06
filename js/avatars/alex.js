// Realistic Male Humanoid Avatar (Alex - Ready Player Me Model)
import * as THREE from 'three';
import { rig, bindBonesFromHierarchy } from './rig.js';
import { loadGLBAvatar } from './loader.js';

export function buildAlexHumanoid(avatarGroup) {
  rig.isFloating = false;
  const root = new THREE.Group();
  avatarGroup.add(root);
  rig.root = root;

  // Build temporary high-res placeholder while GLB loads
  const placeholder = buildProceduralAlex();
  root.add(placeholder);

  // Load realistic photorealistic Ready Player Me humanoid model
  loadGLBAvatar('assets/models/alex.glb').then(({ scene, animations }) => {
    // If user hasn't switched away from Alex
    if (rig.root === root) {
      root.remove(placeholder);

      scene.position.set(0, 0, 0);
      scene.scale.setScalar(0.92);
      root.add(scene);

      bindBonesFromHierarchy(scene);

      if (animations && animations.length > 0) {
        const mixer = new THREE.AnimationMixer(scene);
        const action = mixer.clipAction(animations[0]);
        action.play();
        rig.mixer = mixer;
      }
    }
  }).catch((err) => {
    console.warn('GLB Alex load error, keeping procedural avatar:', err);
  });
}

function buildProceduralAlex() {
  const container = new THREE.Group();
  const matSkin = new THREE.MeshStandardMaterial({ color: 0xf5d0b0, roughness: 0.6 });
  const matHair = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
  const matJacket = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.5 });
  const matJeans = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.7 });
  const matShoes = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 });
  const matEyes = new THREE.MeshBasicMaterial({ color: 0x15803d });
  const matLips = new THREE.MeshBasicMaterial({ color: 0xc2410c });

  const hips = new THREE.Group();
  hips.position.set(0, 0.85, 0);
  container.add(hips);
  rig.hips = hips;

  const chest = new THREE.Group();
  const torsoGeo = new THREE.CylinderGeometry(0.19, 0.15, 0.46, 16);
  const torso = new THREE.Mesh(torsoGeo, matJacket);
  torso.position.y = 0.24;
  chest.add(torso);
  hips.add(chest);
  rig.chest = chest;

  const head = new THREE.Group();
  head.position.set(0, 0.56, 0);
  const headGeo = new THREE.SphereGeometry(0.16, 32, 32);
  headGeo.scale(0.92, 1.15, 0.96);
  const headMesh = new THREE.Mesh(headGeo, matSkin);
  head.add(headMesh);

  const hairGeo = new THREE.SphereGeometry(0.17, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.5);
  hairGeo.scale(0.94, 1.18, 0.98);
  const hair = new THREE.Mesh(hairGeo, matHair);
  hair.position.y = 0.04;
  head.add(hair);

  const eyeGeo = new THREE.SphereGeometry(0.026, 16, 16);
  const eyeL = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  eyeL.position.set(-0.05, 0.02, 0.13);
  eyeL.scale.set(1.0, 0.75, 0.5);
  head.add(eyeL);
  rig.eyeLeft = eyeL;

  rig.pupilLeft = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), matEyes);
  rig.pupilLeft.position.set(0, 0, 0.02);
  eyeL.add(rig.pupilLeft);

  const eyeR = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  eyeR.position.set(0.05, 0.02, 0.13);
  eyeR.scale.set(1.0, 0.75, 0.5);
  head.add(eyeR);
  rig.eyeRight = eyeR;

  rig.pupilRight = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), matEyes);
  rig.pupilRight.position.set(0, 0, 0.02);
  eyeR.add(rig.pupilRight);

  const browGeo = new THREE.BoxGeometry(0.05, 0.01, 0.005);
  const browL = new THREE.Mesh(browGeo, matHair);
  browL.position.set(-0.052, 0.07, 0.14);
  browL.rotation.z = -0.06;
  head.add(browL);
  rig.browLeft = browL;

  const browR = new THREE.Mesh(browGeo, matHair);
  browR.position.set(0.052, 0.07, 0.14);
  browR.rotation.z = 0.06;
  head.add(browR);
  rig.browRight = browR;

  const jaw = new THREE.Group();
  jaw.position.set(0, -0.06, 0.07);
  const chin = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.08), matSkin);
  jaw.add(chin);
  head.add(jaw);
  rig.jaw = jaw;

  const lipGeo = new THREE.BoxGeometry(0.06, 0.014, 0.02);
  const lips = new THREE.Mesh(lipGeo, matLips);
  lips.position.set(0, -0.048, 0.148);
  head.add(lips);
  rig.mouth = lips;

  chest.add(head);
  rig.head = head;

  const armGeo = new THREE.CylinderGeometry(0.045, 0.038, 0.3, 12);

  const armL = new THREE.Group();
  armL.position.set(-0.25, 0.42, 0);
  const upperArmL = new THREE.Mesh(armGeo, matJacket);
  upperArmL.position.y = -0.15;
  armL.add(upperArmL);

  const forearmL = new THREE.Group();
  forearmL.position.set(0, -0.3, 0);
  const lowerArmL = new THREE.Mesh(armGeo, matSkin);
  lowerArmL.position.y = -0.15;
  forearmL.add(lowerArmL);

  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.025), matSkin);
  handL.position.y = -0.32;
  forearmL.add(handL);
  armL.add(forearmL);
  chest.add(armL);
  rig.leftArm = armL;
  rig.leftForearm = forearmL;

  const armR = new THREE.Group();
  armR.position.set(0.25, 0.42, 0);
  const upperArmR = new THREE.Mesh(armGeo, matJacket);
  upperArmR.position.y = -0.15;
  armR.add(upperArmR);

  const forearmR = new THREE.Group();
  forearmR.position.set(0, -0.3, 0);
  const lowerArmR = new THREE.Mesh(armGeo, matSkin);
  lowerArmR.position.y = -0.15;
  forearmR.add(lowerArmR);

  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.025), matSkin);
  handR.position.y = -0.32;
  forearmR.add(handR);
  armR.add(forearmR);
  chest.add(armR);
  rig.rightArm = armR;
  rig.rightForearm = forearmR;

  const legGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.44, 12);

  const legL = new THREE.Group();
  legL.position.set(-0.1, 0, 0);
  const thighL = new THREE.Mesh(legGeo, matJeans);
  thighL.position.y = -0.22;
  legL.add(thighL);

  const shinL = new THREE.Mesh(legGeo, matJeans);
  shinL.position.y = -0.66;
  legL.add(shinL);

  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.17), matShoes);
  bootL.position.set(0, -0.88, 0.04);
  legL.add(bootL);
  hips.add(legL);
  rig.leftThigh = legL;

  const legR = new THREE.Group();
  legR.position.set(0.1, 0, 0);
  const thighR = new THREE.Mesh(legGeo, matJeans);
  thighR.position.y = -0.22;
  legR.add(thighR);

  const shinR = new THREE.Mesh(legGeo, matJeans);
  shinR.position.y = -0.66;
  legR.add(shinR);

  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.17), matShoes);
  bootR.position.set(0, -0.88, 0.04);
  legR.add(bootR);
  hips.add(legR);
  rig.rightThigh = legR;

  return container;
}
