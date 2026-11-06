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
  equalizerBars: []
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
}

let blinkTimer = 0;
let gestureCycle = 0;
const _tempCamTarget = new THREE.Vector3();

export function animateRig(delta, elapsed, camera, avatarGroup) {
  // 1. Natural Eye/Head Look-At with proper parent-space conversion
  if (rig.head && rig.head.parent) {
    _tempCamTarget.copy(camera.position);
    rig.head.parent.worldToLocal(_tempCamTarget);
    rig.head.lookAt(_tempCamTarget);
  }

  // ===========================================================
  // 1. LISTENING MODE (Head, eyes, hands, body attentively listening)
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

    // Active Listening Hand Gestures: Right hand touches chin thoughtfully
    if (rig.rightArm && rig.rightForearm) {
      rig.rightArm.rotation.x = -1.1;
      rig.rightArm.rotation.z = -0.3;
      rig.rightForearm.rotation.x = -1.2;
    }

    // Left arm rests gently across waist
    if (rig.leftArm && rig.leftForearm) {
      rig.leftArm.rotation.x = -0.3;
      rig.leftArm.rotation.z = 0.25;
      rig.leftForearm.rotation.x = -0.7;
    }

    // Weight shift on legs
    if (rig.leftThigh && rig.rightThigh) {
      rig.leftThigh.rotation.z = -0.04;
      rig.rightThigh.rotation.z = 0.08;
    }

    // Mouth closed in attentive smile
    if (rig.jaw) rig.jaw.position.y = -0.06;
    if (rig.mouth) rig.mouth.scale.set(1.0, 0.7, 1.0);

  // ===========================================================
  // 2. SPEAKING MODE (Eyes, mouth, arms, legs dynamically talking)
  // ===========================================================
  } else if (AppState.isSpeaking) {
    gestureCycle += delta * 3.5;
    const syllable1 = Math.sin(elapsed * 16);
    const syllable2 = Math.cos(elapsed * 24);
    const speechPower = Math.max(0, (syllable1 * 0.6 + syllable2 * 0.4));

    // EYES: Animated expressive blinking & pupil dilation
    if (rig.eyeLeft && rig.eyeRight) {
      const eyeEmphasis = 1.0 + speechPower * 0.25;
      rig.eyeLeft.scale.set(eyeEmphasis, eyeEmphasis, 1.0);
      rig.eyeRight.scale.set(eyeEmphasis, eyeEmphasis, 1.0);
    }

    // Eyebrow conversational emphasis
    if (rig.browLeft && rig.browRight) {
      const browLift = Math.sin(elapsed * 6) * 0.015;
      rig.browLeft.position.y = 0.065 + Math.max(0, browLift);
      rig.browRight.position.y = 0.065 + Math.max(0, browLift);
    }

    // MOUTH & ARTICULATED JAW: Precise syllable lip-sync
    if (rig.jaw) {
      rig.jaw.position.y = -0.06 - (speechPower * 0.04);
      rig.jaw.rotation.x = speechPower * 0.3;
    }

    if (rig.mouth && !rig.equalizerBars.length) {
      rig.mouth.scale.set(1.0 + speechPower * 0.6, 1.0 + speechPower * 3.5, 1.0);
    }

    // Equalizer wave for Echo drone
    if (rig.equalizerBars.length) {
      rig.equalizerBars.forEach((bar, i) => {
        const barEnergy = Math.abs(Math.sin(elapsed * (15 + i * 4)));
        bar.scale.y = 1.0 + barEnergy * 4.5;
      });
    }

    // ARMS & HANDS: Dynamic conversational gesticulation!
    // Right hand emphasizes key words
    if (rig.rightArm && rig.rightForearm) {
      rig.rightArm.rotation.x = -0.6 + Math.sin(gestureCycle) * 0.3;
      rig.rightArm.rotation.z = -0.25 + Math.cos(gestureCycle * 0.8) * 0.15;
      rig.rightForearm.rotation.x = -0.9 + Math.sin(gestureCycle * 1.2) * 0.35;
    }

    // Left hand supports with alternating gestures
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

    // TORSO: Expressive weight shifts
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

    // Relaxed arms at sides with gentle sway
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

    // Natural leg stance
    if (rig.leftThigh && rig.rightThigh) {
      rig.leftThigh.rotation.z = 0;
      rig.rightThigh.rotation.z = 0;
    }

    // Mouth closed in idle
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
