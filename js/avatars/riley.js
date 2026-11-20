/**
 * Quest AI Companion - Riley (Nintendo Wii Tennis Pro Avatar)
 * Authentic procedural Mii-style avatar with detached floating hands,
 * buoyant floaty movement, turquoise polo, tennis visor, and 3D tennis racket!
 */

import * as THREE from 'three';
import { rig, groundAvatar } from './rig.js';

export function buildRileyMii(avatarGroup) {
  rig.isFloating = false;
  rig.isWii = true;

  // Materials with classic clean Nintendo Wii matte finish
  const matSkin = new THREE.MeshStandardMaterial({ color: 0xfbd0b0, roughness: 0.55 }); // Fair peach skin
  const matHair = new THREE.MeshStandardMaterial({ color: 0x5c2c16, roughness: 0.75 }); // Rich chestnut hair
  const matPolo = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.5 });  // Vibrant cyan/turquoise polo
  const matWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }); // Crisp white skirt & collar
  const matTrim = new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.4 });   // Cyan trim & bands
  const matBlush = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.55 });
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

  // 1. Torso - Classic smooth tapered Mii polo shirt
  const chest = new THREE.Group();
  
  const poloGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.40, 24);
  const poloMesh = new THREE.Mesh(poloGeo, matPolo);
  poloMesh.position.y = 0.88;
  chest.add(poloMesh);

  // White athletic collar
  const collarGeo = new THREE.TorusGeometry(0.16, 0.02, 12, 24);
  collarGeo.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, matWhite);
  collar.position.y = 1.08;
  chest.add(collar);

  // Polo button placket
  const placketGeo = new THREE.BoxGeometry(0.04, 0.12, 0.015);
  const placket = new THREE.Mesh(placketGeo, matWhite);
  placket.position.set(0, 0.98, 0.19);
  chest.add(placket);

  root.add(chest);
  rig.chest = chest;

  // 2. Head - Classic cheerful Mii head with Visor & Ponytail
  const head = new THREE.Group();
  head.position.set(0, 1.25, 0);

  // Main head sphere
  const headGeo = new THREE.SphereGeometry(0.22, 32, 32);
  headGeo.scale(1.06, 1.05, 1.02);
  const headMesh = new THREE.Mesh(headGeo, matSkin);
  head.add(headMesh);

  // Styled Mii Hair: bangs and base volume
  const hairGeo = new THREE.SphereGeometry(0.228, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const hairMesh = new THREE.Mesh(hairGeo, matHair);
  hairMesh.position.set(0, 0.04, -0.01);
  head.add(hairMesh);

  // Side hair bangs framing face
  const bangL = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8), matHair);
  bangL.position.set(-0.16, 0.02, 0.14);
  bangL.rotation.set(0.2, 0, 0.3);
  head.add(bangL);

  const bangR = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8), matHair);
  bangR.position.set(0.16, 0.02, 0.14);
  bangR.rotation.set(0.2, 0, -0.3);
  head.add(bangR);

  // High Tennis Ponytail at the back
  const ponytailGroup = new THREE.Group();
  ponytailGroup.position.set(0, 0.12, -0.22);
  ponytailGroup.rotation.x = -0.55;

  const hairTie = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 16), matTrim);
  ponytailGroup.add(hairTie);

  const ponytailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.28, 12), matHair);
  ponytailMesh.position.y = -0.12;
  ponytailMesh.rotation.x = Math.PI;
  ponytailGroup.add(ponytailMesh);

  head.add(ponytailGroup);

  // White Tennis Visor Cap
  const visorBandGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.04, 24, 1, true);
  const visorBand = new THREE.Mesh(visorBandGeo, matWhite);
  visorBand.position.set(0, 0.10, 0);
  head.add(visorBand);

  // Visor cyan stripe
  const visorStripeGeo = new THREE.CylinderGeometry(0.232, 0.232, 0.012, 24, 1, true);
  const visorStripe = new THREE.Mesh(visorStripeGeo, matTrim);
  visorStripe.position.set(0, 0.10, 0);
  head.add(visorStripe);

  // Visor curved front brim
  const brimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.015, 20, 1, false, -Math.PI * 0.35, Math.PI * 0.7);
  const visorBrim = new THREE.Mesh(brimGeo, matWhite);
  visorBrim.position.set(0, 0.09, 0.10);
  visorBrim.rotation.x = 0.25;
  head.add(visorBrim);

  // Mii Cute Button Nose
  const noseGeo = new THREE.SphereGeometry(0.026, 16, 16);
  const nose = new THREE.Mesh(noseGeo, matSkin);
  nose.position.set(0, -0.02, 0.228);
  head.add(nose);

  // Rosy cheeks (classic friendly Mii detail)
  const blushGeo = new THREE.CircleGeometry(0.032, 16);
  const blushL = new THREE.Mesh(blushGeo, matBlush);
  blushL.position.set(-0.13, -0.04, 0.185);
  blushL.rotation.y = -0.45;
  head.add(blushL);

  const blushR = new THREE.Mesh(blushGeo, matBlush);
  blushR.position.set(0.13, -0.04, 0.185);
  blushR.rotation.y = 0.45;
  head.add(blushR);

  // Friendly curved Mii eyebrows
  const browGeo = new THREE.BoxGeometry(0.065, 0.018, 0.012);
  
  const browL = new THREE.Mesh(browGeo, matHair);
  browL.position.set(-0.08, 0.11, 0.215);
  browL.rotation.z = -0.08;
  browL.userData.baseY = 0.11;
  head.add(browL);
  rig.browLeft = browL;

  const browR = new THREE.Mesh(browGeo, matHair);
  browR.position.set(0.08, 0.11, 0.215);
  browR.rotation.z = 0.08;
  browR.userData.baseY = 0.11;
  head.add(browR);
  rig.browRight = browR;

  // Expressive Mii Button Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.046, 16, 16), matEyeWhite);
  eyeL.position.set(-0.08, 0.03, 0.21);
  eyeL.scale.set(1.0, 1.15, 0.4);
  eyeL.userData.baseY = 0.03;
  head.add(eyeL);
  rig.eyeLeft = eyeL;

  const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 14), matEyeBlack);
  pupilL.position.set(-0.08, 0.03, 0.23);
  pupilL.scale.set(1.0, 1.1, 0.3);
  pupilL.userData.baseY = 0.03;
  head.add(pupilL);
  rig.pupilLeft = pupilL;

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.046, 16, 16), matEyeWhite);
  eyeR.position.set(0.08, 0.03, 0.21);
  eyeR.scale.set(1.0, 1.15, 0.4);
  eyeR.userData.baseY = 0.03;
  head.add(eyeR);
  rig.eyeRight = eyeR;

  const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 14), matEyeBlack);
  pupilR.position.set(0.08, 0.03, 0.23);
  pupilR.scale.set(1.0, 1.1, 0.3);
  pupilR.userData.baseY = 0.03;
  head.add(pupilR);
  rig.pupilRight = pupilR;

  // Cheerful Open Mii Smile
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.09, 0.222);
  mouthGroup.userData.baseY = -0.09;

  const smileShape = new THREE.Shape();
  smileShape.moveTo(-0.058, 0.016);
  smileShape.quadraticCurveTo(0, 0.030, 0.058, 0.016);
  smileShape.quadraticCurveTo(0.045, -0.034, 0, -0.038);
  smileShape.quadraticCurveTo(-0.045, -0.034, -0.058, 0.016);

  const smileGeo = new THREE.ShapeGeometry(smileShape);
  const smileMesh = new THREE.Mesh(smileGeo, matMouth);
  mouthGroup.add(smileMesh);

  // Pearly white upper teeth
  const teethShape = new THREE.Shape();
  teethShape.moveTo(-0.046, 0.016);
  teethShape.quadraticCurveTo(0, 0.026, 0.046, 0.016);
  teethShape.lineTo(0.046, 0.007);
  teethShape.quadraticCurveTo(0, 0.015, -0.046, 0.007);
  teethShape.closePath();
  const teethMesh = new THREE.Mesh(new THREE.ShapeGeometry(teethShape), matWhite);
  teethMesh.position.z = 0.002;
  mouthGroup.add(teethMesh);

  head.add(mouthGroup);
  rig.mouth = mouthGroup;
  rig.jaw = mouthGroup;

  root.add(head);
  rig.head = head;

  // 3. True Nintendo Wii Detached Floating Hands (No Arms!)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.26, 0.95, 0);

  const leftForearm = new THREE.Group();
  leftForearm.position.set(0, -0.20, 0);

  // Cyan sweatband on wrist
  const bandL = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.015, 12, 24), matTrim);
  bandL.rotation.x = Math.PI / 2;
  bandL.position.y = -0.02;
  leftForearm.add(bandL);

  // Iconic Mii floating sphere hand
  const handGroupL = new THREE.Group();
  handGroupL.position.y = -0.08;
  const palmL = new THREE.Mesh(new THREE.SphereGeometry(0.068, 24, 24), matWhite);
  handGroupL.add(palmL);
  const thumbL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 16), matWhite);
  thumbL.position.set(0.05, 0.012, 0.022);
  handGroupL.add(thumbL);
  leftForearm.add(handGroupL);

  leftArm.add(leftForearm);
  chest.add(leftArm);
  rig.leftArm = leftArm;
  rig.leftForearm = leftForearm;

  // Right Arm: Detached Floating Hand holding Cyan Tennis Racket
  const rightArm = new THREE.Group();
  rightArm.position.set(0.26, 0.95, 0);

  const rightForearm = new THREE.Group();
  rightForearm.position.set(0, -0.20, 0);

  const bandR = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.015, 12, 24), matTrim);
  bandR.rotation.x = Math.PI / 2;
  bandR.position.y = -0.02;
  rightForearm.add(bandR);

  const handGroupR = new THREE.Group();
  handGroupR.position.y = -0.08;
  const palmR = new THREE.Mesh(new THREE.SphereGeometry(0.068, 24, 24), matWhite);
  handGroupR.add(palmR);
  const thumbR = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 16), matWhite);
  thumbR.position.set(-0.05, 0.012, 0.022);
  handGroupR.add(thumbR);
  rightForearm.add(handGroupR);

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
  skirt.position.y = 0.67;
  root.add(skirt);

  const legGeo = new THREE.CylinderGeometry(0.05, 0.044, 0.28, 16);

  // Left Leg & Sneaker
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.11, 0.58, 0);
  const legMeshL = new THREE.Mesh(legGeo, matSkin);
  legMeshL.position.y = -0.14;
  leftLeg.add(legMeshL);

  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.19), matShoes);
  shoeL.position.set(0, -0.29, 0.04);
  leftLeg.add(shoeL);

  const soleL = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.022, 0.20), matSole);
  soleL.position.set(0, -0.33, 0.04);
  leftLeg.add(soleL);

  root.add(leftLeg);
  rig.leftThigh = leftLeg;

  // Right Leg & Sneaker
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.11, 0.58, 0);
  const legMeshR = new THREE.Mesh(legGeo, matSkin);
  legMeshR.position.y = -0.14;
  rightLeg.add(legMeshR);

  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.19), matShoes);
  shoeR.position.set(0, -0.29, 0.04);
  rightLeg.add(shoeR);

  const soleR = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.022, 0.20), matSole);
  soleR.position.set(0, -0.33, 0.04);
  rightLeg.add(soleR);

  root.add(rightLeg);
  rig.rightThigh = rightLeg;

  avatarGroup.add(root);
  rig.root = root;
  rig.hips = root;
  groundAvatar(root);
}
