// Decoupled Avatar Motion, Locomotion, Kinematics & Autonomous Expressive Gestures
import * as THREE from 'three';
import { AppState } from '../state.js';
import { setBoneRot } from './rig.js';

export const motionState = {
  // Locomotion Coordinates & Navigation
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

  // Expressive Gestures State Machine
  currentGesture: null, // 'wave' | 'dance' | 'stand_on_one_leg' | 'bow' | 'celebrate' | 'think' | 'clap' | 'laugh' | 'jump' | 'nod' | 'shake_head'
  gestureTime: 0,
  gestureDuration: 3.0,
  gestureBlend: 0, // 0.0 to 1.0 smooth ease

  // Autonomous Freestyle Wandering & Spontaneous Gesturing
  freestyle: false,
  nextFreestyleTime: 0
};

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
  if (norm === 'tennis' || norm === 'swing' || norm === 'serve' || norm === 'forehand' || norm === 'racket') valid = 'tennis_swing';
  if (norm === 'wii_cheer' || norm === 'wii_jump' || norm === 'wii_celebrate') valid = 'wii_celebrate';

  const validGestures = [
    'wave', 'dance', 'stand_on_one_leg', 'bow', 'celebrate',
    'think', 'clap', 'laugh', 'jump', 'nod', 'shake_head',
    'tennis_swing', 'wii_celebrate'
  ];
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
 * Immediately halts any active avatar gesture and restores rest pose
 */
