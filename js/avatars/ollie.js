import * as THREE from 'three';
import { rig } from './rig.js';

export function buildOllieBot(avatarGroup) {
  rig.isFloating = false;
  const matFur = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.6 }); // Emerald green alien/creature
  const matBelly = new THREE.MeshStandardMaterial({ color: 0xa7f3d0, roughness: 0.5 });
  const matHoodie = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.5 }); // Purple hoodie
  const matEyes = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const matPupils = new THREE.MeshBasicMaterial({ color: 0x1e1b4b });
  const matLips = new THREE.MeshBasicMaterial({ color: 0x064e3b });

  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  // Torso / Belly
  const chest = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(0.26, 24, 24);
  bodyGeo.scale(1.05, 1.15, 0.95);
  const torso = new THREE.Mesh(bodyGeo, matHoodie);
  torso.position.y = 0.82;
  chest.add(torso);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), matBelly);
  belly.position.set(0, 0.8, 0.12);
  belly.scale.set(1.0, 1.1, 0.4);
  chest.add(belly);
  root.add(chest);
  rig.chest = chest;

  // Head
  const head = new THREE.Group();
  head.position.set(0, 1.22, 0);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), matFur);
  headMesh.scale.set(1.1, 1.0, 1.05);
  head.add(headMesh);

  // Big Playful Antennae on head
  const antGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.16, 8);
  const antL = new THREE.Mesh(antGeo, matFur);
  antL.position.set(-0.11, 0.26, 0);
  antL.rotation.z = 0.3;
  head.add(antL);
  const antTipL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), matBelly);
  antTipL.position.y = 0.08;
  antL.add(antTipL);

  const antR = new THREE.Mesh(antGeo, matFur);
  antR.position.set(0.11, 0.26, 0);
  antR.rotation.z = -0.3;
  head.add(antR);
  const antTipR = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), matBelly);
  antTipR.position.y = 0.08;
  antR.add(antTipR);

  // Huge Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), matEyes);
  eyeL.position.set(-0.08, 0.04, 0.21);
  eyeL.scale.set(1.0, 1.15, 0.5);
  head.add(eyeL);
  rig.eyeLeft = eyeL;

  const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 16), matPupils);
  pupilL.position.set(-0.08, 0.04, 0.24);
  head.add(pupilL);
  rig.pupilLeft = pupilL;

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), matEyes);
  eyeR.position.set(0.08, 0.04, 0.21);
  eyeR.scale.set(1.0, 1.15, 0.5);
  head.add(eyeR);
  rig.eyeRight = eyeR;

  const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 16), matPupils);
  pupilR.position.set(0.08, 0.04, 0.24);
  head.add(pupilR);
  rig.pupilRight = pupilR;

  // Mouth & Lower Jaw
  const jawGroup = new THREE.Group();
  jawGroup.position.set(0, -0.09, 0.18);
  const mouthGeo = new THREE.BoxGeometry(0.09, 0.02, 0.02);
  rig.mouth = new THREE.Mesh(mouthGeo, matLips);
  jawGroup.add(rig.mouth);
  head.add(jawGroup);
  rig.jaw = jawGroup;

  root.add(head);
  rig.head = head;

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.26, 12);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.28, 0.92, 0);
  const upperL = new THREE.Mesh(armGeo, matHoodie);
  upperL.position.y = -0.13;
  leftArm.add(upperL);

  const leftFore = new THREE.Group();
  leftFore.position.set(0, -0.26, 0);
  const pawL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), matFur);
  pawL.position.y = -0.05;
  leftFore.add(pawL);
  leftArm.add(leftFore);
  chest.add(leftArm);
  rig.leftArm = leftArm;
  rig.leftForearm = leftFore;

  const rightArm = new THREE.Group();
  rightArm.position.set(0.28, 0.92, 0);
  const upperR = new THREE.Mesh(armGeo, matHoodie);
  upperR.position.y = -0.13;
  rightArm.add(upperR);

  const rightFore = new THREE.Group();
  rightFore.position.set(0, -0.26, 0);
  const pawR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), matFur);
  pawR.position.y = -0.05;
  rightFore.add(pawR);
  rightArm.add(rightFore);
  chest.add(rightArm);
  rig.rightArm = rightArm;
  rig.rightForearm = rightFore;

  // Legs & Feet
  const legGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.36, 12);
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.12, 0.6, 0);
  const lMesh = new THREE.Mesh(legGeo, matHoodie);
  lMesh.position.y = -0.18;
  leftLeg.add(lMesh);
  const footL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), matFur);
  footL.scale.set(1.0, 0.6, 1.5);
  footL.position.set(0, -0.36, 0.04);
  leftLeg.add(footL);
  root.add(leftLeg);
  rig.leftThigh = leftLeg;

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.12, 0.6, 0);
  const rMesh = new THREE.Mesh(legGeo, matHoodie);
  rMesh.position.y = -0.18;
  rightLeg.add(rMesh);
  const footR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), matFur);
  footR.scale.set(1.0, 0.6, 1.5);
  footR.position.set(0, -0.36, 0.04);
  rightLeg.add(footR);
  root.add(rightLeg);
  rig.rightThigh = rightLeg;

  avatarGroup.add(root);
  rig.root = root;
}
