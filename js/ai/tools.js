// Agent Tool Registry & Execution Engine
// Provides browser environment sensing (time, battery, specs) and 3D scene control (spaces, avatars, camera)
import { AppState } from '../state.js';
import { logDebug } from '../ui/debug_logger.js';

export const AVATAR_IDS = ['echo', 'spark', 'pip', 'ollie', 'maya', 'alex'];
export const SPACE_IDS = ['hall', 'garden', 'penthouse', 'cafe', 'passthrough'];
export const AVATAR_VOICES = {
  echo: 'en_US-kathleen-low',
  spark: 'en_US-ryan-low',
  pip: 'en_US-amy-low',
  ollie: 'en_US-ryan-low',
  maya: 'en_US-amy-low',
  alex: 'en_US-ryan-low'
};

const sceneHooks = {
  switchSpace: null,
  buildAvatar: null,
  applyAvatarTransform: null,
  getDefaultVoiceForAvatar: (id) => AVATAR_VOICES[id] || 'en_US-amy-low',
  setActiveVoiceId: null,
  flipAvatarOrientation: null,
  resetCameraView: null,
  getAvatarGroup: () => null,
  triggerAvatarGesture: null,
  moveAvatar: null,
  setFreestyleMode: null,
  getAvatarMotionStatus: null
};

export function registerSceneHooks(hooks) {
  Object.assign(sceneHooks, hooks);
}

export const TOOL_DEFINITIONS = [
  {
    name: 'get_time',
    description: 'Get current real-world local time, day of the week, full date, and timezone.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_battery',
    description: 'Get device battery level percentage and charging status.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_system_info',
    description: 'Get headset system information including CPU cores, memory heap, network status, and active engine.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'change_space',
    description: 'Change the 3D environment space. Available spaces: "hall" (Sci-Fi Hall), "garden" (Zen Garden), "penthouse" (Cyberpunk Penthouse), "cafe" (Parisian Cafe), "passthrough" (Real Room / Mixed Reality Passthrough).',
    parameters: {
      type: 'OBJECT',
      properties: {
        space: {
          type: 'STRING',
          description: 'The target space identifier: "hall", "garden", "penthouse", "cafe", or "passthrough".'
        }
      },
      required: ['space']
    }
  },
  {
    name: 'change_avatar',
    description: 'Change the active 3D avatar character. Available avatars: "maya" (Empathetic Guide), "alex" (Adventurer), "ollie" (Robot Sidekick), "echo" (Holo Drone), "spark" (Spark Drone), "pip" (Cartoon Character).',
    parameters: {
      type: 'OBJECT',
      properties: {
        avatar: {
          type: 'STRING',
          description: 'The target avatar identifier: "maya", "alex", "ollie", "echo", "spark", or "pip".'
        }
      },
      required: ['avatar']
    }
  },
  {
    name: 'recenter_view',
    description: 'Recenter the 3D camera view and reset avatar positioning.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_companion_status',
    description: 'Get the current status of the companion: active character, active space, audio mode, and session uptime.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'avatar_gesture',
    description: 'Perform an expressive full-body gesture with the 3D avatar in the scene. Available gestures: "wave" (friendly greeting), "dance" (rhythmic party dance), "stand_on_one_leg" (balance on one foot), "bow" (polite formal bow), "celebrate" or "hands_up" (raise arms high in victory), "think" (hand to chin contemplating), "clap" (applaud), "laugh" (joyous laughter), "jump" (energetic hop), "nod" (affirmative agreement), "shake_head" (disagreement).',
    parameters: {
      type: 'OBJECT',
      properties: {
        gesture: {
          type: 'STRING',
          description: 'The gesture identifier: "wave", "dance", "stand_on_one_leg", "bow", "celebrate", "hands_up", "think", "clap", "laugh", "jump", "nod", or "shake_head".'
        },
        duration: {
          type: 'NUMBER',
          description: 'Optional duration in seconds (default 3.0).'
        }
      },
      required: ['gesture']
    }
  },
  {
    name: 'avatar_move',
    description: 'Move or navigate the 3D avatar within the virtual scene. Directions: "left", "right", "forward", "backward", "center", "random". Styles: "walk" (normal gait), "run" (faster stride), "jump" (vertical hop), "step" (small relocation).',
    parameters: {
      type: 'OBJECT',
      properties: {
        direction: {
          type: 'STRING',
          description: 'The movement direction: "left", "right", "forward", "backward", "center", or "random".'
        },
        style: {
          type: 'STRING',
          description: 'The movement style: "walk", "run", "jump", or "step" (default "walk").'
        },
        distance: {
          type: 'NUMBER',
          description: 'Optional distance in meters (default 0.8).'
        }
      },
      required: ['direction']
    }
  },
  {
    name: 'avatar_freestyle',
    description: 'Enable or disable autonomous freestyle movement mode. When enabled, the avatar autonomously explores the scene, wanders around, hops, jumps, and performs spontaneous gestures.',
    parameters: {
      type: 'OBJECT',
      properties: {
        enabled: {
          type: 'BOOLEAN',
          description: 'Whether freestyle mode is active (true to start autonomous movement and gestures, false to stay in place).'
        }
      },
      required: ['enabled']
    }
  }
];

