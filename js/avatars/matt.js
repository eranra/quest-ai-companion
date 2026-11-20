/**
 * Quest AI Companion - Matt (Nintendo Wii Sports Champion Avatar)
 * Authentic procedural Mii-style avatar with classic detached floating hands,
 * buoyant floaty proportions, signature champion red jersey, and 3D tennis racket!
 */

import * as THREE from 'three';
import { rig, groundAvatar } from './rig.js';

export function buildMattMii(avatarGroup) {
  rig.isFloating = false;
  rig.isWii = true;

  // Materials with classic clean Nintendo Wii matte finish
  const matSkin = new THREE.MeshStandardMaterial({ color: 0xd4976a, roughness: 0.6 }); // Warm tan skin
  const matHair = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8 }); // Dark buzzcut
  const matBeard = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 }); // Dark goatee
  const matJersey = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 }); // Champion red jersey
  const matTrim = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });   // White jersey trim & wristbands
  const matShorts = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 }); // Athletic navy shorts
  const matShoes = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });  // White sports sneakers
  const matSole = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });   // Red sneaker sole
  const matEyeBlack = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const matEyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const matMouth = new THREE.MeshBasicMaterial({ color: 0x881337 });
  const matRacketRed = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.3, metalness: 0.2 });
  const matRacketGrip = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const matStrings = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, wireframe: true });

  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  // 1. Torso - Classic smooth pear/conical Mii sports jersey
  const chest = new THREE.Group();
  
  // Upper torso rounded cylinder/cone
  const jerseyGeo = new THREE.CylinderGeometry(0.19, 0.24, 0.42, 24);
  const jerseyMesh = new THREE.Mesh(jerseyGeo, matJersey);
  jerseyMesh.position.y = 0.90;
  chest.add(jerseyMesh);

  // White athletic collar ring
  const collarGeo = new THREE.TorusGeometry(0.18, 0.022, 12, 24);
  collarGeo.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, matTrim);
  collar.position.y = 1.11;
  chest.add(collar);

  // Athletic white stripe across chest
  const stripeGeo = new THREE.CylinderGeometry(0.205, 0.215, 0.045, 24);
  const stripe = new THREE.Mesh(stripeGeo, matTrim);
  stripe.position.y = 0.96;
  chest.add(stripe);

  root.add(chest);
  rig.chest = chest;

  // 2. Head - Classic spherical/capsule Mii head
  const head = new THREE.Group();
  head.position.set(0, 1.28, 0);

  // Main head sphere
  const headGeo = new THREE.SphereGeometry(0.23, 32, 32);
  headGeo.scale(1.08, 1.05, 1.02);
  const headMesh = new THREE.Mesh(headGeo, matSkin);
  head.add(headMesh);

  // Cropped buzzcut cap
  const hairGeo = new THREE.SphereGeometry(0.236, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
  const hairMesh = new THREE.Mesh(hairGeo, matHair);
  hairMesh.position.set(0, 0.05, -0.01);
  head.add(hairMesh);

  // Goatee / Stubble detail around chin (Matt's signature look)
  const goateeGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.03, 16);
  const goatee = new THREE.Mesh(goateeGeo, matBeard);
  goatee.position.set(0, -0.17, 0.17);
  goatee.rotation.x = 0.4;
  head.add(goatee);

  // Mii Button Nose
  const noseGeo = new THREE.SphereGeometry(0.032, 16, 16);
  noseGeo.scale(1.0, 0.9, 0.8);
  const nose = new THREE.Mesh(noseGeo, matSkin);
  nose.position.set(0, -0.02, 0.235);
  head.add(nose);

  // Characteristic Mii Curved Eyebrows (Determined & Friendly)
  const browGeo = new THREE.BoxGeometry(0.075, 0.022, 0.015);
  
  const browL = new THREE.Mesh(browGeo, matHair);
  browL.position.set(-0.085, 0.12, 0.22);
  browL.rotation.z = -0.12;
  browL.userData.baseY = 0.12;
  head.add(browL);
  rig.browLeft = browL;

  const browR = new THREE.Mesh(browGeo, matHair);
  browR.position.set(0.085, 0.12, 0.22);
  browR.rotation.z = 0.12;
  browR.userData.baseY = 0.12;
  head.add(browR);
  rig.browRight = browR;

  // Classic Mii Button Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 16), matEyeWhite);
  eyeL.position.set(-0.085, 0.035, 0.215);
  eyeL.scale.set(1.0, 1.15, 0.4);
  eyeL.userData.baseY = 0.035;
  head.add(eyeL);
  rig.eyeLeft = eyeL;

  const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 14), matEyeBlack);
  pupilL.position.set(-0.085, 0.035, 0.235);
  pupilL.scale.set(1.0, 1.1, 0.3);
  pupilL.userData.baseY = 0.035;
  head.add(pupilL);
  rig.pupilLeft = pupilL;

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 16), matEyeWhite);
  eyeR.position.set(0.085, 0.035, 0.215);
  eyeR.scale.set(1.0, 1.15, 0.4);
  eyeR.userData.baseY = 0.035;
  head.add(eyeR);
  rig.eyeRight = eyeR;

  const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 14), matEyeBlack);
  pupilR.position.set(0.085, 0.035, 0.235);
  pupilR.scale.set(1.0, 1.1, 0.3);
  pupilR.userData.baseY = 0.035;
  head.add(pupilR);
  rig.pupilRight = pupilR;

  // Authentic Mii Curved Smile Mouth
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.10, 0.224);
  mouthGroup.userData.baseY = -0.10;

  // Curved smile aperture
  const smileShape = new THREE.Shape();
  smileShape.moveTo(-0.062, 0.015);
  smileShape.quadraticCurveTo(0, 0.028, 0.062, 0.015);
  smileShape.quadraticCurveTo(0.048, -0.026, 0, -0.030);
  smileShape.quadraticCurveTo(-0.048, -0.026, -0.062, 0.015);

  const smileGeo = new THREE.ShapeGeometry(smileShape);
  const smileMesh = new THREE.Mesh(smileGeo, matMouth);
  mouthGroup.add(smileMesh);

  // Subtle upper teeth line
  const teethShape = new THREE.Shape();
  teethShape.moveTo(-0.044, 0.015);
  teethShape.quadraticCurveTo(0, 0.024, 0.044, 0.015);
  teethShape.lineTo(0.044, 0.006);
  teethShape.quadraticCurveTo(0, 0.013, -0.044, 0.006);
  teethShape.closePath();
  const teethMesh = new THREE.Mesh(new THREE.ShapeGeometry(teethShape), matTrim);
  teethMesh.position.z = 0.002;
  mouthGroup.add(teethMesh);

  head.add(mouthGroup);
  rig.mouth = mouthGroup;
  rig.jaw = mouthGroup;

  root.add(head);
  rig.head = head;

  // 3. True Nintendo Wii Detached Floating Hands (No Arms!)
  // Arms serve purely as invisible hierarchical pivot transforms
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.28, 0.98, 0);

  const leftForearm = new THREE.Group();
  leftForearm.position.set(0, -0.22, 0);

  // White athletic sweatband
  const bandL = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.016, 12, 24), matTrim);
  bandL.rotation.x = Math.PI / 2;
  bandL.position.y = -0.02;
  leftForearm.add(bandL);

  // Floating sphere hand with thumb nub
  const handGroupL = new THREE.Group();
  handGroupL.position.y = -0.09;
  const palmL = new THREE.Mesh(new THREE.SphereGeometry(0.072, 24, 24), matTrim);
  handGroupL.add(palmL);
  const thumbL = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 16), matTrim);
  thumbL.position.set(0.055, 0.015, 0.025);
  handGroupL.add(thumbL);
  leftForearm.add(handGroupL);

  leftArm.add(leftForearm);
  chest.add(leftArm);
  rig.leftArm = leftArm;
  rig.leftForearm = leftForearm;

  // Right Arm: Detached Floating Hand holding 3D Tennis Racket
  const rightArm = new THREE.Group();
  rightArm.position.set(0.28, 0.98, 0);

  const rightForearm = new THREE.Group();
  rightForearm.position.set(0, -0.22, 0);

  const bandR = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.016, 12, 24), matTrim);
  bandR.rotation.x = Math.PI / 2;
  bandR.position.y = -0.02;
  rightForearm.add(bandR);

  const handGroupR = new THREE.Group();
  handGroupR.position.y = -0.09;
  const palmR = new THREE.Mesh(new THREE.SphereGeometry(0.072, 24, 24), matTrim);
  handGroupR.add(palmR);
  const thumbR = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 16), matTrim);
  thumbR.position.set(-0.055, 0.015, 0.025);
  handGroupR.add(thumbR);
  rightForearm.add(handGroupR);

  // Authentic Wii Tennis Racket attached to right hand
  const racketGroup = new THREE.Group();
  racketGroup.position.set(0.02, -0.09, 0.06);
  racketGroup.rotation.set(0.2, 0.1, -0.3);

  // Racket Handle
  const handleGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.24, 12);
  const handle = new THREE.Mesh(handleGeo, matRacketGrip);
  handle.position.y = -0.06;
  racketGroup.add(handle);

  // Racket Throat / Triangle
  const throatGeo = new THREE.CylinderGeometry(0.014, 0.016, 0.08, 8);
  const throat = new THREE.Mesh(throatGeo, matRacketRed);
  throat.position.y = 0.08;
  racketGroup.add(throat);

  // Racket Oval Rim (Torus stretched into oval)
  const rimGeo = new THREE.TorusGeometry(0.12, 0.016, 12, 24);
  rimGeo.scale(0.85, 1.15, 1.0);
  const rim = new THREE.Mesh(rimGeo, matRacketRed);
  rim.position.y = 0.22;
  racketGroup.add(rim);

  // Racket String Bed Grid
  const stringGeo = new THREE.PlaneGeometry(0.18, 0.25, 6, 8);
  const strings = new THREE.Mesh(stringGeo, matStrings);
  strings.position.y = 0.22;
  racketGroup.add(strings);

  rightForearm.add(racketGroup);
  rig.racket = racketGroup;

  rightArm.add(rightForearm);
  chest.add(rightArm);
  rig.rightArm = rightArm;
  rig.rightForearm = rightForearm;

  // 4. Shorts, Legs & Sneakers
  const shortsGeo = new THREE.CylinderGeometry(0.24, 0.22, 0.18, 24);
  const shorts = new THREE.Mesh(shortsGeo, matShorts);
  shorts.position.y = 0.68;
  root.add(shorts);

  const legGeo = new THREE.CylinderGeometry(0.055, 0.048, 0.28, 16);

  // Left Leg & Sneaker
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.12, 0.60, 0);
  const legMeshL = new THREE.Mesh(legGeo, matSkin);
  legMeshL.position.y = -0.14;
  leftLeg.add(legMeshL);

  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.20), matShoes);
  shoeL.position.set(0, -0.30, 0.04);
  leftLeg.add(shoeL);

  const soleL = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.025, 0.21), matSole);
  soleL.position.set(0, -0.34, 0.04);
  leftLeg.add(soleL);

  root.add(leftLeg);
  rig.leftThigh = leftLeg;

  // Right Leg & Sneaker
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.12, 0.60, 0);
  const legMeshR = new THREE.Mesh(legGeo, matSkin);
  legMeshR.position.y = -0.14;
  rightLeg.add(legMeshR);

  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.20), matShoes);
  shoeR.position.set(0, -0.30, 0.04);
  rightLeg.add(shoeR);

  const soleR = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.025, 0.21), matSole);
  soleR.position.set(0, -0.34, 0.04);
  rightLeg.add(soleR);

  root.add(rightLeg);
  rig.rightThigh = rightLeg;

  avatarGroup.add(root);
  rig.root = root;
  rig.hips = root;
  groundAvatar(root);
}
