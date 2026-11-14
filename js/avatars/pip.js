import * as THREE from 'three';
import { rig, groundAvatar } from './rig.js';

export function buildPipCartoon(avatarGroup) {
  rig.isFloating = false;
  const matBody = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 }); // Bright electric blue
  const matFace = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 }); // Warm skin
  const matCap = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 });  // Red cap
  const matShoes = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }); // White sneakers
  const matEyeBlack = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const matEyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const matMouth = new THREE.MeshBasicMaterial({ color: 0xb91c1c });

  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  // Torso / Body (Chubby cute cartoon character)
  const chest = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(0.25, 24, 24);
  bodyGeo.scale(1.0, 1.2, 0.9);
  const bodyMesh = new THREE.Mesh(bodyGeo, matBody);
  bodyMesh.position.y = 0.85;
  chest.add(bodyMesh);
  root.add(chest);
  rig.chest = chest;

  // Head
  const head = new THREE.Group();
  head.position.set(0, 1.2, 0);
  const headGeo = new THREE.SphereGeometry(0.24, 32, 32);
  headGeo.scale(1.15, 1.05, 1.05);
  const headMesh = new THREE.Mesh(headGeo, matFace);
  head.add(headMesh);

  // Red Baseball Cap
  const capGeo = new THREE.SphereGeometry(0.25, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
  const capMesh = new THREE.Mesh(capGeo, matCap);
  capMesh.position.set(0, 0.08, -0.02);
  head.add(capMesh);

  const visorGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.02, 16, 1, false, 0, Math.PI);
  const visor = new THREE.Mesh(visorGeo, matCap);
  visor.position.set(0, 0.1, 0.14);
  visor.rotation.x = 0.25;
  head.add(visor);

  // Huge Cartoon Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 20, 20), matEyeWhite);
  eyeL.position.set(-0.09, 0.03, 0.22);
  eyeL.scale.set(1.0, 1.25, 0.6);
  head.add(eyeL);
  rig.eyeLeft = eyeL;

  const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), matEyeBlack);
  pupilL.position.set(-0.09, 0.03, 0.255);
  pupilL.scale.set(1.0, 1.0, 0.4);
  head.add(pupilL);
  rig.pupilLeft = pupilL;

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.065, 20, 20), matEyeWhite);
  eyeR.position.set(0.09, 0.03, 0.22);
  eyeR.scale.set(1.0, 1.25, 0.6);
  head.add(eyeR);
  rig.eyeRight = eyeR;

  const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), matEyeBlack);
  pupilR.position.set(0.09, 0.03, 0.255);
  pupilR.scale.set(1.0, 1.0, 0.4);
  head.add(pupilR);
  rig.pupilRight = pupilR;

  // Eyebrows
  const browGeo = new THREE.BoxGeometry(0.07, 0.016, 0.01);
  const browMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });
  rig.browLeft = new THREE.Mesh(browGeo, browMat);
  rig.browLeft.position.set(-0.09, 0.13, 0.24);
  head.add(rig.browLeft);

  rig.browRight = new THREE.Mesh(browGeo, browMat);
  rig.browRight.position.set(0.09, 0.13, 0.24);
  head.add(rig.browRight);

  // Articulated Mouth & Jaw
  const jawGroup = new THREE.Group();
  jawGroup.position.set(0, -0.09, 0.19);
  const mouthGeo = new THREE.BoxGeometry(0.09, 0.024, 0.02);
  rig.mouth = new THREE.Mesh(mouthGeo, matMouth);
  jawGroup.add(rig.mouth);
  head.add(jawGroup);
  rig.jaw = jawGroup;

  root.add(head);
  rig.head = head;

  // Full Articulated Arms
  const armGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.26, 16);

  // Left Arm & Hand
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.27, 0.95, 0);
  const upperL = new THREE.Mesh(armGeo, matBody);
  upperL.position.y = -0.13;
  leftArm.add(upperL);

  const leftForearm = new THREE.Group();
  leftForearm.position.set(0, -0.26, 0);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matFace);
  handL.position.y = -0.06;
  leftForearm.add(handL);
  leftArm.add(leftForearm);
  chest.add(leftArm);
  rig.leftArm = leftArm;
  rig.leftForearm = leftForearm;

  // Right Arm & Hand
  const rightArm = new THREE.Group();
  rightArm.position.set(0.27, 0.95, 0);
  const upperR = new THREE.Mesh(armGeo, matBody);
  upperR.position.y = -0.13;
  rightArm.add(upperR);

  const rightForearm = new THREE.Group();
  rightForearm.position.set(0, -0.26, 0);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matFace);
  handR.position.y = -0.06;
  rightForearm.add(handR);
  rightArm.add(rightForearm);
  chest.add(rightArm);
  rig.rightArm = rightArm;
  rig.rightForearm = rightForearm;

  // Full Articulated Cartoon Legs & Shoes
  const legGeo = new THREE.CylinderGeometry(0.05, 0.045, 0.35, 16);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.13, 0.62, 0);
  const legMeshL = new THREE.Mesh(legGeo, matCap);
  legMeshL.position.y = -0.17;
  leftLeg.add(legMeshL);

  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.18), matShoes);
  shoeL.position.set(0, -0.36, 0.04);
  leftLeg.add(shoeL);
  root.add(leftLeg);
  rig.leftThigh = leftLeg;

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.13, 0.62, 0);
  const legMeshR = new THREE.Mesh(legGeo, matCap);
  legMeshR.position.y = -0.17;
  rightLeg.add(legMeshR);

  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.18), matShoes);
  shoeR.position.set(0, -0.36, 0.04);
  rightLeg.add(shoeR);
  root.add(rightLeg);
  rig.rightThigh = rightLeg;

  avatarGroup.add(root);
  rig.root = root;
  rig.hips = root;
  groundAvatar(root);
}