/**
 * Returns Gemini-compatible tool declarations
 */
export function getGeminiToolDeclarations() {
  return [
    {
      functionDeclarations: TOOL_DEFINITIONS.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }))
    }
  ];
}

/**
 * Gathers live environment context for local LLM system prompt grounding
 */
export async function getLiveEnvironmentContext() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';

  let batteryInfo = 'unavailable';
  if (typeof navigator !== 'undefined' && navigator.getBattery) {
    try {
      const battery = await navigator.getBattery();
      const pct = Math.round(battery.level * 100);
      batteryInfo = `${pct}% (${battery.charging ? 'charging' : 'on battery'})`;
    } catch {
      batteryInfo = 'standard power';
    }
  }

  const spaceId = AppState.spaceId || 'hall';
  const avatarId = AppState.avatarId || 'echo';
  const online = (typeof navigator !== 'undefined' && navigator.onLine !== undefined) ? (navigator.onLine ? 'online' : 'offline') : 'online';
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || '3';

  return {
    time: timeStr,
    date: dateStr,
    timeZone,
    battery: batteryInfo,
    space: spaceId,
    avatar: avatarId,
    online,
    cores,
    formatted: `Current Time: ${timeStr} (${dateStr}, ${timeZone}) | Battery: ${batteryInfo} | Active Space: ${spaceId} | Avatar: ${avatarId} | Network: ${online}`
  };
}

/**
 * Switches the active avatar character in Three.js, AppState, and updates the default voice
 */
export function executeChangeAvatar(avatarId) {
  const cleanId = (avatarId || '').toLowerCase().trim();
  const validId = AVATAR_IDS.includes(cleanId) ? cleanId : 'echo';

  AppState.avatarId = validId;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('quest_avatar_id', validId);
  }
  AppState.save();

  const group = sceneHooks.getAvatarGroup ? sceneHooks.getAvatarGroup() : null;
  if (sceneHooks.buildAvatar && group) {
    sceneHooks.buildAvatar(validId, group);
    if (sceneHooks.applyAvatarTransform) sceneHooks.applyAvatarTransform();
  }

  const defaultVoice = sceneHooks.getDefaultVoiceForAvatar(validId);
  if (sceneHooks.setActiveVoiceId) {
    sceneHooks.setActiveVoiceId(defaultVoice);
  }

  const name = validId.charAt(0).toUpperCase() + validId.slice(1);
  logDebug('TOOL', `Avatar changed to ${name} (${validId}), voice: ${defaultVoice}`);
  return {
    avatarId: validId,
    name,
    voice: defaultVoice,
    message: `Switched avatar to ${name}.`
  };
}

/**
 * Switches the active 3D space in Three.js and AppState
 */
export function executeChangeSpace(spaceId) {
  const clean = (spaceId || '').toLowerCase().trim();
  let target = 'hall';

  if (clean.includes('garden') || clean.includes('zen')) target = 'garden';
  else if (clean.includes('penthouse') || clean.includes('cyber')) target = 'penthouse';
  else if (clean.includes('cafe') || clean.includes('bistro') || clean.includes('paris')) target = 'cafe';
  else if (clean.includes('pass') || clean.includes('real') || clean.includes('room') || clean.includes('immerse')) target = 'passthrough';
  else if (clean.includes('hall') || clean.includes('sci')) target = 'hall';
  else if (SPACE_IDS.includes(clean)) target = clean;

  AppState.spaceId = target;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('quest_space_id', target);
  }
  AppState.save();

  let spaceName = target.charAt(0).toUpperCase() + target.slice(1);
  if (sceneHooks.switchSpace) {
    const def = sceneHooks.switchSpace(target);
    if (def && def.name) spaceName = def.name;
  }
  logDebug('TOOL', `3D space switched to: ${spaceName} (${target})`);
  return {
    spaceId: target,
    name: spaceName,
    message: `Switched 3D space to ${spaceName}.`
  };
}

