import { resetRig } from './rig.js';
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
}
