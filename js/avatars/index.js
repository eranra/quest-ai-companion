import { resetRig, groundAvatar } from './rig.js';
import { buildEchoDrone } from './echo.js';
import { buildSparkDrone } from './spark.js';
import { buildPipCartoon } from './pip.js';
import { buildOllieBot } from './ollie.js';
import { buildMayaHumanoid } from './maya.js';
import { buildAlexHumanoid } from './alex.js';

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

export const AVATAR_IDS = ['echo', 'spark', 'pip', 'ollie', 'maya', 'alex'];

export function cycleAvatar(direction = 1, avatarGroup) {
  const currentId = localStorage.getItem('quest_avatar_id') || 'echo';
  const index = AVATAR_IDS.indexOf(currentId);
  const nextIndex = (index + direction + AVATAR_IDS.length) % AVATAR_IDS.length;
  const nextId = AVATAR_IDS[nextIndex];
  localStorage.setItem('quest_avatar_id', nextId);
  buildAvatar(nextId, avatarGroup);
  return nextId;
}
