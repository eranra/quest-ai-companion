// Procedural Avatar Rig, Bone Hierarchy & Grounding Manager
import * as THREE from 'three';
import { AppState } from '../state.js';
import {
  motionState,
  triggerAvatarGesture,
  moveAvatar,
  setFreestyleMode,
  getAvatarMotionStatus,
  resetAvatarMotion,
  updateMotionKinematics
} from './motion.js';

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
  browReset();
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
    try {
      rig.mixer.stopAllAction();
    } catch (e) {}
    rig.mixer = null;
  }

  // Ensure any gesture in flight is cleanly reset across avatar switches
  motionState.currentGesture = null;
  motionState.gestureTime = 0;
  motionState.gestureDuration = 0;
  motionState.gestureBlend = 0;
  motionState.jumpY = 0;
}

function browReset() {
  rig.browLeft = null;
  rig.browRight = null;
}

// Stores initial bind pose rest rotation for any bone or procedural joint
export function storeRestRotation(node) {
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

// Automatically binds Mixamo / ReadyPlayerMe bones from a loaded glTF scene to rig controls
export function bindBonesFromHierarchy(root) {
  if (!root) return;
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

// Grounding helper ensuring the avatar root node's lowest boundary rests precisely on top of the floor
export function groundAvatar(target) {
  if (!target || rig.isFloating) return;
  target.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(target);
  if (isFinite(box.min.y)) {
    const targetMinY = 0.005;
    const diff = targetMinY - box.min.y;
    if (Math.abs(diff) > 0.001) {
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
}

let blinkTimer = 0;
const _tempCamTarget = new THREE.Vector3();

export function animateRig(delta, elapsed, camera, avatarGroup) {
  // 1. Skeletal Mixamo Mixer animation:
  // When active full-body gestures are executing, blend down mixer influence to avoid fighting arm/leg kinematics
  if (rig.mixer) {
    const mixerWeight = Math.max(0.0, 1.0 - motionState.gestureBlend);
    if (mixerWeight > 0.01) {
      rig.mixer.update(delta * mixerWeight);
    }
  }

  // 2. Natural Eye/Head Look-At with proper parent-space conversion (only if procedural head without active head gesture)
  if (rig.head && rig.head.parent && !rig.head.isBone && camera) {
    storeRestRotation(rig.head);
    if (motionState.gestureBlend < 0.2) {
      _tempCamTarget.copy(camera.position);
      rig.head.parent.worldToLocal(_tempCamTarget);
      rig.head.lookAt(_tempCamTarget);
    }
  }

  // 3. Update Kinematics, Gestures, Speech Overlays, and Gait
  updateMotionKinematics(rig, delta, elapsed);

  // 4. Apply World Locomotion & Height to avatarGroup
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

  // 5. Periodic Blinking (Natural 3.6s cycle with fast 140ms close-open)
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

// Re-export motion utilities so existing callers maintain backwards compatibility
export {
  motionState,
  triggerAvatarGesture,
  moveAvatar,
  setFreestyleMode,
  getAvatarMotionStatus,
  resetAvatarMotion,
  updateMotionKinematics
};