/**
 * Executes a tool by name with arguments
 */
export async function executeTool(name, args = {}) {
  logDebug('TOOL', `Executing tool "${name}" with args: ${JSON.stringify(args)}`);

  switch (name) {
    case 'get_time': {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
      return {
        success: true,
        tool: 'get_time',
        result: `It is currently ${timeStr} on ${dateStr} (${tz}).`
      };
    }

    case 'get_battery': {
      let result = 'Battery information is not supported in this browser session.';
      if (typeof navigator !== 'undefined' && navigator.getBattery) {
        try {
          const b = await navigator.getBattery();
          const pct = Math.round(b.level * 100);
          result = `Device battery is at ${pct}% and currently ${b.charging ? 'charging' : 'discharging (on battery)'}.`;
        } catch (e) {
          result = 'Battery state could not be read.';
        }
      }
      return { success: true, tool: 'get_battery', result };
    }

    case 'get_system_info': {
      const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || '3';
      const online = (typeof navigator !== 'undefined' && navigator.onLine) ? 'Online' : 'Offline';
      let mem = 'Standard';
      if (typeof performance !== 'undefined' && performance.memory) {
        mem = `${Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))}MB used / ${Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024))}MB heap`;
      }
      const engine = AppState.engine === 'cloud' ? 'Google Gemini 2.5 Flash (Cloud)' : 'SmolLM2-135M / Qwen (Local WebAssembly)';
      return {
        success: true,
        tool: 'get_system_info',
        result: `System Specs: ${cores} CPU cores, Memory: ${mem}, Network: ${online}, AI Engine: ${engine}.`
      };
    }

    case 'change_space': {
      const res = executeChangeSpace(args.space || args.spaceId);
      return {
        success: true,
        tool: 'change_space',
        result: res.message,
        spaceId: res.spaceId
      };
    }

    case 'change_avatar': {
      const res = executeChangeAvatar(args.avatar || args.avatarId);
      return {
        success: true,
        tool: 'change_avatar',
        result: res.message,
        avatarId: res.avatarId
      };
    }

    case 'recenter_view': {
      if (sceneHooks.resetCameraView) sceneHooks.resetCameraView();
      return {
        success: true,
        tool: 'recenter_view',
        result: 'Camera view and 3D positioning have been re-centered.'
      };
    }

    case 'get_companion_status': {
      const avatar = AppState.avatarId || 'echo';
      const space = AppState.spaceId || 'hall';
      return {
        success: true,
        tool: 'get_companion_status',
        result: `Companion status: Character is ${avatar}, active space is ${space}, engine mode is ${AppState.engine}.`
      };
    }

    case 'avatar_gesture': {
      const gesture = args.gesture || args.name || 'wave';
      const duration = args.duration || 3.0;
      let res = { success: true, gesture, duration };
      if (sceneHooks.triggerAvatarGesture) {
        res = sceneHooks.triggerAvatarGesture(gesture, duration);
      }
      const readableGesture = gesture.replace(/_/g, ' ');
      logDebug('TOOL', `Avatar gesture triggered: ${gesture} (${duration}s)`);
      return {
        success: true,
        tool: 'avatar_gesture',
        gesture,
        duration,
        result: `I am now performing the ${readableGesture} gesture in the scene!`
      };
    }

    case 'avatar_move': {
      const dir = args.direction || args.dir || 'forward';
      const style = args.style || 'walk';
      const dist = args.distance || 0.8;
      let res = { success: true, direction: dir, style, distance: dist };
      if (sceneHooks.moveAvatar) {
        res = sceneHooks.moveAvatar(dir, style, dist);
      }
      logDebug('TOOL', `Avatar move triggered: direction=${dir}, style=${style}, dist=${dist}`);
      return {
        success: true,
        tool: 'avatar_move',
        direction: dir,
        style,
        distance: dist,
        result: `Moving ${dir} with a ${style} style.`
      };
    }

    case 'avatar_freestyle': {
      const enabled = args.enabled !== undefined ? !!args.enabled : true;
      if (sceneHooks.setFreestyleMode) {
        sceneHooks.setFreestyleMode(enabled);
      }
      logDebug('TOOL', `Avatar freestyle mode set: ${enabled}`);
      return {
        success: true,
        tool: 'avatar_freestyle',
        enabled,
        result: enabled
          ? "Freestyle mode activated! I'll move around, explore the scene, jump, and make gestures."
          : "Freestyle mode paused. I'm staying right here with you."
      };
    }

    default:
      logDebug('TOOL', `Unknown tool requested: ${name}`);
      return {
        success: false,
        tool: name,
        result: `Tool "${name}" is not recognized.`
      };
  }
}

