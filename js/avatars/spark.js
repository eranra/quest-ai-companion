import * as THREE from 'three';
import { rig } from './rig.js';

export function buildSparkDrone(avatarGroup) {
  rig.isFloating = true;
  const matChassis = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.8 });
  const matArmor = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.2 });
  const matGold = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.9 });
  const matNeon = new THREE.MeshBasicMaterial({ color: 0x10b981 }); // Emerald cyber glow

  const root = new THREE.Group();
  root.position.set(0, 1.25, 0);

  // Futuristic Angled Chassis
  const coreGeo = new THREE.OctahedronGeometry(0.24, 2);
  coreGeo.scale(1.1, 1.0, 0.95);
  const core = new THREE.Mesh(coreGeo, matArmor);
  root.add(core);

  // Floating Cyber Visor
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.06), matChassis);
  visor.position.set(0, 0.03, 0.2);
  root.add(visor);

  // Glowing Visor Strip Eyes
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), matNeon);
  eyeL.position.set(-0.065, 0, 0.025);
  visor.add(eyeL);
  rig.eyeLeft = eyeL;

  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), matNeon);
  eyeR.position.set(0.065, 0, 0.025);
  visor.add(eyeR);
  rig.eyeRight = eyeR;

  // Mouth Speaker Grid
  const mouthGeo = new THREE.BoxGeometry(0.08, 0.015, 0.02);
  rig.mouth = new THREE.Mesh(mouthGeo, matNeon);
  rig.mouth.position.set(0, -0.09, 0.19);
  root.add(rig.mouth);

  // Dual Orbital Communication Antennae
  const antGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.22, 8);
  const antL = new THREE.Mesh(antGeo, matGold);
  antL.position.set(-0.16, 0.22, -0.05);
  antL.rotation.z = 0.35;
  root.add(antL);

  const antTipL = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 12), matNeon);
  antTipL.position.y = 0.11;
  antL.add(antTipL);

  const antR = new THREE.Mesh(antGeo, matGold);
  antR.position.set(0.16, 0.22, -0.05);
  antR.rotation.z = -0.35;
  root.add(antR);

  const antTipR = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 12), matNeon);
  antTipR.position.y = 0.11;
  antR.add(antTipR);

  // Twin Plasma Rotors
  const rotorL = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 16, 32), matChassis);
  rotorL.position.set(-0.35, 0, 0);
  rotorL.rotation.y = Math.PI / 4;
  root.add(rotorL);
  rig.thrusters.push(rotorL);

  const rotorR = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 16, 32), matChassis);
  rotorR.position.set(0.35, 0, 0);
  rotorR.rotation.y = -Math.PI / 4;
  root.add(rotorR);
  rig.thrusters.push(rotorR);

  avatarGroup.add(root);
  rig.root = root;
  rig.head = root;
}
