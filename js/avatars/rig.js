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

// Stores initial bind pose rest rotation for any bone or procedural joint
function storeRestRotation(node) {
  if (!node) return;
  if (!node.userData.restRotation) {
    node.userData.restRotation = {
      x: node.rotation.x,
      y: node.rotation.y,
      z: node.rotation.z
    };
  }
}

// Sets rotational offset relative to the bone's rest pose
function setBoneRot(bone, dx = 0, dy = 0, dz = 0) {
  if (!bone) return;
  storeRestRotation(bone);
  const rest = bone.userData.restRotation;
  bone.rotation.x = rest.x + dx;
  bone.rotation.y = rest.y + dy;
  bone.rotation.z = rest.z + dz;
}

// Automatically binds Mixamo / ReadyPlayerMe bones from a loaded glTF scene to rig controls
export function bindBonesFromHierarchy(root) {
  root.traverse((node) => {
    storeRestRotation(node);
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

  // 1. Natural Eye/Head Look-At with proper parent-space conversion (only if no skeletal neck/head)
  if (rig.head && rig.head.parent && !rig.head.isBone) {
    _tempCamTarget.copy(camera.position);
    rig.head.parent.worldToLocal(_tempCamTarget);
    rig.head.lookAt(_tempCamTarget);
  }

  // ===========================================================
  // 1. LISTENING MODE (Attentive posture & chin touch)
  // ===========================================================
  if (AppState.isListening) {
    // Subtle inquisitive head tilt & forward lean
    setBoneRot(rig.head, 0.08, 0, -0.09);

    // Torso leans forward attentively toward user
    setBoneRot(rig.chest, 0.05, 0, 0);

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

    // Hand touches chin thoughtfully (offsets relative to rest pose)
    setBoneRot(rig.rightArm, -0.4, 0, -0.2);
    setBoneRot(rig.rightForearm, -0.6, 0, 0);

    // Left arm rests gently across waist
    setBoneRot(rig.leftArm, -0.15, 0, 0.15);
    setBoneRot(rig.leftForearm, -0.3, 0, 0);

    // Natural standing stance with tiny weight shift (keeps legs 100% attached to hips)
    setBoneRot(rig.leftThigh, 0, 0, -0.02);
    setBoneRot(rig.rightThigh, 0, 0, 0.02);

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

    // ARMS & HANDS: Dynamic conversational gesticulation (additive offsets to rest pose)
    setBoneRot(rig.rightArm, Math.sin(gestureCycle) * 0.2, 0, Math.cos(gestureCycle * 0.8) * 0.1);
    setBoneRot(rig.rightForearm, Math.sin(gestureCycle * 1.2) * 0.25, 0, 0);

    setBoneRot(rig.leftArm, Math.cos(gestureCycle * 0.9) * 0.15, 0, Math.sin(gestureCycle * 0.7) * 0.1);
    setBoneRot(rig.leftForearm, Math.cos(gestureCycle * 1.1) * 0.2, 0, 0);

    // HEAD: Conversational nodding
    setBoneRot(rig.head, Math.sin(elapsed * 7) * 0.03, Math.sin(elapsed * 3) * 0.03, 0);

    // TORSO: Subtle weight shifts
    setBoneRot(rig.chest, Math.sin(elapsed * 4) * 0.015, 0, Math.sin(elapsed * 2.5) * 0.02);

    // Legs firmly grounded in natural stance
    setBoneRot(rig.leftThigh, 0, 0, 0);
    setBoneRot(rig.rightThigh, 0, 0, 0);

  // ===========================================================
  // 3. IDLE / READY MODE (Natural breathing & relaxed presence)
  // ===========================================================
  } else {
    // Subtle breathing
    const breath = Math.sin(elapsed * 2.0);
    setBoneRot(rig.head, 0, 0, 0);
    setBoneRot(rig.chest, breath * 0.012, 0, 0);

    // Relaxed arms at sides
    setBoneRot(rig.leftArm, breath * 0.02, 0, 0);
    setBoneRot(rig.leftForearm, 0, 0, 0);
    setBoneRot(rig.rightArm, -breath * 0.02, 0, 0);
    setBoneRot(rig.rightForearm, 0, 0, 0);

    // Natural leg stance firmly attached to hips
    setBoneRot(rig.leftThigh, 0, 0, 0);
    setBoneRot(rig.rightThigh, 0, 0, 0);

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