export function stopAvatarGesture() {
  motionState.currentGesture = null;
  motionState.gestureTime = 0;
  motionState.gestureDuration = 0;
  motionState.gestureBlend = 0;
  motionState.jumpY = 0;
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

let gestureCycle = 0;
let speechWeight = 0;

/**
 * Evaluates and applies kinematic bone rotations for speech, breathing, walking, and gestures
 */
export function updateMotionKinematics(rig, delta, elapsed) {
  // -----------------------------------------------------------
  // 1. Gesture State Machine & Smooth Easing (Fade-In & Fade-Out)
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
  // 2. Locomotion Navigation & Heading Orientation
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
  // 3. Autonomous Freestyle Mode
  // -----------------------------------------------------------
  if (motionState.freestyle) {
    if (elapsed > motionState.nextFreestyleTime && !motionState.isMoving && !motionState.currentGesture) {
      const roll = Math.random();
      if (roll < 0.42) {
        const style = Math.random() < 0.35 ? 'run' : 'walk';
        moveAvatar('random', style);
      } else if (roll < 0.80) {
        const gestures = ['wave', 'dance', 'stand_on_one_leg', 'celebrate', 'laugh', 'clap', 'think', 'bow', 'tennis_swing', 'wii_celebrate'];
        const pick = gestures[Math.floor(Math.random() * gestures.length)];
        triggerAvatarGesture(pick, 2.8 + Math.random() * 1.5);
      } else {
        triggerAvatarGesture('jump', 1.2);
      }
      motionState.nextFreestyleTime = elapsed + 3.5 + Math.random() * 3.5;
    }
  }

  // -----------------------------------------------------------
  // 4. Base Conversational Dynamics (Speech & Breathing)
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

  const isSkeletal = !!(rig.leftArm && rig.leftArm.isBone);
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

  // Signature Nintendo Wii Sports Buoyant Kinematics
  if (rig && rig.isWii) {
    const wiiBounce = Math.abs(Math.sin(elapsed * 4.0)) * 0.045; // Buoyant tennis ready-bounce
    const wiiSway = Math.sin(elapsed * 2.0) * 0.038;             // Floaty side-to-side weight shift
    const wiiArmBob = Math.sin(elapsed * 4.0 + 0.4) * 0.08;      // Buoyant floating hand spring

    motionState.jumpY += wiiBounce;
    hipSway += wiiSway;
    bodySwivel += wiiSway * 0.5;
    baseChestZ += wiiSway * 0.35;
    baseHeadZ += -wiiSway * 0.45;

    // Tennis ready-stance: elbows bent, hands floating forward attentively
    baseLeftArmX = armAdduction - 0.28 + wiiArmBob * 0.5;
    baseLeftArmZ = 0.22;
    baseLeftForearmX = 0.48 + wiiArmBob;

    baseRightArmX = armAdduction - 0.28 + wiiArmBob * 0.5;
    baseRightArmZ = -0.22;
    baseRightForearmX = 0.58 + wiiArmBob;

    // Slight ready knee bend
    baseLeftThighX = 0.08 - wiiBounce * 0.6;
    baseRightThighX = 0.08 - wiiBounce * 0.6;

    if (rig.racket) {
      rig.racket.rotation.z = -0.3 + Math.sin(elapsed * 4.0) * 0.08;
    }

    smileInfluence = 0.45;
  }

  // A. SPEAKING MODE OVERLAY
  if (speechWeight > 0.01) {
    gestureCycle += delta * 3.5;
    const syllable1 = Math.sin(elapsed * 16);
    const syllable2 = Math.cos(elapsed * 24);
    const speechPower = Math.max(0, (syllable1 * 0.6 + syllable2 * 0.4)) * speechWeight;

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

  // B. LOCOMOTION GAIT BLENDING (Walking & Running)
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

  // C. EXPRESSIVE GESTURES OVERLAY & ANATOMICAL KINEMATICS
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

      // Extend arms horizontally for balance
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

    // 12. TENNIS SWING GESTURE (Wii Sports Tennis Forehand & Serve)
    } else if (gName === 'tennis_swing') {
      const p = Math.min(1.0, gt / (motionState.gestureDuration || 2.4));

      if (p < 0.35) {
        // Backswing coil: rotate hips & shoulders back, racket winds back
        const wind = p / 0.35;
        bodySwivel = lerp(bodySwivel, -0.45, wind);
        hipSway = lerp(hipSway, -0.12, wind);
        gChestY = -0.35 * wind;

        gRightArmX = armAdduction - 0.65 * wind;
        gRightArmY = -0.30 * wind;
        gRightArmZ = -0.75 * wind;
        gRightForearmX = 0.85 * wind;

        gLeftArmX = armAdduction - 0.35 * wind;
        gLeftArmZ = 0.45 * wind;
        gLeftForearmX = 0.35 * wind;

        gHeadY = 0.25 * wind;
        motionState.jumpY = -0.04 * wind;
      } else if (p < 0.70) {
        // Forward power swing arc across body!
        const swing = (p - 0.35) / 0.35;
        bodySwivel = lerp(-0.45, 0.55, swing);
        hipSway = lerp(-0.12, 0.15, swing);
        gChestY = lerp(-0.35, 0.45, swing);

        // Racket slices forward in dynamic arc
        gRightArmX = lerp(armAdduction - 0.65, armAdduction - 0.45, swing);
        gRightArmY = lerp(-0.30, 0.55, swing);
        gRightArmZ = lerp(-0.75, 0.85, swing);
        gRightForearmX = lerp(0.85, 1.15, swing);

        gLeftArmX = armAdduction - 0.45;
        gLeftArmZ = lerp(0.45, -0.25, swing);

        gHeadX = -0.08;
        gHeadY = lerp(0.25, -0.15, swing);
        motionState.jumpY = Math.sin(swing * Math.PI) * 0.08;

        smileInfluence = lerp(smileInfluence, 0.85, gBlend);
        openInfluence = lerp(openInfluence, 0.35, gBlend);
      } else {
        // Follow-through and return to ready stance
        const follow = (p - 0.70) / 0.30;
        bodySwivel = lerp(0.55, 0.0, follow);
        hipSway = lerp(0.15, 0.0, follow);
        gChestY = lerp(0.45, 0.0, follow);

        gRightArmX = lerp(armAdduction - 0.45, baseRightArmX, follow);
        gRightArmY = lerp(0.55, 0.0, follow);
        gRightArmZ = lerp(0.85, baseRightArmZ, follow);
        gRightForearmX = lerp(1.15, baseRightForearmX, follow);

        gLeftArmX = lerp(armAdduction - 0.45, baseLeftArmX, follow);
        gLeftArmZ = lerp(-0.25, baseLeftArmZ, follow);

        gHeadX = lerp(-0.08, 0.0, follow);
        gHeadY = lerp(-0.15, 0.0, follow);
        motionState.jumpY = lerp(0.04, 0.0, follow);
      }

    // 13. WII CELEBRATE / VICTORY CHEER (Wii Sports Match Point Won Hop & Pump)
    } else if (gName === 'wii_celebrate') {
      const hop = Math.abs(Math.sin(gt * 9.5)) * 0.24;
      const hopTwist = Math.sin(gt * 4.8) * 0.18;

      motionState.jumpY = hop;
      bodySwivel = hopTwist;
      hipSway = hopTwist * 0.5;

      // Racket arm pumped triumphantly high
      gRightArmX = armAdduction - 1.45 + Math.sin(gt * 6.0) * 0.12;
      gRightArmZ = -0.65;
      gRightForearmX = 0.45;

      // Left arm high celebration
      gLeftArmX = armAdduction - 1.45 - Math.sin(gt * 6.0) * 0.12;
      gLeftArmZ = 0.65;
      gLeftForearmX = 0.45;

      gChestX = -0.15;
      gHeadX = -0.22;
      smileInfluence = lerp(smileInfluence, 0.95, gBlend);
      openInfluence = lerp(openInfluence, 0.45, gBlend);
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

  // Apply final organic rotations to skeletal and procedural joints
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
  if (rig.morphMeshes && rig.morphMeshes.length > 0) {
    rig.morphMeshes.forEach(mesh => {
      const dict = mesh.morphTargetDictionary;
      const infl = mesh.morphTargetInfluences;
      if (dict && infl) {
        if (dict['mouthOpen'] !== undefined) infl[dict['mouthOpen']] = openInfluence;
        if (dict['mouthSmile'] !== undefined) infl[dict['mouthSmile']] = smileInfluence;
      }
    });
  }
}