/**
 * Deterministic pre-inference tool matcher for local LLM
 * Recognizes common tool requests (time, battery, specs, space switch, avatar switch, camera recenter)
 * and executes them with zero hallucination.
 */
export async function detectAndExecuteTool(userPrompt) {
  const p = (userPrompt || '').toLowerCase().trim();

  // 1. Time / Date queries
  if (
    (/\b(time|date|clock|day of the week)\b/i.test(p) && /\b(what|tell|know|current|give|have|check|right now|today|at the)\b/i.test(p)) ||
    /\b(what('?s| is).*time|tell.*time|time right now|what time|what day|what date|today'?s date)\b/i.test(p)
  ) {
    return await executeTool('get_time');
  }

  // 2. Battery queries
  if (/\b(battery|battery level|battery percentage|how much battery|is (the headset|device|battery) charging)\b/i.test(p)) {
    return await executeTool('get_battery');
  }

  // 3. System / Hardware specs
  if (/\b(system specs|system info|check specs|hardware|cpu cores|memory usage|device info)\b/i.test(p)) {
    return await executeTool('get_system_info');
  }

  // 4. Change Space / Environment commands
  if (/\b(change|switch|go to|take (us|me) to|teleport to|load)\b.*\b(space|room|environment|background|garden|penthouse|cafe|hall|passthrough|real room)\b/i.test(p) ||
      /\b(let'?s go to|show me)\b.*\b(garden|penthouse|cafe|hall|passthrough|real room)\b/i.test(p)) {
    let target = 'hall';
    if (p.includes('garden') || p.includes('zen')) target = 'garden';
    else if (p.includes('penthouse') || p.includes('cyber')) target = 'penthouse';
    else if (p.includes('cafe') || p.includes('bistro') || p.includes('coffee')) target = 'cafe';
    else if (p.includes('pass') || p.includes('real') || p.includes('room') || p.includes('immerse')) target = 'passthrough';
    else if (p.includes('hall') || p.includes('sci')) target = 'hall';

    return await executeTool('change_space', { space: target });
  }

  // 5. Change Avatar / Character commands
  if (/\b(change|switch|turn into|become|transform into)\b.*\b(avatar|character|guide|maya|alex|ollie|robot|bot|echo|spark|pip|drone|cartoon)\b/i.test(p) ||
      /\b(be|switch to)\b (maya|alex|ollie|robot|bot|echo|spark|pip)\b/i.test(p)) {
    let target = 'echo';
    if (p.includes('maya') || p.includes('woman') || p.includes('female')) target = 'maya';
    else if (p.includes('alex') || p.includes('man') || p.includes('male') || p.includes('adventurer')) target = 'alex';
    else if (p.includes('ollie') || p.includes('robot') || p.includes('bot')) target = 'ollie';
    else if (p.includes('spark')) target = 'spark';
    else if (p.includes('pip') || p.includes('cartoon')) target = 'pip';
    else if (p.includes('echo') || p.includes('drone')) target = 'echo';

    return await executeTool('change_avatar', { avatar: target });
  }

  // 6. Camera recenter
  if (/\b(recenter|reset camera|center view|reset view|face me|look at me)\b/i.test(p)) {
    return await executeTool('recenter_view');
  }

  // 7. Capabilities & Help queries
  if (/\b(what (kind of things )?(can you|you can) do|what are your (features|capabilities|tools|skills)|how can you help|what do you do)\b/i.test(p)) {
    return {
      success: true,
      tool: 'get_capabilities',
      result: "I can change our 3D space, transform avatars, check device battery and time, or chat with you in VR!"
    };
  }

  // 8. Repeat queries
  if (/\b(repeat|say that again|what did you say|didn'?t (hear|understand) (you|what you said)|pardon|come again)\b/i.test(p)) {
    return {
      success: true,
      tool: 'repeat_last_turn',
      result: "repeat"
    };
  }

  // 9. Companion status
  if (/\b(who are you now|where are we|what space is this|what room is this)\b/i.test(p)) {
    return await executeTool('get_companion_status');
  }

  // 10. Avatar Freestyle / Autonomous wandering mode
  if (/\b(move around|walk around|wander around|explore the (scene|room|space)|freestyle mode|start freestyle)\b/i.test(p)) {
    return await executeTool('avatar_freestyle', { enabled: true });
  }
  if (/\b(stop moving|stop freestyle|pause freestyle|stay still|freeze|stand still)\b/i.test(p)) {
    return await executeTool('avatar_freestyle', { enabled: false });
  }

  // 11. Avatar Expressive Gestures
  if (/\b(dance|start dancing|do a dance|party)\b/i.test(p)) {
    return await executeTool('avatar_gesture', { gesture: 'dance' });
  }
  if (/\b(stand on one leg|balance on one (leg|foot)|lift (one|a) leg|balance pose|balance)\b/i.test(p)) {
    return await executeTool('avatar_gesture', { gesture: 'stand_on_one_leg' });
  }
  if (/\b(wave|wave at me|wave your hand|say hello with a wave|give (me )?a wave)\b/i.test(p)) {
    return await executeTool('avatar_gesture', { gesture: 'wave' });
  }
  if (/\b(put your hands up|hands up|celebrate|cheer|victory pose)\b/i.test(p)) {
    return await executeTool('avatar_gesture', { gesture: 'celebrate' });
  }
  if (/\b(take a bow|give a bow|bow for me|make a bow|bow)\b/i.test(p)) {
    return await executeTool('avatar_gesture', { gesture: 'bow' });
  }
  if (/\b(clap|applaud|applause|give me a clap|clap your hands)\b/i.test(p)) {
    return await executeTool('avatar_gesture', { gesture: 'clap' });
  }
  if (/\b(laugh out loud|give a laugh|crack up|laugh)\b/i.test(p)) {
    return await executeTool('avatar_gesture', { gesture: 'laugh' });
  }
  if (/\b(jump up|hop up|can you jump|do a jump|jump|hop)\b/i.test(p)) {
    return await executeTool('avatar_gesture', { gesture: 'jump' });
  }
  if (/\b(think|ponder|contemplate|stroke your chin|deep thought)\b/i.test(p)) {
    return await executeTool('avatar_gesture', { gesture: 'think' });
  }

  // 12. Avatar Locomotion Navigation
  if (/\b(move|walk|step)\b.*\b(to the )?left\b/i.test(p)) {
    return await executeTool('avatar_move', { direction: 'left', style: 'walk' });
  }
  if (/\b(move|walk|step)\b.*\b(to the )?right\b/i.test(p)) {
    return await executeTool('avatar_move', { direction: 'right', style: 'walk' });
  }
  if (/\b(move|walk|step)\b.*\b(forward|closer|front)\b/i.test(p)) {
    return await executeTool('avatar_move', { direction: 'forward', style: 'walk' });
  }
  if (/\b(move|walk|step)\b.*\b(backward|back|further)\b/i.test(p)) {
    return await executeTool('avatar_move', { direction: 'backward', style: 'walk' });
  }
  if (/\b(run)\b.*\b(forward|left|right|around)\b/i.test(p)) {
    return await executeTool('avatar_move', { direction: 'forward', style: 'run' });
  }

  return null;
}

/**
 * Extracts and executes any action tags emitted by the model: [ACTION: tool_name(param)]
 * Strips the action tag from spoken text so TTS doesn't read the code aloud.
 */
export async function processActionTagsInModelOutput(rawText) {
  if (!rawText || typeof rawText !== 'string') return { cleanText: rawText, actions: [] };

  const actionRegex = /\[ACTION:\s*([a-zA-Z0-9_]+)(?:\(([^)]*)\))?\]/gi;
  let match;
  const actions = [];
  let cleanText = rawText;

  while ((match = actionRegex.exec(rawText)) !== null) {
    const toolName = match[1];
    const rawParam = (match[2] || '').trim().replace(/['"]/g, '');
    actions.push({ toolName, param: rawParam });

    // Execute the action
    let args = {};
    if (toolName === 'change_space') args = { space: rawParam };
    else if (toolName === 'change_avatar') args = { avatar: rawParam };
    else if (toolName === 'avatar_gesture') args = { gesture: rawParam };
    else if (toolName === 'avatar_move') {
      const parts = rawParam.split(',').map(s => s.trim());
      args = { direction: parts[0] || 'forward', style: parts[1] || 'walk' };
    } else if (toolName === 'avatar_freestyle') {
      args = { enabled: rawParam !== 'false' && rawParam !== 'off' && rawParam !== '0' };
    }
    await executeTool(toolName, args);
  }

  // Strip all [ACTION: ...] tags from the text and normalize multiple spaces
  cleanText = cleanText.replace(actionRegex, '').replace(/\s{2,}/g, ' ').trim();

  return { cleanText, actions };
}
