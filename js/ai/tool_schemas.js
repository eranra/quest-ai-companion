// Declarative Tool Schemas & Parameter Definitions for Gemini & Local Agents

export const AVATAR_IDS = ['echo', 'spark', 'pip', 'ollie', 'maya', 'alex', 'matt', 'riley'];
export const SPACE_IDS = ['hall', 'garden', 'penthouse', 'cafe', 'passthrough'];
export const AVATAR_VOICES = {
  echo: 'en_US-kathleen-low',
  spark: 'en_US-ryan-low',
  pip: 'en_US-amy-low',
  ollie: 'en_US-ryan-low',
  maya: 'en_US-amy-low',
  alex: 'en_US-ryan-low',
  matt: 'en_US-ryan-low',
  riley: 'en_US-kathleen-low'
};

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
    description: 'Change the active 3D avatar character. Available avatars: "maya" (Empathetic Guide), "alex" (Adventurer), "ollie" (Robot Sidekick), "echo" (Holo Drone), "spark" (Spark Drone), "pip" (Cartoon Character), "matt" (Wii Sports Champion), "riley" (Wii Tennis Pro).',
    parameters: {
      type: 'OBJECT',
      properties: {
        avatar: {
          type: 'STRING',
          description: 'The target avatar identifier: "maya", "alex", "ollie", "echo", "spark", "pip", "matt", or "riley".'
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
    name: 'repeat_last_turn',
    description: 'Repeats the last turn or restates the previous message.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'avatar_gesture',
    description: 'Perform an expressive full-body gesture with the 3D avatar in the scene. Available gestures: "wave" (friendly greeting), "dance" (rhythmic party dance), "stand_on_one_leg" (balance on one foot), "bow" (polite formal bow), "celebrate" or "hands_up" (raise arms high in victory), "think" (hand to chin contemplating), "clap" (applaud), "laugh" (joyous laughter), "jump" (energetic hop), "nod" (affirmative agreement), "shake_head" (disagreement), "tennis_swing" (Wii Sports tennis stroke), "wii_celebrate" (Wii victory hop & racket pump).',
    parameters: {
      type: 'OBJECT',
      properties: {
        gesture: {
          type: 'STRING',
          description: 'The gesture identifier: "wave", "dance", "stand_on_one_leg", "bow", "celebrate", "hands_up", "think", "clap", "laugh", "jump", "nod", "shake_head", "tennis_swing", or "wii_celebrate".'
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
 * Returns Gemini functionDeclarations format for google-genai / REST API
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
