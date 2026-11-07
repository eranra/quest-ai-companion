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

// Smooth linear interpolation
function lerp(a, b, t) {
  return a + (b - a) * t;
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

// Grounding helper ensuring the avatar's shoes/feet rest precisely on top of the ground plane
export function groundAvatar(target) {
  if (!target || rig.isFloating) return;
  target.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(target);
  if (isFinite(box.min.y)) {
    // 0.005 ensures shoes are strictly on top of the floor and not clipped into ground
    const targetMinY = 0.005;
    const diff = targetMinY - box.min.y;
    // Shift the child root inside avatarGroup so avatarGroup anchor remains at y=0
    if (target.children && target.children.length > 0) {
      target.children.forEach(c => {
        c.position.y += diff;
      });
    } else {
      target.position.y += diff;
    }
    target.updateMatrixWorld(true);
  }
}

let blinkTimer = 0;
let gestureCycle = 0;
let speechWeight = 0; // Lerps smoothly between 0 (idle/listening) and 1 (speaking)
const _tempCamTarget = new THREE.Vector3();

export function animateRig(delta, elapsed, camera, avatarGroup) {
  // Update skeletal animation mixer if loaded
  if (rig.mixer) {
    rig.mixer.update(delta);
  }

  // 1. Natural Eye/Head Look-At with proper parent-space conversion (only if procedural head)
  if (rig.head && rig.head.parent && !rig.head.isBone) {
    _tempCamTarget.copy(camera.position);
    rig.head.parent.worldToLocal(_tempCamTarget);
    rig.head.lookAt(_tempCamTarget);
  }

  // Smooth speech state transition:
  // When speaking starts, ramp up quickly. When speaking stops, smoothly ease down over ~0.6s
  const targetSpeechWeight = AppState.isSpeaking ? 1.0 : 0.0;
  const speechRampSpeed = AppState.isSpeaking ? 6.0 : 2.5;
  speechWeight = lerp(speechWeight, targetSpeechWeight, Math.min(1.0, delta * speechRampSpeed));

  // Organic Lifelike Idle Dynamics (running continuously so avatars always feel alive):
  // 1. Natural human breathing cycle (approx. 14 breaths per minute)
  const breath = Math.sin(elapsed * 1.6);
  const breathRise = Math.max(0, breath) * 0.015;

  // 2. Subtle weight-shift between left and right feet (approx. 7-8 second cycle)
  const weightShift = Math.sin(elapsed * 0.4);
  const hipSway = weightShift * 0.025;

  // 3. Alive body swivel / turning slightly (subtle natural sway while still facing user)
  const bodySwivel = Math.sin(elapsed * 0.28) * 0.06; // +/- 3.5 degrees
  const chestSwivel = Math.sin(elapsed * 0.28 + 0.3) * 0.04;

  // 4. Micro look-around curiosity glances
  const glanceCycle = Math.sin(elapsed * 0.18);
  const microGlanceYaw = glanceCycle > 0.8 ? (glanceCycle - 0.8) * 0.35 : 0;
  const microGlancePitch = Math.sin(elapsed * 0.35) * 0.02;

  // Apply base organic alive motion to hips & chest (additive to rest pose)
  setBoneRot(rig.hips, 0, bodySwivel, hipSway);

  // ===========================================================
  // A. SPEAKING MODE (Full speech or decaying smoothly back)
  // ===========================================================
  if (speechWeight > 0.01) {
    gestureCycle += delta * 3.5;
    const syllable1 = Math.sin(elapsed * 16);
    const syllable2 = Math.cos(elapsed * 24);
    const speechPower = Math.max(0, (syllable1 * 0.6 + syllable2 * 0.4)) * speechWeight;

    // EYES: Animated expressive emphasis
    if (rig.eyeLeft && rig.eyeRight) {
      const eyeEmphasis = 1.0 + speechPower * 0.25;
      rig.eyeLeft.scale.set(eyeEmphasis, eyeEmphasis, 1.0);
      rig.eyeRight.scale.set(eyeEmphasis, eyeEmphasis, 1.0);
    }

    // Eyebrow conversational emphasis
    if (rig.browLeft && rig.browRight) {
      const browLift = Math.sin(elapsed * 6) * 0.015 * speechWeight;
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
        const barEnergy = Math.abs(Math.sin(elapsed * (15 + i * 4))) * speechWeight;
        bar.scale.y = 1.0 + barEnergy * 4.5;
      });
    }

    // ARMS & HANDS: Dynamic conversational gesticulation blended smoothly from relaxed rest pose
    const isSkeletal = rig.leftArm && rig.leftArm.isBone;
    const armAdduction = isSkeletal ? 0.85 : 0.0;

    const rightArmX = lerp(armAdduction + breathRise, armAdduction - 0.35 + Math.sin(gestureCycle) * 0.22, speechWeight);
    const rightArmZ = lerp(-0.02, -0.06 + Math.cos(gestureCycle * 0.8) * 0.1, speechWeight);
    const rightForearmX = lerp(isSkeletal ? 0.18 : 0.08, 0.35 + Math.sin(gestureCycle * 1.2) * 0.25, speechWeight);

    const leftArmX = lerp(armAdduction + breathRise, armAdduction - 0.28 + Math.cos(gestureCycle * 0.9) * 0.18, speechWeight);
    const leftArmZ = lerp(0.02, 0.06 + Math.sin(gestureCycle * 0.7) * 0.1, speechWeight);
    const leftForearmX = lerp(isSkeletal ? 0.18 : 0.08, 0.32 + Math.cos(gestureCycle * 1.1) * 0.22, speechWeight);

    setBoneRot(rig.rightArm, rightArmX, 0, rightArmZ);
    setBoneRot(rig.rightForearm, rightForearmX, 0, 0);
    setBoneRot(rig.leftArm, leftArmX, 0, leftArmZ);
    setBoneRot(rig.leftForearm, leftForearmX, 0, 0);

    // HEAD: Conversational nodding blended with alive look-around
    const headNod = Math.sin(elapsed * 7) * 0.03 * speechWeight;
    const headTurn = Math.sin(elapsed * 3) * 0.03 * speechWeight;
    setBoneRot(rig.head, headNod + microGlancePitch, headTurn + microGlanceYaw, 0);

    // TORSO: Breathing + alive swivel
    setBoneRot(rig.chest, breathRise + Math.sin(elapsed * 4) * 0.015 * speechWeight, chestSwivel, hipSway * 0.5);

    // Legs firmly grounded in natural stance, counter-balancing hip sway
    setBoneRot(rig.leftThigh, 0, 0, -hipSway * 0.6);
    setBoneRot(rig.rightThigh, 0, 0, -hipSway * 0.6);

  // ===========================================================
  // B. LISTENING MODE (Attentive posture & relaxed arms near body)
  // ===========================================================
  } else if (AppState.isListening) {
    const isSkeletal = rig.leftArm && rig.leftArm.isBone;
    const armAdduction = isSkeletal ? 0.85 : 0.0;

    // Subtle inquisitive head tilt & forward lean
    setBoneRot(rig.head, 0.06 + microGlancePitch, microGlanceYaw * 0.4, -0.06);

    // Torso leans forward attentively toward user while breathing gently
    setBoneRot(rig.chest, 0.04 + breathRise, chestSwivel, hipSway * 0.4);

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

    // Natural attentive arms resting comfortably close to hips/waist (no wide elbow flaring)
    setBoneRot(rig.rightArm, armAdduction + 0.04 + breathRise * 0.5, 0, -0.03);
    setBoneRot(rig.rightForearm, isSkeletal ? 0.22 : 0.12, 0, 0);

    setBoneRot(rig.leftArm, armAdduction + 0.04 + breathRise * 0.5, 0, 0.03);
    setBoneRot(rig.leftForearm, isSkeletal ? 0.22 : 0.12, 0, 0);

    // Natural standing stance with weight shift (keeps legs 100% attached to hips)
    setBoneRot(rig.leftThigh, 0, 0, -hipSway * 0.6);
    setBoneRot(rig.rightThigh, 0, 0, -hipSway * 0.6);

    // Mouth closed in attentive smile
    if (rig.jaw) {
      rig.jaw.position.y = -0.06;
      rig.jaw.rotation.x = 0;
    }
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
  // C. IDLE / READY MODE (Organic alive breathing, weight shift & turns)
  // ===========================================================
  } else {
    const isSkeletal = rig.leftArm && rig.leftArm.isBone;
    const armAdduction = isSkeletal ? 0.85 : 0.0;

    // Head: alive micro glances + soft breathing compensation
    setBoneRot(rig.head, microGlancePitch - breathRise * 0.3, microGlanceYaw - bodySwivel * 0.6, 0);

    // Chest: organic breathing + gentle swivel
    setBoneRot(rig.chest, breathRise * 1.2, chestSwivel, hipSway * 0.4);

    // Relaxed arms at sides with subtle breathing motion and natural rest drape
    setBoneRot(rig.leftArm, armAdduction + breathRise * 0.8, 0, 0.02);
    setBoneRot(rig.leftForearm, isSkeletal ? 0.16 : 0.08, 0, 0);
    setBoneRot(rig.rightArm, armAdduction - breathRise * 0.8, 0, -0.02);
    setBoneRot(rig.rightForearm, isSkeletal ? 0.16 : 0.08, 0, 0);

    // Natural leg stance firmly attached to hips with subtle weight shift
    setBoneRot(rig.leftThigh, 0, 0, -hipSway * 0.6);
    setBoneRot(rig.rightThigh, 0, 0, -hipSway * 0.6);

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
      if (dict && infl) {
        if (dict['mouthOpen'] !== undefined) infl[dict['mouthOpen']] = 0;
        if (dict['mouthSmile'] !== undefined) infl[dict['mouthSmile']] = 0.15;
      }
    });
  }

  // Floating physics for Echo drone
  if (rig.isFloating) {
    avatarGroup.position.y = (Math.sin(elapsed * 2.5) * 0.035);
    rig.thrusters.forEach((t, i) => {
      t.rotation.z += delta * (i === 0 ? 3 : -3);
    });
  } else {
    // Firmly grounded on the physical floor
    avatarGroup.position.y = 0;
  }

  // Periodic Blinking (Natural 3.6s cycle with fast 140ms close-open)
  blinkTimer += delta;
  if (blinkTimer > 3.6) {
    if (rig.eyeLeft && rig.eyeRight) {
      rig.eyeLeft.scale.y = 0.1;
      rig.eyeRight.scale.y = 0.1;
    }
    if (blinkTimer > 3.74) {
      if (rig.eyeLeft && rig.eyeRight) {
        rig.eyeLeft.scale.y = 1.0;
        rig.eyeRight.scale.y = 1.0;
      }
      blinkTimer = 0;
    }
  }
}
