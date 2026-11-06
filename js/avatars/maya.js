import * as THREE from 'three';
import { rig } from './rig.js';

export function buildMayaHumanoid(avatarGroup) {
  rig.isFloating = false;
  const matSkin = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.6 });
  const matHair = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
  const matJacket = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.5 });
  const matPants = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const matShoes = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const matEyes = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
  const matLips = new THREE.MeshBasicMaterial({ color: 0xe11d48 });

  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  // Pelvis / Hips
  const hips = new THREE.Group();
  hips.position.set(0, 0.82, 0);
  root.add(hips);
  rig.hips = hips;

  // Chest / Spine
  const chest = new THREE.Group();
  const torsoGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.42, 16);
  const torso = new THREE.Mesh(torsoGeo, matJacket);
  torso.position.y = 0.22;
  chest.add(torso);
  hips.add(chest);
  rig.chest = chest;

  // Head & Face
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0);
  const headGeo = new THREE.SphereGeometry(0.15, 32, 32);
  headGeo.scale(0.88, 1.15, 0.95);
  const headMesh = new THREE.Mesh(headGeo, matSkin);
  head.add(headMesh);

  // Hair
  const hairGeo = new THREE.SphereGeometry(0.165, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.6);
  hairGeo.scale(0.92, 1.15, 0.98);
  const hair = new THREE.Mesh(hairGeo, matHair);
  hair.position.y = 0.02;
  head.add(hair);

  const hairBun = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), matHair);
  hairBun.position.set(0, 0.16, -0.1);
  head.add(hairBun);

  // Expressive Human Eyes
  const eyeGeo = new THREE.SphereGeometry(0.026, 16, 16);
  eyeGeo.scale(1.0, 0.75, 0.5);

  rig.eyeLeft = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  rig.eyeLeft.position.set(-0.052, 0.02, 0.135);
  head.add(rig.eyeLeft);

  rig.pupilLeft = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), matEyes);
  rig.pupilLeft.position.set(-0.052, 0.02, 0.146);
  head.add(rig.pupilLeft);

  rig.eyeRight = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  rig.eyeRight.position.set(0.052, 0.02, 0.135);
  head.add(rig.eyeRight);

  rig.pupilRight = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), matEyes);
  rig.pupilRight.position.set(0.052, 0.02, 0.146);
  head.add(rig.pupilRight);

  // Brows
  const browGeo = new THREE.BoxGeometry(0.045, 0.008, 0.005);
  rig.browLeft = new THREE.Mesh(browGeo, matHair);
  rig.browLeft.position.set(-0.052, 0.065, 0.138);
  head.add(rig.browLeft);

  rig.browRight = new THREE.Mesh(browGeo, matHair);
  rig.browRight.position.set(0.052, 0.065, 0.138);
  head.add(rig.browRight);

  // Articulated Lower Jaw & Lips
  const jawGroup = new THREE.Group();
  jawGroup.position.set(0, -0.06, 0.08);

  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matSkin);
  chin.scale.set(0.85, 0.8, 0.9);
  chin.position.set(0, -0.03, 0.04);
  jawGroup.add(chin);

  const lipGeo = new THREE.BoxGeometry(0.055, 0.016, 0.02);
  rig.mouth = new THREE.Mesh(lipGeo, matLips);
  rig.mouth.position.set(0, 0, 0.065);
  jawGroup.add(rig.mouth);

  head.add(jawGroup);
  rig.jaw = jawGroup;

  chest.add(head);
  rig.head = head;

  // Full Articulated Human Arms
  const armGeo = new THREE.CylinderGeometry(0.038, 0.032, 0.28, 12);

  // Left Arm
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.19, 0.38, 0);
  const upperL = new THREE.Mesh(armGeo, matJacket);
  upperL.position.y = -0.14;
  leftArm.add(upperL);

  const leftFore = new THREE.Group();
  leftFore.position.set(0, -0.28, 0);
  const lowerL = new THREE.Mesh(armGeo, matSkin);
  lowerL.position.y = -0.13;
  leftFore.add(lowerL);

  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), matSkin);
  handL.position.y = -0.28;
  leftFore.add(handL);
  leftArm.add(leftFore);
  chest.add(leftArm);
  rig.leftArm = leftArm;
  rig.leftForearm = leftFore;

  // Right Arm
  const rightArm = new THREE.Group();
  rightArm.position.set(0.19, 0.38, 0);
  const upperR = new THREE.Mesh(armGeo, matJacket);
  upperR.position.y = -0.14;
  rightArm.add(upperR);

  const rightFore = new THREE.Group();
  rightFore.position.set(0, -0.28, 0);
  const lowerR = new THREE.Mesh(armGeo, matSkin);
  lowerR.position.y = -0.13;
  rightFore.add(lowerR);

  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), matSkin);
  handR.position.y = -0.28;
  rightFore.add(handR);
  rightArm.add(rightFore);
  chest.add(rightArm);
  rig.rightArm = rightArm;
  rig.rightForearm = rightFore;

  // Human Legs
  const legGeo = new THREE.CylinderGeometry(0.052, 0.042, 0.42, 12);
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.09, 0, 0);
  const thighL = new THREE.Mesh(legGeo, matPants);
  thighL.position.y = -0.21;
  leftLeg.add(thighL);

  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.15), matShoes);
  bootL.position.set(0, -0.44, 0.03);
  leftLeg.add(bootL);
  hips.add(leftLeg);
  rig.leftThigh = leftLeg;

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.09, 0, 0);
  const thighR = new THREE.Mesh(legGeo, matPants);
  thighR.position.y = -0.21;
  rightLeg.add(thighR);

  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.15), matShoes);
  bootR.position.set(0, -0.44, 0.03);
  rightLeg.add(bootR);
  hips.add(rightLeg);
  rig.rightThigh = rightLeg;

  avatarGroup.add(root);
  rig.root = root;
}
