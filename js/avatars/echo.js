import * as THREE from 'three';
import { rig } from './rig.js';

export function buildEchoDrone(avatarGroup) {
  rig.isFloating = true;
  const matBody = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });
  const matTrim = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.6 });
  const matScreen = new THREE.MeshBasicMaterial({ color: 0x050c18 });
  const matGlow = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  const root = new THREE.Group();
  root.position.set(0, 1.25, 0);

  // Drone Body Shell
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 32), matBody);
  root.add(body);

  // Curved digital screen
  const screenGeo = new THREE.SphereGeometry(0.25, 32, 16, 0, Math.PI, 0, Math.PI * 0.45);
  screenGeo.scale(1.02, 0.7, 0.9);
  const screen = new THREE.Mesh(screenGeo, matScreen);
  screen.rotation.x = Math.PI * 0.55;
  screen.position.set(0, 0.05, 0.12);
  root.add(screen);

  // Digital Eyes on Screen (compatible with Three.js r128)
  const eyeGeoL = new THREE.SphereGeometry(0.025, 16, 16);
  eyeGeoL.scale(1.4, 0.8, 0.4);
  const eyeL = new THREE.Mesh(eyeGeoL, matGlow);
  eyeL.position.set(-0.08, 0.07, 0.29);
  root.add(eyeL);
  rig.eyeLeft = eyeL;

  const eyeGeoR = new THREE.SphereGeometry(0.025, 16, 16);
  eyeGeoR.scale(1.4, 0.8, 0.4);
  const eyeR = new THREE.Mesh(eyeGeoR, matGlow);
  eyeR.position.set(0.08, 0.07, 0.29);
  root.add(eyeR);
  rig.eyeRight = eyeR;

  // Digital Mouth / Equalizer audio bar
  const eqGroup = new THREE.Group();
  eqGroup.position.set(0, -0.06, 0.29);
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.025, 0.005), matGlow);
    bar.position.x = i * 0.026;
    eqGroup.add(bar);
    rig.equalizerBars.push(bar);
  }
  root.add(eqGroup);

  // Hovering side thruster pods
  const thrusterL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.14, 16), matTrim);
  thrusterL.position.set(-0.36, -0.05, 0);
  thrusterL.rotation.z = Math.PI / 8;
  root.add(thrusterL);
  rig.thrusters.push(thrusterL);

  const thrusterR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.14, 16), matTrim);
  thrusterR.position.set(0.36, -0.05, 0);
  thrusterR.rotation.z = -Math.PI / 8;
  root.add(thrusterR);
  rig.thrusters.push(thrusterR);

  // Soft glowing thruster exhaust lights
  const exhaustGeo = new THREE.ConeGeometry(0.04, 0.12, 16);
  const exhaustL = new THREE.Mesh(exhaustGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7 }));
  exhaustL.rotation.x = Math.PI;
  exhaustL.position.y = -0.11;
  thrusterL.add(exhaustL);

  const exhaustR = new THREE.Mesh(exhaustGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7 }));
  exhaustR.rotation.x = Math.PI;
  exhaustR.position.y = -0.11;
  thrusterR.add(exhaustR);

  avatarGroup.add(root);
  rig.root = root;
  rig.head = root;
}
