import * as THREE from 'three';
import { rig } from './rig.js';

export function buildAlexHumanoid(avatarGroup) {
  rig.isFloating = false;
  const matSkin = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.6 });
  const matHair = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
  const matShirt = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.6 });
  const matPants = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
  const matShoes = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 });
  const matEyes = new THREE.MeshBasicMaterial({ color: 0x15803d });
  const matLips = new THREE.MeshBasicMaterial({ color: 0xb91c1c });

  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  const hips = new THREE.Group();
  hips.position.set(0, 0.85, 0);
  root.add(hips);
  rig.hips = hips;

  // Athletic Torso
  const chest = new THREE.Group();
  const torsoGeo = new THREE.CylinderGeometry(0.19, 0.15, 0.46, 16);
  const torso = new THREE.Mesh(torsoGeo, matShirt);
  torso.position.y = 0.23;
  chest.add(torso);
  hips.add(chest);
  rig.chest = chest;

  // Head & Face
  const head = new THREE.Group();
  head.position.set(0, 0.54, 0);
  const headGeo = new THREE.SphereGeometry(0.16, 32, 32);
  headGeo.scale(0.9, 1.15, 0.95);
  const headMesh = new THREE.Mesh(headGeo, matSkin);
  head.add(headMesh);

  // Short Styled Hair
  const hairGeo = new THREE.SphereGeometry(0.17, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.5);
  hairGeo.scale(0.95, 1.15, 1.0);
  const hair = new THREE.Mesh(hairGeo, matHair);
  hair.position.y = 0.04;
  head.add(hair);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.026, 16, 16);
  eyeGeo.scale(1.0, 0.7, 0.5);

  rig.eyeLeft = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  rig.eyeLeft.position.set(-0.054, 0.02, 0.14);
  head.add(rig.eyeLeft);

  rig.pupilLeft = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), matEyes);
  rig.pupilLeft.position.set(-0.054, 0.02, 0.15);
  head.add(rig.pupilLeft);

  rig.eyeRight = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  rig.eyeRight.position.set(0.054, 0.02, 0.14);
  head.add(rig.eyeRight);

  rig.pupilRight = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), matEyes);
  rig.pupilRight.position.set(0.054, 0.02, 0.15);
  head.add(rig.pupilRight);

  // Strong Eyebrows
  const browGeo = new THREE.BoxGeometry(0.05, 0.01, 0.005);
  rig.browLeft = new THREE.Mesh(browGeo, matHair);
  rig.browLeft.position.set(-0.054, 0.065, 0.145);
  head.add(rig.browLeft);

  rig.browRight = new THREE.Mesh(browGeo, matHair);
  rig.browRight.position.set(0.054, 0.065, 0.145);
  head.add(rig.browRight);

  // Articulated Male Jaw & Chin
  const jawGroup = new THREE.Group();
  jawGroup.position.set(0, -0.06, 0.08);

  const chin = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.08), matSkin);
  chin.position.set(0, -0.03, 0.04);
  jawGroup.add(chin);

  const lipGeo = new THREE.BoxGeometry(0.06, 0.014, 0.02);
  rig.mouth = new THREE.Mesh(lipGeo, matLips);
  rig.mouth.position.set(0, 0, 0.07);
  jawGroup.add(rig.mouth);

  head.add(jawGroup);
  rig.jaw = jawGroup;

  chest.add(head);
  rig.head = head;

  // Full Articulated Male Arms
  const armGeo = new THREE.CylinderGeometry(0.045, 0.038, 0.3, 12);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.23, 0.4, 0);
  const upperL = new THREE.Mesh(armGeo, matShirt);
  upperL.position.y = -0.15;
  leftArm.add(upperL);

  const leftFore = new THREE.Group();
  leftFore.position.set(0, -0.3, 0);
  const lowerL = new THREE.Mesh(armGeo, matSkin);
  lowerL.position.y = -0.14;
  leftFore.add(lowerL);

  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.025), matSkin);
  handL.position.y = -0.3;
  leftFore.add(handL);
  leftArm.add(leftFore);
  chest.add(leftArm);
  rig.leftArm = leftArm;
  rig.leftForearm = leftFore;

  const rightArm = new THREE.Group();
  rightArm.position.set(0.23, 0.4, 0);
  const upperR = new THREE.Mesh(armGeo, matShirt);
  upperR.position.y = -0.15;
  rightArm.add(upperR);

  const rightFore = new THREE.Group();
  rightFore.position.set(0, -0.3, 0);
  const lowerR = new THREE.Mesh(armGeo, matSkin);
  lowerR.position.y = -0.14;
  rightFore.add(lowerR);

  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.025), matSkin);
  handR.position.y = -0.3;
  rightFore.add(handR);
  rightArm.add(rightFore);
  chest.add(rightArm);
  rig.rightArm = rightArm;
  rig.rightForearm = rightFore;

  // Legs & Boots
  const legGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.44, 12);
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.1, 0, 0);
  const thighL = new THREE.Mesh(legGeo, matPants);
  thighL.position.y = -0.22;
  leftLeg.add(thighL);

  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.17), matShoes);
  bootL.position.set(0, -0.46, 0.04);
  leftLeg.add(bootL);
  hips.add(leftLeg);
  rig.leftThigh = leftLeg;

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.1, 0, 0);
  const thighR = new THREE.Mesh(legGeo, matPants);
  thighR.position.y = -0.22;
  rightLeg.add(thighR);

  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.17), matShoes);
  bootR.position.set(0, -0.46, 0.04);
  rightLeg.add(bootR);
  hips.add(rightLeg);
  rig.rightThigh = rightLeg;

  avatarGroup.add(root);
  rig.root = root;
}
