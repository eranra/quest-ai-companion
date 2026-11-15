// Quest AI Companion - Reactive Global State & Storage Persistence
const storage = (typeof localStorage !== 'undefined') ? localStorage : {
  getItem: () => null,
  setItem: () => {}
};

// Event listener registry for reactive state observation
const listeners = new Map();

function on(event, callback) {
  if (typeof callback !== 'function') return () => {};
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);
  return () => off(event, callback);
}

function off(event, callback) {
  if (listeners.has(event)) {
    listeners.get(event).delete(callback);
  }
}

function emit(event, ...args) {
  if (listeners.has(event)) {
    for (const cb of listeners.get(event)) {
      try {
        cb(...args);
      } catch (e) {
        console.error(`[AppState] Listener error on event "${event}":`, e);
      }
    }
  }
}

const rawState = {
  // Default to Local CPU WASM Model: SmolLM2 135M (ultra-fast, zero-flags)
  engine: storage.getItem('quest_engine') || 'local', // 'local' | 'cloud' | 'remote'
  remoteServerUrl: storage.getItem('quest_remote_url') || (typeof window !== 'undefined' && window.location.origin.startsWith('http') && !window.location.origin.includes('github.io') ? window.location.origin : 'http://localhost:8080'),
  localModel: (() => {
    const saved = storage.getItem('quest_local_model');
    if (!saved || saved.includes('MLC') || saved.includes('Llama')) {
      return 'onnx-community/SmolLM2-135M-Instruct-ONNX';
    }
    return saved;
  })(),
  geminiKey: storage.getItem('quest_gemini_key') || '',
  avatarId: storage.getItem('quest_avatar_id') || 'echo',
  spaceId: storage.getItem('quest_space_id') || 'hall',
  isLiveMode: false, // Always starts disabled on website entry
  isFocusMode: false, // Immersive Void / Panel-Only Mode
  
  // Standalone PC Server Remote Models (WASM)
  remoteSttModel: storage.getItem('quest_remote_stt_model') || 'whisper-tiny',
  remoteLlmModel: storage.getItem('quest_remote_llm_model') || 'instant-companion',
  remoteTtsModel: storage.getItem('quest_remote_tts_model') || 'en_US-amy-low',

  // Runtime status
  isModelLoading: false,
  modelLoadProgress: 0,
  modelStatusText: '',
  isModelReady: false,
  isListening: false,
  isSpeaking: false,
  isGenerating: false,
  geminiStatus: 'unknown', // 'online', 'offline', 'checking', 'no-key'
  remoteServerStatus: 'unknown', // 'online', 'offline', 'checking'
  
  // Avatar Transform (Controlled by Quest 3 thumbstick / UI) - with robust bounds
  avatarDistance: (() => {
    const v = parseFloat(storage.getItem('quest_avatar_dist'));
    return (isNaN(v) || v < -10.0 || v > 20.0) ? 0.0 : v;
  })(),
  avatarScale: (() => {
    const v = parseFloat(storage.getItem('quest_avatar_scale'));
    return (isNaN(v) || v <= 0.05 || v > 10.0) ? 1.0 : v;
  })(),
  avatarRotationY: (() => {
    const v = parseFloat(storage.getItem('quest_avatar_roty'));
    return isNaN(v) ? 0.0 : v;
  })(),
  avatarHeightOffset: (() => {
    const v = parseFloat(storage.getItem('quest_avatar_height_offset'));
    return (isNaN(v) || Math.abs(v) > 10.0) ? 0.0 : v;
  })(),
  
  // Live Mode Sensitivity / Noise Threshold ('high_filter', 'normal', 'sensitive')
  liveSensitivity: storage.getItem('quest_live_sensitivity') || 'normal',

  // Companion Mood / Behavioral Attitude ('auto', 'warm', 'witty', 'feisty', 'zen', 'cyberpunk', 'cheerful')
  companionMood: storage.getItem('quest_companion_mood') || 'auto',

  // Acoustic Anti-Self-Echo Guard ('smart', 'half_duplex', 'off')
  echoGuardMode: storage.getItem('quest_echo_guard') || 'smart',

  // Voice Engines (Native OS vs Downloaded Neural Models)
  sttEngine: storage.getItem('quest_stt_engine') || 'native', // 'native' or 'whisper'
  ttsEngine: storage.getItem('quest_tts_engine') || 'native', // 'native' or 'neural'

  on,
  off,
  emit,
  set(prop, value) {
    this[prop] = value;
    return value;
  },

  save() {
    storage.setItem('quest_engine', this.engine);
    storage.setItem('quest_remote_url', this.remoteServerUrl);
    storage.setItem('quest_local_model', this.localModel);
    storage.setItem('quest_gemini_key', this.geminiKey);
    storage.setItem('quest_avatar_id', this.avatarId);
    storage.setItem('quest_space_id', this.spaceId);
    storage.setItem('quest_live_mode', this.isLiveMode ? 'true' : 'false');
    storage.setItem('quest_avatar_dist', this.avatarDistance.toFixed(2));
    storage.setItem('quest_avatar_scale', this.avatarScale.toFixed(2));
    storage.setItem('quest_avatar_roty', this.avatarRotationY.toFixed(4));
    storage.setItem('quest_avatar_height_offset', this.avatarHeightOffset.toFixed(2));
    storage.setItem('quest_live_sensitivity', this.liveSensitivity);
    storage.setItem('quest_companion_mood', this.companionMood);
    storage.setItem('quest_echo_guard', this.echoGuardMode);
    storage.setItem('quest_stt_engine', this.sttEngine);
    storage.setItem('quest_tts_engine', this.ttsEngine);
    storage.setItem('quest_remote_stt_model', this.remoteSttModel);
    storage.setItem('quest_remote_llm_model', this.remoteLlmModel);
    storage.setItem('quest_remote_tts_model', this.remoteTtsModel);
  }
};

export const AppState = new Proxy(rawState, {
  set(target, prop, value, receiver) {
    const prev = target[prop];
    const changed = prev !== value;
    const success = Reflect.set(target, prop, value, receiver);
    if (changed && success && typeof prop === 'string') {
      emit(`change:${prop}`, value, prev);
      emit('change', prop, value, prev);
    }
    return success;
  }
});
