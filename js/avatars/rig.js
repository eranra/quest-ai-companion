// Procedural Avatar Rig & Conversational Animation Controller
import * as THREE from 'three';
import { AppState } from '../state.js';

export const rig = {
  root: null,
  hips: null,
  chest: null,
  head: null,
  jaw: null,
  mouth: null,
  eyeLeft: null,
  eyeRight: null,
  pupilLeft: null,
  pupilRight: null,
  browLeft: null,
  browRight: null,
  leftArm: null,
  leftForearm: null,
  rightArm: null,
  rightForearm: null,
  leftThigh: null,
  rightThigh: null,
  isFloating: false,
  thrusters: [],
  equalizerBars: [],
  morphMeshes: [],
  mixer: null
};

export function resetRig() {
  rig.root = null;
  rig.hips = null;
  rig.chest = null;
  rig.head = null;
  rig.jaw = null;
  rig.mouth = null;
  rig.eyeLeft = null;
  rig.eyeRight = null;
  rig.pupilLeft = null;
  rig.pupilRight = null;
  rig.browLeft = null;
  rig.browRight = null;
  rig.leftArm = null;
  rig.leftForearm = null;
  rig.rightArm = null;
  rig.rightForearm = null;
  rig.leftThigh = null;
  rig.rightThigh = null;
  rig.isFloating = false;
  rig.thrusters = [];
  rig.equalizerBars = [];
  rig.morphMeshes = [];
  if (rig.mixer) {
    rig.mixer.stopAllAction();
    rig.mixer = null;
  }
}

// Automatically binds Mixamo / ReadyPlayerMe bones from a loaded glTF scene to rig controls
export function bindBonesFromHierarchy(root) {
  root.traverse((node) => {
    const name = node.name || '';
    const norm = name.toLowerCase().replace(/mixamorig:?|_/g, '');

    if (norm === 'head') rig.head = node;
    else if (norm === 'spine1' || norm === 'spine2' || norm === 'spine') {
      if (!rig.chest) rig.chest = node;
    }
    else if (norm === 'hips') rig.hips = node;
    else if (norm === 'rightarm') rig.rightArm = node;
    else if (norm === 'rightforearm') rig.rightForearm = node;
    else if (norm === 'leftarm') rig.leftArm = node;
    else if (norm === 'leftforearm') rig.leftForearm = node;
    else if (norm === 'rightupleg') rig.rightThigh = node;
    else if (norm === 'leftupleg') rig.leftThigh = node;

    // Detect meshes with facial morph targets (mouthOpen, mouthSmile, etc.)
    if (node.isMesh && node.morphTargetDictionary) {
      rig.morphMeshes.push(node);
    }
  });
}

let blinkTimer = 0;
let gestureCycle = 0;
const _tempCamTarget = new THREE.Vector3();

