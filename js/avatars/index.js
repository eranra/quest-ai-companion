import {
  resetRig,
  groundAvatar,
  motionState,
  triggerAvatarGesture,
  moveAvatar,
  setFreestyleMode,
  getAvatarMotionStatus,
  resetAvatarMotion
} from './rig.js';
import { buildEchoDrone } from './echo.js';
import { buildSparkDrone } from './spark.js';
import { buildPipCartoon } from './pip.js';
import { buildOllieBot } from './ollie.js';
import { buildMayaHumanoid } from './maya.js';
import { buildAlexHumanoid } from './alex.js';
import { setActiveVoiceId } from '../audio/neural_tts.js';

export const AVATAR_IDS = ['echo', 'spark', 'pip', 'ollie', 'maya', 'alex'];

export const AVATAR_DEFAULT_VOICES = {
  echo: 'en_US-lessac-low',
  spark: 'en_US-danny-low',
  pip: 'en_US-kathleen-low',
  ollie: 'en_US-ryan-low',
  maya: 'en_US-amy-low',
  alex: 'en_US-ryan-low'
};

export function getDefaultVoiceForAvatar(avatarId) {
  return AVATAR_DEFAULT_VOICES[avatarId] || 'en_US-lessac-low';
}

export function buildAvatar(avatarId, avatarGroup) {
  // Clear previous meshes
  while (avatarGroup.children.length > 0) {
    avatarGroup.remove(avatarGroup.children[0]);
  }
  resetRig();

  switch (avatarId) {
    case 'spark':
      buildSparkDrone(avatarGroup);
      break;
    case 'pip':
      buildPipCartoon(avatarGroup);
      break;
    case 'ollie':
      buildOllieBot(avatarGroup);
      break;
    case 'maya':
      buildMayaHumanoid(avatarGroup);
      break;
    case 'alex':
      buildAlexHumanoid(avatarGroup);
      break;
    case 'echo':
    default:
      buildEchoDrone(avatarGroup);
      break;
  }

  // Ensure standing avatar feet are placed directly on top of the floor
  groundAvatar(avatarGroup);
}

export function cycleAvatar(direction = 1, avatarGroup, onAvatarChange) {
  const currentId = localStorage.getItem('quest_avatar_id') || 'echo';
  const index = AVATAR_IDS.indexOf(currentId);
  const nextIndex = (index + direction + AVATAR_IDS.length) % AVATAR_IDS.length;
  const nextId = AVATAR_IDS[nextIndex];
  localStorage.setItem('quest_avatar_id', nextId);
  buildAvatar(nextId, avatarGroup);

  // Automatically align default voice to avatar gender/personality
  const defaultVoice = getDefaultVoiceForAvatar(nextId);
  setActiveVoiceId(defaultVoice);

  if (onAvatarChange) onAvatarChange(nextId, defaultVoice);
  return nextId;
}

export {
  motionState,
  triggerAvatarGesture,
  moveAvatar,
  setFreestyleMode,
  getAvatarMotionStatus,
  resetAvatarMotion
};
