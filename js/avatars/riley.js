/**
 * Quest AI Companion - Riley (Nintendo Wii Tennis Pro & Companion Avatar)
 * Authentic procedural Mii-style avatar with vibrant cyan tennis polo,
 * sporty tennis visor, cheerful rosy cheeks, buoyant floaty movement, and tennis racket!
 */

import * as THREE from 'three';
import { rig, groundAvatar } from './rig.js';

export function buildRileyMii(avatarGroup) {
  rig.isFloating = false;
  rig.isWii = true;

  // Materials with classic clean Nintendo Wii matte finish
  const matSkin = new THREE.MeshStandardMaterial({ color: 0xfbd38d, roughness: 0.6 }); // Warm peachy skin
  const matHair = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 }); // Chestnut brown hair
  const matCheeks = new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.55 }); // Rosy cheeks
  const matPolo = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.5 });  // Vibrant cyan tennis polo
  const matWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }); // White visor, collar, skirt
  const matTrim = new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.4 });   // Cyan visor trim
  const matShoes = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });  // White sneakers
  const matSole = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.4 });   // Cyan sneaker sole
  const matEyeBlack = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const matEyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const matMouth = new THREE.MeshBasicMaterial({ color: 0x9f1239 });
  const matRacketCyan = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.2 });
  const matRacketGrip = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const matStrings = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, wireframe: true });

  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  // 1. Torso - Classic conical Mii tennis polo
  const chest = new THREE.Group();
  
  const poloGeo = new THREE.CylinderGeometry(0.19, 0.23, 0.40, 24);
  const poloMesh = new THREE.Mesh(poloGeo, matPolo);
  poloMesh.position.y = 0.88;
  chest.add(poloMesh);

  // White athletic collar ring
  const collarGeo = new THREE.TorusGeometry(0.17, 0.022, 12, 24);
  collarGeo.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, matWhite);
  collar.position.y = 1.08;
  chest.add(collar);

  // Polo button placket
  const placketGeo = new THREE.BoxGeometry(0.04, 0.12, 0.02);
  const placket = new THREE.Mesh(placketGeo, matWhite);
  placket.position.set(0, 0.98, 0.205);
  chest.add(placket);

  root.add(chest);
  rig.chest = chest;

  // 2. Head - Classic spherical Mii head with hair & tennis visor
  const head = new THREE.Group();
  head.position.set(0, 1.25, 0);

  // Main head sphere
  const headGeo = new THREE.SphereGeometry(0.22, 32, 32);
  headGeo.scale(1.06, 1.04, 1.02);
  const headMesh = new THREE.Mesh(headGeo, matSkin);
  head.add(headMesh);

  // Styled Mii Hair: Parted hair and side bangs
  const hairGeo = new THREE.SphereGeometry(0.226, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.48);
  const hairMesh = new THREE.Mesh(hairGeo, matHair);
  hairMesh.position.set(0, 0.05, -0.015);
  head.add(hairMesh);

  // Side hair tufts
  const tuftGeo = new THREE.SphereGeometry(0.06, 12, 12);
  tuftGeo.scale(0.8, 1.4, 0.8);
  const tuftL = new THREE.Mesh(tuftGeo, matHair);
  tuftL.position.set(-0.19, 0.02, 0.08);
  tuftL.rotation.z = 0.2;
  head.add(tuftL);

  const tuftR = new THREE.Mesh(tuftGeo, matHair);
  tuftR.position.set(0.19, 0.02, 0.08);
  tuftR.rotation.z = -0.2;
  head.add(tuftR);

  // Sporty Ponytail at the back
  const ponyGeo = new THREE.SphereGeometry(0.08, 14, 14);
  ponyGeo.scale(0.8, 1.3, 0.9);
  const ponytail = new THREE.Mesh(ponyGeo, matHair);
  ponytail.position.set(0, 0.04, -0.22);
  ponytail.rotation.x = -0.3;
  head.add(ponytail);

  // White Tennis Visor
  const visorBandGeo = new THREE.CylinderGeometry(0.228, 0.232, 0.04, 24, 1, true);
  const visorBand = new THREE.Mesh(visorBandGeo, matWhite);
  visorBand.position.set(0, 0.09, 0);
  head.add(visorBand);

  // Visor Brim
  const visorBrimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.018, 16, 1, false, 0, Math.PI);
  const visorBrim = new THREE.Mesh(visorBrimGeo, matWhite);
  visorBrim.position.set(0, 0.10, 0.12);
  visorBrim.rotation.x = 0.28;
  head.add(visorBrim);

  const visorTrimGeo = new THREE.CylinderGeometry(0.242, 0.242, 0.01, 16, 1, false, 0, Math.PI);
  const visorTrim = new THREE.Mesh(visorTrimGeo, matTrim);
  visorTrim.position.set(0, 0.105, 0.12);
  visorTrim.rotation.x = 0.28;
  head.add(visorTrim);

  // Mii Cute Button Nose
  const noseGeo = new THREE.SphereGeometry(0.028, 14, 14);
  const nose = new THREE.Mesh(noseGeo, matSkin);
  nose.position.set(0, -0.02, 0.225);
  head.add(nose);

  // Rosy Cheeks (Charming Wii character aesthetic)
  const cheekGeo = new THREE.SphereGeometry(0.038, 12, 12);
  cheekGeo.scale(1.2, 0.8, 0.2);
  const cheekL = new THREE.Mesh(cheekGeo, matCheeks);
  cheekL.position.set(-0.12, -0.04, 0.195);
  head.add(cheekL);

  const cheekR = new THREE.Mesh(cheekGeo, matCheeks);
  cheekR.position.set(0.12, -0.04, 0.195);
  head.add(cheekR);

  // Cheerful Arched Eyebrows
  const browGeo = new THREE.BoxGeometry(0.07, 0.018, 0.012);
  
  const browL = new THREE.Mesh(browGeo, matHair);
  browL.position.set(-0.08, 0.11, 0.21);
  browL.rotation.z = -0.08;
  head.add(browL);
  rig.browLeft = browL;

  const browR = new THREE.Mesh(browGeo, matHair);
  browR.position.set(0.08, 0.11, 0.21);
  browR.rotation.z = 0.08;
  head.add(browR);
  rig.browRight = browR;

  // Cheerful Large Mii Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), matEyeWhite);
  eyeL.position.set(-0.08, 0.03, 0.205);
  eyeL.scale.set(1.0, 1.2, 0.4);
  head.add(eyeL);
  rig.eyeLeft = eyeL;

  const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 14), matEyeBlack);
  pupilL.position.set(-0.08, 0.03, 0.225);
  pupilL.scale.set(1.0, 1.15, 0.3);
  head.add(pupilL);
  rig.pupilLeft = pupilL;

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), matEyeWhite);
  eyeR.position.set(0.08, 0.03, 0.205);
  eyeR.scale.set(1.0, 1.2, 0.4);
  head.add(eyeR);
  rig.eyeRight = eyeR;

  const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 14), matEyeBlack);
  pupilR.position.set(0.08, 0.03, 0.225);
  pupilR.scale.set(1.0, 1.15, 0.3);
  head.add(pupilR);
  rig.pupilRight = pupilR;

  // Cheerful Open Mouth
  const jawGroup = new THREE.Group();
  jawGroup.position.set(0, -0.09, 0.185);
  const mouthGeo = new THREE.BoxGeometry(0.085, 0.026, 0.02);
  rig.mouth = new THREE.Mesh(mouthGeo, matMouth);
  jawGroup.add(rig.mouth);
  head.add(jawGroup);
  rig.jaw = jawGroup;

  root.add(head);
  rig.head = head;

  // 3. Floating Spherical Hands & Arms
  const armSleeveGeo = new THREE.CylinderGeometry(0.05, 0.045, 0.13, 16);

  // Left Arm & Hand
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.25, 0.95, 0);
  const sleeveL = new THREE.Mesh(armSleeveGeo, matPolo);
  sleeveL.position.y = -0.05;
  leftArm.add(sleeveL);

  const leftForearm = new THREE.Group();
  leftForearm.position.set(0, -0.20, 0);

  // Cyan sweatband on wrist
  const bandL = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.035, 16), matTrim);
  bandL.position.y = -0.02;
  leftForearm.add(bandL);

  // Iconic Mii floating sphere hand
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 20), matWhite);
  handL.position.y = -0.08;
  leftForearm.add(handL);

  leftArm.add(leftForearm);
  chest.add(leftArm);
  rig.leftArm = leftArm;
  rig.leftForearm = leftForearm;

  // Right Arm, Hand & Cyan Tennis Racket
  const rightArm = new THREE.Group();
  rightArm.position.set(0.25, 0.95, 0);
  const sleeveR = new THREE.Mesh(armSleeveGeo, matPolo);
  sleeveR.position.y = -0.05;
  rightArm.add(sleeveR);

  const rightForearm = new THREE.Group();
  rightForearm.position.set(0, -0.20, 0);

  const bandR = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.035, 16), matTrim);
  bandR.position.y = -0.02;
  rightForearm.add(bandR);

  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 20), matWhite);
  handR.position.y = -0.08;
  rightForearm.add(handR);

  // Authentic Wii Tennis Racket attached to right hand
  const racketGroup = new THREE.Group();
  racketGroup.position.set(0.02, -0.08, 0.06);
  racketGroup.rotation.set(0.2, 0.1, -0.3);

  // Racket Handle
  const handleGeo = new THREE.CylinderGeometry(0.015, 0.017, 0.22, 12);
  const handle = new THREE.Mesh(handleGeo, matRacketGrip);
  handle.position.y = -0.05;
  racketGroup.add(handle);

  // Racket Throat
  const throatGeo = new THREE.CylinderGeometry(0.013, 0.015, 0.07, 8);
  const throat = new THREE.Mesh(throatGeo, matRacketCyan);
  throat.position.y = 0.07;
  racketGroup.add(throat);

  // Racket Oval Rim
  const rimGeo = new THREE.TorusGeometry(0.11, 0.015, 12, 24);
  rimGeo.scale(0.85, 1.15, 1.0);
  const rim = new THREE.Mesh(rimGeo, matRacketCyan);
  rim.position.y = 0.20;
  racketGroup.add(rim);

  // Racket String Bed Grid
  const stringGeo = new THREE.PlaneGeometry(0.17, 0.23, 6, 8);
  const strings = new THREE.Mesh(stringGeo, matStrings);
  strings.position.y = 0.20;
  racketGroup.add(strings);

  rightForearm.add(racketGroup);
  rig.racket = racketGroup;

  rightArm.add(rightForearm);
  chest.add(rightArm);
  rig.rightArm = rightArm;
  rig.rightForearm = rightForearm;

  // 4. White Tennis Skirt, Legs & Sneakers
  const skirtGeo = new THREE.CylinderGeometry(0.22, 0.27, 0.17, 24);
  const skirt = new THREE.Mesh(skirtGeo, matWhite);
  shortsGeoPosition: skirt.position.y = 0.67;
  root.add(skirt);

  const legGeo = new THREE.CylinderGeometry(0.05, 0.044, 0.28, 16);

  // Left Leg & Sneaker
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.11, 0.58, 0);
  const legMeshL = new THREE.Mesh(legGeo, matSkin);
  legMeshL.position.y = -0.14;
  leftLeg.add(legMeshL);

  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.085, 0.19), matShoes);
  shoeL.position.set(0, -0.30, 0.035);
  leftLeg.add(shoeL);

  const soleL = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.022, 0.20), matSole);
  soleL.position.set(0, -0.335, 0.035);
  leftLeg.add(soleL);

  root.add(leftLeg);
  rig.leftThigh = leftLeg;

  // Right Leg & Sneaker
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.11, 0.58, 0);
  const legMeshR = new THREE.Mesh(legGeo, matSkin);
  legMeshR.position.y = -0.14;
  rightLeg.add(legMeshR);

  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.085, 0.19), matShoes);
  shoeR.position.set(0, -0.30, 0.035);
  rightLeg.add(shoeR);

  const soleR = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.022, 0.20), matSole);
  soleR.position.set(0, -0.335, 0.035);
  rightLeg.add(soleR);

  root.add(rightLeg);
  rig.rightThigh = rightLeg;

  avatarGroup.add(root);
  rig.root = root;
  rig.hips = root;
  groundAvatar(root);
}