export function animateRig(delta, elapsed, camera, avatarGroup) {
  // Update skeletal animation mixer if loaded
  if (rig.mixer) {
    rig.mixer.update(delta);
  }

  // 1. Natural Eye/Head Look-At with proper parent-space conversion
  if (rig.head && rig.head.parent) {
    _tempCamTarget.copy(camera.position);
    rig.head.parent.worldToLocal(_tempCamTarget);
    rig.head.lookAt(_tempCamTarget);
  }

  // ===========================================================
  // 1. LISTENING MODE (Attentive posture & chin touch)
  // ===========================================================
  if (AppState.isListening) {
    // Subtle inquisitive head tilt & forward lean
    if (rig.head) {
      rig.head.rotation.z = -0.09;
      rig.head.rotation.x = 0.08;
    }

    // Torso leans forward attentively toward user
    if (rig.chest) {
      rig.chest.rotation.x = 0.07;
      rig.chest.position.z = 0.02;
    }

    // Eyes: Wide open and focused intently
    if (rig.eyeLeft && rig.eyeRight) {
      rig.eyeLeft.scale.set(1.15, 1.25, 1.0);
      rig.eyeRight.scale.set(1.15, 1.25, 1.0);
    }

    // Eyebrows raised slightly with genuine curiosity
    if (rig.browLeft && rig.browRight) {
      rig.browLeft.position.y = 0.075;
      rig.browRight.position.y = 0.075;
    }

    // Hand touches chin thoughtfully
    if (rig.rightArm && rig.rightForearm) {
      rig.rightArm.rotation.x = -1.1;
      rig.rightArm.rotation.z = -0.3;
      rig.rightForearm.rotation.x = -1.2;
    }

    // Left arm rests gently across waist
    if (rig.leftArm && rig.leftForearm) {
      rig.leftArm.rotation.x = -0.4;
      rig.leftArm.rotation.z = 0.35;
      rig.leftForearm.rotation.x = -0.8;
    }

    // Weight shifted stance
    if (rig.leftThigh && rig.rightThigh) {
      rig.leftThigh.rotation.z = -0.05;
      rig.rightThigh.rotation.z = 0.08;
    }

    // Mouth closed in attentive smile
    if (rig.jaw) rig.jaw.position.y = -0.06;
    if (rig.mouth) rig.mouth.scale.set(1.0, 0.7, 1.0);

    // Reset morph targets in listening
    rig.morphMeshes.forEach(mesh => {
      const dict = mesh.morphTargetDictionary;
      const infl = mesh.morphTargetInfluences;
      if (dict && infl) {
        if (dict['mouthOpen'] !== undefined) infl[dict['mouthOpen']] = 0;
        if (dict['mouthSmile'] !== undefined) infl[dict['mouthSmile']] = 0.2;
      }
    });

  // ===========================================================
  // 2. SPEAKING MODE (Eyes, mouth visemes, gesturing arms)
  // ===========================================================
  } else if (AppState.isSpeaking) {
    gestureCycle += delta * 3.5;
    const syllable1 = Math.sin(elapsed * 16);
    const syllable2 = Math.cos(elapsed * 24);
    const speechPower = Math.max(0, (syllable1 * 0.6 + syllable2 * 0.4));

    // EYES: Animated expressive emphasis
    if (rig.eyeLeft && rig.eyeRight) {
      const eyeEmphasis = 1.0 + speechPower * 0.25;
      rig.eyeLeft.scale.set(eyeEmphasis, eyeEmphasis, 1.0);
      rig.eyeRight.scale.set(eyeEmphasis, eyeEmphasis, 1.0);
    }

    // Eyebrow emphasis
    if (rig.browLeft && rig.browRight) {
      const browLift = Math.sin(elapsed * 6) * 0.015;
      rig.browLeft.position.y = 0.065 + Math.max(0, browLift);
      rig.browRight.position.y = 0.065 + Math.max(0, browLift);
    }

    // MOUTH & JAW Lip-Sync
    if (rig.jaw) {
      rig.jaw.position.y = -0.06 - (speechPower * 0.04);
      rig.jaw.rotation.x = speechPower * 0.3;
    }

    if (rig.mouth && !rig.equalizerBars.length) {
      rig.mouth.scale.set(1.0 + speechPower * 0.6, 1.0 + speechPower * 3.5, 1.0);
    }

    // Morph targets for realistic humanoid lip sync
    rig.morphMeshes.forEach(mesh => {
      const dict = mesh.morphTargetDictionary;
      const infl = mesh.morphTargetInfluences;
      if (dict && infl) {
        if (dict['mouthOpen'] !== undefined) {
          infl[dict['mouthOpen']] = speechPower * 0.9;
        }
        if (dict['mouthSmile'] !== undefined) {
          infl[dict['mouthSmile']] = 0.2 + speechPower * 0.2;
        }
      }
    });

    // Equalizer wave for Echo drone
    if (rig.equalizerBars.length) {
      rig.equalizerBars.forEach((bar, i) => {
        const barEnergy = Math.abs(Math.sin(elapsed * (15 + i * 4)));
        bar.scale.y = 1.0 + barEnergy * 4.5;
      });
    }

    // ARMS & HANDS: Dynamic conversational gesticulation!
    if (rig.rightArm && rig.rightForearm) {
      rig.rightArm.rotation.x = -0.6 + Math.sin(gestureCycle) * 0.3;
      rig.rightArm.rotation.z = -0.25 + Math.cos(gestureCycle * 0.8) * 0.15;
      rig.rightForearm.rotation.x = -0.9 + Math.sin(gestureCycle * 1.2) * 0.35;
    }

    if (rig.leftArm && rig.leftForearm) {
      rig.leftArm.rotation.x = -0.5 + Math.cos(gestureCycle * 0.9) * 0.25;
      rig.leftArm.rotation.z = 0.2 + Math.sin(gestureCycle * 0.7) * 0.15;
      rig.leftForearm.rotation.x = -0.7 + Math.cos(gestureCycle * 1.1) * 0.3;
    }

    // HEAD: Conversational nodding
    if (rig.head) {
      rig.head.rotation.x += Math.sin(elapsed * 7) * 0.025;
      rig.head.rotation.y += Math.sin(elapsed * 3) * 0.03;
    }

    // TORSO: Subtle weight shifts
    if (rig.chest) {
      rig.chest.rotation.z = Math.sin(elapsed * 2.5) * 0.025;
      rig.chest.rotation.x = Math.sin(elapsed * 4) * 0.02;
    }

  // ===========================================================
  // 3. IDLE / READY MODE (Natural breathing & relaxed presence)
  // ===========================================================
  } else {
    if (rig.head) {
      rig.head.rotation.z = 0;
    }

    // Subtle breathing
    const breath = Math.sin(elapsed * 2.0);
    if (rig.chest) {
      rig.chest.rotation.x = breath * 0.015;
      rig.chest.rotation.z = 0;
      rig.chest.position.z = 0;
    }

    // Relaxed arms at sides
    if (rig.leftArm && rig.leftForearm) {
      rig.leftArm.rotation.x = -0.05 + breath * 0.03;
      rig.leftArm.rotation.z = 0.08;
      rig.leftForearm.rotation.x = -0.15;
    }

    if (rig.rightArm && rig.rightForearm) {
      rig.rightArm.rotation.x = -0.05 - breath * 0.03;
      rig.rightArm.rotation.z = -0.08;
      rig.rightForearm.rotation.x = -0.15;
    }

    if (rig.leftThigh && rig.rightThigh) {
      rig.leftThigh.rotation.z = 0;
      rig.rightThigh.rotation.z = 0;
    }

    if (rig.jaw) {
      rig.jaw.position.y = -0.06;
      rig.jaw.rotation.x = 0;
    }
    if (rig.mouth && !rig.equalizerBars.length) {
      rig.mouth.scale.set(1, 1, 1);
    }
    if (rig.equalizerBars.length) {
      rig.equalizerBars.forEach(b => b.scale.y = 1.0);
    }

    rig.morphMeshes.forEach(mesh => {
      const dict = mesh.morphTargetDictionary;
      const infl = mesh.morphTargetInfluences;
      if (dict && infl && dict['mouthOpen'] !== undefined) {
        infl[dict['mouthOpen']] = 0;
      }
    });
  }

  // Floating physics for Echo & Spark drones
  if (rig.isFloating) {
    avatarGroup.position.y = (Math.sin(elapsed * 2.5) * 0.035);
    rig.thrusters.forEach((t, i) => {
      t.rotation.z += delta * (i === 0 ? 3 : -3);
    });
  } else {
    avatarGroup.position.y = 0;
  }

  // Periodic Blinking
  blinkTimer += delta;
  if (blinkTimer > 3.6) {
    if (rig.eyeLeft && rig.eyeRight) {
      rig.eyeLeft.scale.y = 0.1;
      rig.eyeRight.scale.y = 0.1;
    }
    if (blinkTimer > 3.75) {
      if (rig.eyeLeft && rig.eyeRight) {
        rig.eyeLeft.scale.y = 1.0;
        rig.eyeRight.scale.y = 1.0;
      }
      blinkTimer = 0;
    }
  }
}
