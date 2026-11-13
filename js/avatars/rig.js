// Procedural Avatar Rig, Kinematics, Motion & Conversational Animation Controller
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

export const motionState = {
  // Locomotion
  posX: 0,
  posZ: 0,
  targetX: 0,
  targetZ: 0,
  jumpY: 0,
  headingRotY: 0,
  targetHeadingRotY: 0,
  isMoving: false,
  moveStyle: 'walk', // 'walk' | 'run' | 'jump' | 'step'
  moveSpeed: 1.0,
  walkCycle: 0,

  // Expressive Gestures
  currentGesture: null, // 'wave' | 'dance' | 'stand_on_one_leg' | 'bow' | 'celebrate' | 'think' | 'clap' | 'laugh' | 'jump' | 'nod' | 'shake_head'
  gestureTime: 0,
  gestureDuration: 3.0,
  gestureBlend: 0, // 0.0 to 1.0 smooth ease

  // Autonomous Freestyle Wandering & Spontaneous Gesturing
  freestyle: false,
  nextFreestyleTime: 0
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
export function setBoneRot(bone, dx = 0, dy = 0, dz = 0) {
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

// Calculates dynamic arm adduction based on avatar's rest pose
function getSkeletalArmAdduction(bone) {
  if (!bone || !bone.isBone) return 0.0;
  const restX = bone.userData.restRotation ? bone.userData.restRotation.x : 0;
  return Math.max(0, 0.95 - restX);
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
    const targetMinY = 0.005;
    const diff = targetMinY - box.min.y;
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

/**
 * Trigger an expressive full-body gesture
 */
export function triggerAvatarGesture(gestureName, duration = 3.0) {
  const norm = (gestureName || '').toLowerCase().trim().replace(/[\s-]/g, '_');
  let valid = norm;
  if (norm === 'hands_up' || norm === 'cheer') valid = 'celebrate';
  if (norm === 'balance') valid = 'stand_on_one_leg';
  if (norm === 'ponder') valid = 'think';
  if (norm === 'hop') valid = 'jump';

  const validGestures = ['wave', 'dance', 'stand_on_one_leg', 'bow', 'celebrate', 'think', 'clap', 'laugh', 'jump', 'nod', 'shake_head'];
  if (!validGestures.includes(valid)) {
    valid = 'wave';
  }

  motionState.currentGesture = valid;
  motionState.gestureTime = 0;
  motionState.gestureDuration = Math.max(1.0, duration);
  motionState.gestureBlend = 0;

  return { success: true, gesture: valid, duration: motionState.gestureDuration };
}

/**
 * Move or navigate avatar in scene
 */
export function moveAvatar(direction, style = 'walk', distance = 0.8) {
  const dir = (direction || 'forward').toLowerCase().trim();
  const st = (style || 'walk').toLowerCase().trim();
  const dist = typeof distance === 'number' && !isNaN(distance) ? Math.min(2.0, Math.max(0.2, distance)) : 0.8;

  let dx = 0;
  let dz = 0;

  switch (dir) {
    case 'left':
      dx = -dist;
      break;
    case 'right':
      dx = dist;
      break;
    case 'forward':
    case 'front':
      dz = dist;
      break;
    case 'backward':
    case 'back':
      dz = -dist;
      break;
    case 'center':
    case 'reset':
      motionState.targetX = 0;
      motionState.targetZ = 0;
      motionState.isMoving = true;
      motionState.moveStyle = st;
      return { success: true, targetX: 0, targetZ: 0, style: st };
    case 'random': {
      const randX = (Math.random() - 0.5) * 2.2;
      const randZ = (Math.random() - 0.5) * 1.4;
      motionState.targetX = Math.max(-1.5, Math.min(1.5, randX));
      motionState.targetZ = Math.max(-1.0, Math.min(1.0, randZ));
      motionState.isMoving = true;
      motionState.moveStyle = st;
      return { success: true, targetX: motionState.targetX, targetZ: motionState.targetZ, style: st };
    }
    default:
      dz = dist;
      break;
  }

  // Constrain target within safe bounding box: X [-1.6, 1.6], Z [-1.2, 1.2]
  motionState.targetX = Math.max(-1.6, Math.min(1.6, motionState.posX + dx));
  motionState.targetZ = Math.max(-1.2, Math.min(1.2, motionState.posZ + dz));
  motionState.isMoving = true;
  motionState.moveStyle = st;
  motionState.moveSpeed = st === 'run' ? 1.8 : (st === 'step' ? 0.6 : 1.0);

  if (st === 'jump') {
    triggerAvatarGesture('jump', 1.2);
  }

  return {
    success: true,
    direction: dir,
    style: st,
    targetX: motionState.targetX,
    targetZ: motionState.targetZ
  };
}

/**
 * Enable or disable autonomous freestyle movement mode
 */
export function setFreestyleMode(enabled) {
  motionState.freestyle = !!enabled;
  if (motionState.freestyle) {
    motionState.nextFreestyleTime = 0;
  }
  return { success: true, freestyle: motionState.freestyle };
}

/**
 * Returns current avatar motion and gesture status
 */
export function getAvatarMotionStatus() {
  return {
    currentGesture: motionState.currentGesture,
    gestureBlend: motionState.gestureBlend,
    isMoving: motionState.isMoving,
    moveStyle: motionState.moveStyle,
    posX: motionState.posX,
    posZ: motionState.posZ,
    jumpY: motionState.jumpY,
    freestyle: motionState.freestyle
  };
}

/**
 * Reset avatar motion to center origin
 */
export function resetAvatarMotion() {
  motionState.posX = 0;
  motionState.posZ = 0;
  motionState.targetX = 0;
  motionState.targetZ = 0;
  motionState.jumpY = 0;
  motionState.headingRotY = 0;
  motionState.targetHeadingRotY = 0;
  motionState.isMoving = false;
  motionState.currentGesture = null;
  motionState.gestureTime = 0;
  motionState.gestureDuration = 0;
  motionState.gestureBlend = 0;
  motionState.freestyle = false;
}

let blinkTimer = 0;
let gestureCycle = 0;
let speechWeight = 0;
const _tempCamTarget = new THREE.Vector3();

export function animateRig(delta, elapsed, camera, avatarGroup) {
  if (rig.mixer) {
    rig.mixer.update(delta);
  }

  // 1. Natural Eye/Head Look-At with proper parent-space conversion (only if procedural head)
  if (rig.head && rig.head.parent && !rig.head.isBone) {
    _tempCamTarget.copy(camera.position);
    rig.head.parent.worldToLocal(_tempCamTarget);
    rig.head.lookAt(_tempCamTarget);
  }

  // -----------------------------------------------------------
  // Gesture State Machine & Smooth Easing (Fade-In & Fade-Out)
  // -----------------------------------------------------------
  if (motionState.currentGesture) {
    motionState.gestureTime += delta;
    const dur = motionState.gestureDuration || 3.0;
    const fade = Math.min(0.35, dur * 0.25);

    if (motionState.gestureTime < fade) {
      motionState.gestureBlend = Math.min(1.0, motionState.gestureTime / fade);
    } else if (motionState.gestureTime > dur - fade) {
      motionState.gestureBlend = Math.max(0.0, (dur - motionState.gestureTime) / fade);
    } else {
      motionState.gestureBlend = 1.0;
    }

    if (motionState.gestureTime >= dur) {
      motionState.currentGesture = null;
      motionState.gestureBlend = 0;
      motionState.gestureTime = 0;
      motionState.jumpY = 0;
    }
  } else {
    motionState.gestureBlend = 0;
    motionState.jumpY = 0;
  }

  // -----------------------------------------------------------
  // Locomotion Navigation & Heading Orientation
  // -----------------------------------------------------------
  if (motionState.isMoving) {
    const dx = motionState.targetX - motionState.posX;
    const dz = motionState.targetZ - motionState.posZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.03) {
      const speed = (motionState.moveStyle === 'run' ? 1.6 : (motionState.moveStyle === 'step' ? 0.6 : 0.95)) * delta;
      const step = Math.min(dist, speed);
      motionState.posX += (dx / dist) * step;
      motionState.posZ += (dz / dist) * step;

      // Rotate smoothly to face direction of travel while walking
      motionState.targetHeadingRotY = Math.atan2(dx, dz);
      motionState.walkCycle += delta * (motionState.moveStyle === 'run' ? 9.0 : 5.4);
    } else {
      motionState.posX = motionState.targetX;
      motionState.posZ = motionState.targetZ;
      motionState.isMoving = false;
      motionState.targetHeadingRotY = 0; // Rotate smoothly back to face user
    }
  } else {
    motionState.targetHeadingRotY = 0;
    motionState.walkCycle = lerp(motionState.walkCycle, 0, Math.min(1.0, delta * 4.0));
  }

  motionState.headingRotY = lerp(motionState.headingRotY, motionState.targetHeadingRotY, Math.min(1.0, delta * 5.0));

  // -----------------------------------------------------------
  // Autonomous Freestyle Mode
  // -----------------------------------------------------------
  if (motionState.freestyle) {
    if (elapsed > motionState.nextFreestyleTime && !motionState.isMoving && !motionState.currentGesture) {
      const roll = Math.random();
      if (roll < 0.42) {
        const style = Math.random() < 0.35 ? 'run' : 'walk';
        moveAvatar('random', style);
      } else if (roll < 0.80) {
        const gestures = ['wave', 'dance', 'stand_on_one_leg', 'celebrate', 'laugh', 'clap', 'think', 'bow'];
        const pick = gestures[Math.floor(Math.random() * gestures.length)];
        triggerAvatarGesture(pick, 2.8 + Math.random() * 1.5);
      } else {
        triggerAvatarGesture('jump', 1.2);
      }
      motionState.nextFreestyleTime = elapsed + 3.5 + Math.random() * 3.5;
    }
  }

  // -----------------------------------------------------------
  // Base Conversational Dynamics (Speech & Breathing)
  // -----------------------------------------------------------
  const targetSpeechWeight = AppState.isSpeaking ? 1.0 : 0.0;
  const speechRampSpeed = AppState.isSpeaking ? 6.0 : 2.5;
  speechWeight = lerp(speechWeight, targetSpeechWeight, Math.min(1.0, delta * speechRampSpeed));

  const breath = Math.sin(elapsed * 1.6);
  const breathRise = Math.max(0, breath) * 0.015;

  const weightShift = Math.sin(elapsed * 0.4);
  let hipSway = weightShift * 0.025;
  let bodySwivel = Math.sin(elapsed * 0.28) * 0.06;
  let chestSwivel = Math.sin(elapsed * 0.28 + 0.3) * 0.04;

  const glanceCycle = Math.sin(elapsed * 0.18);
  const microGlanceYaw = glanceCycle > 0.8 ? (glanceCycle - 0.8) * 0.35 : 0;
  const microGlancePitch = Math.sin(elapsed * 0.35) * 0.02;

  const isSkeletal = rig.leftArm && rig.leftArm.isBone;
  const armAdduction = getSkeletalArmAdduction(rig.leftArm);
  const armForwardZ = isSkeletal ? 0.10 : 0.0;

  // Base Bone Rotations to be Blended
  let baseLeftArmX = armAdduction + breathRise * 0.5;
  let baseLeftArmY = 0;
  let baseLeftArmZ = armForwardZ;
  let baseLeftForearmX = !isSkeletal ? 0.12 : 0;
  let baseLeftForearmY = 0;
  let baseLeftForearmZ = isSkeletal ? 0.18 : 0;

  let baseRightArmX = armAdduction - breathRise * 0.5;
  let baseRightArmY = 0;
  let baseRightArmZ = -armForwardZ;
  let baseRightForearmX = !isSkeletal ? 0.12 : 0;
  let baseRightForearmY = 0;
  let baseRightForearmZ = isSkeletal ? -0.18 : 0;

  let baseChestX = breathRise * 1.2;
  let baseChestY = chestSwivel;
  let baseChestZ = hipSway * 0.4;

  let baseHeadX = microGlancePitch - breathRise * 0.3;
  let baseHeadY = microGlanceYaw - bodySwivel * 0.6;
  let baseHeadZ = 0;

  let baseLeftThighX = 0;
  let baseLeftThighZ = -hipSway * 0.6;
  let baseRightThighX = 0;
  let baseRightThighZ = -hipSway * 0.6;

  let smileInfluence = 0.15;
  let openInfluence = 0;

  // ===========================================================
  // A. SPEAKING MODE OVERLAY
  // ===========================================================
  if (speechWeight > 0.01) {
    gestureCycle += delta * 3.5;
    const syllable1 = Math.sin(elapsed * 16);
    const syllable2 = Math.cos(elapsed * 24);
    const speechPower = Math.max(0, (syllable1 * 0.6 + syllable2 * 0.4)) * speechWeight;

    // EYES & EYEBROWS
    if (rig.eyeLeft && rig.eyeRight) {
      const eyeEmphasis = 1.0 + speechPower * 0.25;
      rig.eyeLeft.scale.set(eyeEmphasis, eyeEmphasis, 1.0);
      rig.eyeRight.scale.set(eyeEmphasis, eyeEmphasis, 1.0);
    }
    if (rig.browLeft && rig.browRight) {
      const browLift = Math.sin(elapsed * 6) * 0.015 * speechWeight;
      rig.browLeft.position.y = 0.065 + Math.max(0, browLift);
      rig.browRight.position.y = 0.065 + Math.max(0, browLift);
    }
    if (rig.jaw) {
      rig.jaw.position.y = -0.06 - (speechPower * 0.04);
      rig.jaw.rotation.x = speechPower * 0.3;
    }
    if (rig.mouth && !rig.equalizerBars.length) {
      rig.mouth.scale.set(1.0 + speechPower * 0.6, 1.0 + speechPower * 3.5, 1.0);
    }
    openInfluence = speechPower * 0.9;
    smileInfluence = 0.2 + speechPower * 0.2;

    if (rig.equalizerBars.length) {
      rig.equalizerBars.forEach((bar, i) => {
        const barEnergy = Math.abs(Math.sin(elapsed * (15 + i * 4))) * speechWeight;
        bar.scale.y = 1.0 + barEnergy * 4.5;
      });
    }

    baseLeftArmX = lerp(baseLeftArmX, armAdduction - 0.22 + Math.cos(gestureCycle * 0.9) * 0.15, speechWeight);
    baseLeftArmZ = lerp(baseLeftArmZ, armForwardZ + 0.06 + Math.sin(gestureCycle * 0.7) * 0.08, speechWeight);
    baseLeftForearmZ = isSkeletal ? lerp(0.2, 0.42 + Math.sin(gestureCycle * 1.1) * 0.18, speechWeight) : 0;
    baseLeftForearmX = !isSkeletal ? lerp(0.1, 0.32 + Math.sin(gestureCycle * 1.1) * 0.18, speechWeight) : 0;

    baseRightArmX = lerp(baseRightArmX, armAdduction - 0.25 + Math.sin(gestureCycle) * 0.18, speechWeight);
    baseRightArmZ = lerp(baseRightArmZ, -armForwardZ - 0.06 + Math.cos(gestureCycle * 0.8) * 0.08, speechWeight);
    baseRightForearmZ = isSkeletal ? lerp(-0.2, -0.42 - Math.cos(gestureCycle * 1.2) * 0.18, speechWeight) : 0;
    baseRightForearmX = !isSkeletal ? lerp(0.1, 0.32 + Math.cos(gestureCycle * 1.2) * 0.18, speechWeight) : 0;

    baseHeadX = lerp(baseHeadX, Math.sin(elapsed * 7) * 0.03 + microGlancePitch, speechWeight);
    baseHeadY = lerp(baseHeadY, Math.sin(elapsed * 3) * 0.03 + microGlanceYaw, speechWeight);
    baseChestX = lerp(baseChestX, breathRise + Math.sin(elapsed * 4) * 0.015, speechWeight);
  } else if (AppState.isListening) {
    baseHeadX = 0.06 + microGlancePitch;
    baseHeadY = microGlanceYaw * 0.4;
    baseHeadZ = -0.06;
    baseChestX = 0.04 + breathRise;
    baseLeftArmZ = armForwardZ + 0.04;
    baseRightArmZ = -armForwardZ - 0.04;
    baseLeftForearmZ = isSkeletal ? 0.28 : 0;
    baseRightForearmZ = isSkeletal ? -0.28 : 0;
    smileInfluence = 0.2;
    openInfluence = 0;
  }

  // ===========================================================
  // B. LOCOMOTION GAIT BLENDING (Walking & Running)
  // ===========================================================
  if (motionState.walkCycle !== 0) {
    const walkMult = motionState.moveStyle === 'run' ? 1.6 : 1.0;
    const legSwing = Math.sin(motionState.walkCycle) * 0.38 * walkMult;
    const armSwing = Math.sin(motionState.walkCycle) * 0.32 * walkMult;
    const torsoSway = Math.sin(motionState.walkCycle * 0.5) * 0.05;

    baseLeftThighX += legSwing;
    baseRightThighX -= legSwing;
    baseLeftArmX -= armSwing;
    baseRightArmX += armSwing;
    baseChestY += torsoSway;
    bodySwivel += -torsoSway * 0.8;
  }

  // ===========================================================
  // C. EXPRESSIVE GESTURES OVERLAY & ANATOMICAL KINEMATICS
  // ===========================================================
  const gBlend = motionState.gestureBlend;
  if (gBlend > 0.001) {
    const gName = motionState.currentGesture;
    const gt = motionState.gestureTime;

    let gLeftArmX = baseLeftArmX, gLeftArmY = 0, gLeftArmZ = baseLeftArmZ;
    let gLeftForearmX = baseLeftForearmX, gLeftForearmY = 0, gLeftForearmZ = baseLeftForearmZ;
    let gRightArmX = baseRightArmX, gRightArmY = 0, gRightArmZ = baseRightArmZ;
    let gRightForearmX = baseRightForearmX, gRightForearmY = 0, gRightForearmZ = baseRightForearmZ;
    let gHeadX = baseHeadX, gHeadY = baseHeadY, gHeadZ = baseHeadZ;
    let gChestX = baseChestX, gChestY = baseChestY, gChestZ = baseChestZ;
    let gLeftThighX = baseLeftThighX, gLeftThighZ = baseLeftThighZ;
    let gRightThighX = baseRightThighX, gRightThighZ = baseRightThighZ;

    // 1. WAVE GESTURE
    if (gName === 'wave') {
      const waveOsc = Math.sin(gt * 7.5) * 0.26;
      gRightArmX = armAdduction - 1.15;
      gRightArmZ = -0.65;
      gRightForearmX = !isSkeletal ? 0.3 + waveOsc * 0.2 : 0;
      gRightForearmZ = isSkeletal ? -0.95 + waveOsc * 0.3 : 0;
      gRightForearmY = waveOsc * 0.2;
      gHeadX = 0.04;
      gHeadZ = -0.08;
      smileInfluence = lerp(smileInfluence, 0.65, gBlend);

      if (rig.isFloating) {
        bodySwivel += waveOsc * 0.15;
      }

    // 2. CELEBRATE / HANDS UP GESTURE
    } else if (gName === 'celebrate') {
      const cheerPump = Math.sin(gt * 5.5) * 0.08;
      gLeftArmX = armAdduction - 1.35 + cheerPump;
      gLeftArmZ = 0.82 + cheerPump;
      gLeftForearmZ = isSkeletal ? 0.35 : 0;
      gLeftForearmX = !isSkeletal ? 0.35 : 0;

      gRightArmX = armAdduction - 1.35 + cheerPump;
      gRightArmZ = -0.82 - cheerPump;
      gRightForearmZ = isSkeletal ? -0.35 : 0;
      gRightForearmX = !isSkeletal ? 0.35 : 0;

      gChestX = -0.14;
      gHeadX = -0.18;
      smileInfluence = lerp(smileInfluence, 0.85, gBlend);
      openInfluence = lerp(openInfluence, 0.30, gBlend);

    // 3. DANCE GESTURE (Rhythmic Party Groove)
    } else if (gName === 'dance') {
      const dt = gt * 5.8;
      const danceHip = Math.sin(dt) * 0.18;
      const danceSwivel = Math.cos(dt * 0.5) * 0.20;

      hipSway = lerp(hipSway, danceHip, gBlend);
      bodySwivel = lerp(bodySwivel, danceSwivel, gBlend);
      gChestY = -danceSwivel * 0.6;
      gChestZ = -danceHip * 0.5;

      const armAlt = Math.sin(dt) * 0.42;
      gLeftArmX = armAdduction - 0.75 + armAlt;
      gLeftArmZ = 0.45 + Math.cos(dt) * 0.15;
      gLeftForearmZ = isSkeletal ? 0.42 + Math.sin(dt) * 0.25 : 0;
      gLeftForearmX = !isSkeletal ? 0.42 + Math.sin(dt) * 0.25 : 0;

      gRightArmX = armAdduction - 0.75 - armAlt;
      gRightArmZ = -0.45 - Math.cos(dt) * 0.15;
      gRightForearmZ = isSkeletal ? -0.42 - Math.sin(dt) * 0.25 : 0;
      gRightForearmX = !isSkeletal ? 0.42 + Math.sin(dt) * 0.25 : 0;

      gLeftThighX = Math.sin(dt) * 0.22;
      gRightThighX = -Math.sin(dt) * 0.22;
      gHeadX = Math.abs(Math.sin(dt)) * 0.10;
      smileInfluence = lerp(smileInfluence, 0.75, gBlend);

      if (rig.equalizerBars.length) {
        rig.equalizerBars.forEach((b, idx) => {
          b.scale.y = 1.0 + Math.abs(Math.sin(dt * 2 + idx)) * 4.0;
        });
      }

    // 4. STAND ON ONE LEG / BALANCE GESTURE
    } else if (gName === 'stand_on_one_leg') {
      const balanceWobble = Math.sin(gt * 7.5) * 0.05;
      hipSway = lerp(hipSway, -0.15, gBlend);
      bodySwivel = lerp(bodySwivel, 0.04, gBlend);
      gChestZ = 0.12 + balanceWobble;

      // Lift left thigh 80 degrees up
      gLeftThighX = -1.25;
      gLeftThighZ = 0.12;

      // Extend arms horizontally for balance with delicate micro-adjustments
      gLeftArmX = armAdduction - 0.55 + balanceWobble;
      gLeftArmZ = 1.05 + balanceWobble * 0.6;
      gLeftForearmZ = isSkeletal ? 0.22 : 0;

      gRightArmX = armAdduction - 0.55 - balanceWobble;
      gRightArmZ = -1.05 - balanceWobble * 0.6;
      gRightForearmZ = isSkeletal ? -0.22 : 0;

      gHeadZ = 0.05 + balanceWobble * 0.5;
      smileInfluence = lerp(smileInfluence, 0.45, gBlend);

    // 5. BOW GESTURE
    } else if (gName === 'bow') {
      const bowProgress = Math.sin(Math.min(1.0, gt / motionState.gestureDuration) * Math.PI);
      gChestX = 0.44 * bowProgress;
      gHeadX = 0.28 * bowProgress;

      gRightArmX = armAdduction - 0.45 * bowProgress;
      gRightArmY = 0.28 * bowProgress;
      gRightArmZ = -0.65 * bowProgress;
      gRightForearmZ = isSkeletal ? -0.75 * bowProgress : 0;
      gRightForearmX = !isSkeletal ? 0.75 * bowProgress : 0;

    // 6. THINK / PONDER GESTURE
    } else if (gName === 'think') {
      gRightArmX = armAdduction - 0.92;
      gRightArmY = 0.22;
      gRightArmZ = -0.32;
      gRightForearmZ = isSkeletal ? -1.25 : 0;
      gRightForearmX = !isSkeletal ? 0.95 : 0;

      gLeftArmX = armAdduction - 0.32;
      gLeftArmZ = 0.32;
      gLeftForearmZ = isSkeletal ? 0.65 : 0;
      gLeftForearmX = !isSkeletal ? 0.65 : 0;

      gHeadX = -0.14;
      gHeadY = 0.18;
      gHeadZ = -0.08;

      if (rig.browLeft && rig.browRight) {
        rig.browRight.position.y = 0.08;
      }

    // 7. CLAP GESTURE
    } else if (gName === 'clap') {
      const clapAmp = Math.abs(Math.sin(gt * 15.0)) * 0.24;
      gLeftArmX = armAdduction - 0.65;
      gLeftArmZ = 0.48 - clapAmp;
      gLeftForearmZ = isSkeletal ? 0.75 - clapAmp * 0.5 : 0;
      gLeftForearmX = !isSkeletal ? 0.75 - clapAmp * 0.5 : 0;

      gRightArmX = armAdduction - 0.65;
      gRightArmZ = -0.48 + clapAmp;
      gRightForearmZ = isSkeletal ? -0.75 + clapAmp * 0.5 : 0;
      gRightForearmX = !isSkeletal ? 0.75 - clapAmp * 0.5 : 0;

      gChestX = -0.06;
      gHeadX = Math.sin(gt * 7.5) * 0.06;
      smileInfluence = lerp(smileInfluence, 0.80, gBlend);

    // 8. LAUGH GESTURE
    } else if (gName === 'laugh') {
      const laughShake = Math.sin(gt * 18.0) * 0.06;
      gChestX = -0.08 + laughShake;
      gHeadX = -0.22 + laughShake * 0.5;
      gLeftArmX = armAdduction - 0.25 + laughShake * 0.5;
      gRightArmX = armAdduction - 0.25 + laughShake * 0.5;

      smileInfluence = lerp(smileInfluence, 0.95, gBlend);
      openInfluence = lerp(openInfluence, 0.45 + laughShake * 2.0, gBlend);

    // 9. JUMP GESTURE
    } else if (gName === 'jump') {
      const progress = Math.min(1.0, gt / (motionState.gestureDuration || 1.2));
      if (progress < 0.18) {
        // Crouch anticipation
        const crouch = progress / 0.18;
        motionState.jumpY = -0.08 * crouch;
        gLeftThighX = 0.25 * crouch;
        gRightThighX = 0.25 * crouch;
        gLeftArmX = armAdduction + 0.35 * crouch;
        gRightArmX = armAdduction + 0.35 * crouch;
      } else if (progress < 0.82) {
        // Airborne leap arc
        const p = (progress - 0.18) / 0.64;
        motionState.jumpY = Math.sin(p * Math.PI) * 0.38;
        gLeftThighX = -0.15;
        gRightThighX = -0.15;
        gLeftArmX = armAdduction - 0.85;
        gRightArmX = armAdduction - 0.85;
        gLeftArmZ = 0.45;
        gRightArmZ = -0.45;
      } else {
        // Landing absorption
        const land = (progress - 0.82) / 0.18;
        motionState.jumpY = lerp(-0.06, 0.0, land);
        gLeftThighX = lerp(0.2, 0.0, land);
        gRightThighX = lerp(0.2, 0.0, land);
      }
      smileInfluence = lerp(smileInfluence, 0.70, gBlend);

    // 10. NOD GESTURE
    } else if (gName === 'nod') {
      gHeadX = Math.sin(gt * 10.0) * 0.18;
      smileInfluence = lerp(smileInfluence, 0.45, gBlend);

    // 11. SHAKE HEAD GESTURE
    } else if (gName === 'shake_head') {
      gHeadY = Math.sin(gt * 8.0) * 0.22;
    }

    // Blend gesture bones with base pose smoothly
    baseLeftArmX = lerp(baseLeftArmX, gLeftArmX, gBlend);
    baseLeftArmY = lerp(baseLeftArmY, gLeftArmY, gBlend);
    baseLeftArmZ = lerp(baseLeftArmZ, gLeftArmZ, gBlend);

    baseLeftForearmX = lerp(baseLeftForearmX, gLeftForearmX, gBlend);
    baseLeftForearmY = lerp(baseLeftForearmY, gLeftForearmY, gBlend);
    baseLeftForearmZ = lerp(baseLeftForearmZ, gLeftForearmZ, gBlend);

    baseRightArmX = lerp(baseRightArmX, gRightArmX, gBlend);
    baseRightArmY = lerp(baseRightArmY, gRightArmY, gBlend);
    baseRightArmZ = lerp(baseRightArmZ, gRightArmZ, gBlend);

    baseRightForearmX = lerp(baseRightForearmX, gRightForearmX, gBlend);
    baseRightForearmY = lerp(baseRightForearmY, gRightForearmY, gBlend);
    baseRightForearmZ = lerp(baseRightForearmZ, gRightForearmZ, gBlend);

    baseHeadX = lerp(baseHeadX, gHeadX, gBlend);
    baseHeadY = lerp(baseHeadY, gHeadY, gBlend);
    baseHeadZ = lerp(baseHeadZ, gHeadZ, gBlend);

    baseChestX = lerp(baseChestX, gChestX, gBlend);
    baseChestY = lerp(baseChestY, gChestY, gBlend);
    baseChestZ = lerp(baseChestZ, gChestZ, gBlend);

    baseLeftThighX = lerp(baseLeftThighX, gLeftThighX, gBlend);
    baseLeftThighZ = lerp(baseLeftThighZ, gLeftThighZ, gBlend);

    baseRightThighX = lerp(baseRightThighX, gRightThighX, gBlend);
    baseRightThighZ = lerp(baseRightThighZ, gRightThighZ, gBlend);
  }

  // Apply final organic rotations to skeletal joints
  setBoneRot(rig.hips, 0, bodySwivel, hipSway);
  setBoneRot(rig.chest, baseChestX, baseChestY, baseChestZ);
  setBoneRot(rig.head, baseHeadX, baseHeadY, baseHeadZ);

  setBoneRot(rig.leftArm, baseLeftArmX, baseLeftArmY, baseLeftArmZ);
  setBoneRot(rig.leftForearm, baseLeftForearmX, baseLeftForearmY, baseLeftForearmZ);

  setBoneRot(rig.rightArm, baseRightArmX, baseRightArmY, baseRightArmZ);
  setBoneRot(rig.rightForearm, baseRightForearmX, baseRightForearmY, baseRightForearmZ);

  setBoneRot(rig.leftThigh, baseLeftThighX, 0, baseLeftThighZ);
  setBoneRot(rig.rightThigh, baseRightThighX, 0, baseRightThighZ);

  // Apply Facial Morphs
  rig.morphMeshes.forEach(mesh => {
    const dict = mesh.morphTargetDictionary;
    const infl = mesh.morphTargetInfluences;
    if (dict && infl) {
      if (dict['mouthOpen'] !== undefined) infl[dict['mouthOpen']] = openInfluence;
      if (dict['mouthSmile'] !== undefined) infl[dict['mouthSmile']] = smileInfluence;
    }
  });

  // -----------------------------------------------------------
  // Apply World Locomotion & Height to avatarGroup
  // -----------------------------------------------------------
  if (avatarGroup) {
    const baseHeight = AppState.avatarHeightOffset || 0.0;
    const baseZ = (avatarGroup.userData && avatarGroup.userData.baseZ !== undefined) ? avatarGroup.userData.baseZ : 0.0;

    avatarGroup.position.x = motionState.posX;
    avatarGroup.position.z = (baseZ - AppState.avatarDistance) + motionState.posZ;

    if (rig.isFloating) {
      avatarGroup.position.y = baseHeight + (Math.sin(elapsed * 2.5) * 0.035) + motionState.jumpY;
      rig.thrusters.forEach((t, i) => {
        t.rotation.z += delta * (i === 0 ? 3 : -3);
      });
    } else {
      avatarGroup.position.y = baseHeight + motionState.jumpY;
    }

    avatarGroup.rotation.y = AppState.avatarRotationY + motionState.headingRotY;
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
