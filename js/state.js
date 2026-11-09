// Quest AI Companion - Global State & Storage Persistence
const storage = (typeof localStorage !== 'undefined') ? localStorage : {
  getItem: () => null,
  setItem: () => {}
};

export const AppState = {
  // Default to Local CPU WASM Model: SmolLM2 135M (ultra-fast, zero-flags)
  engine: storage.getItem('quest_engine') || 'local', // 'local' | 'cloud' | 'remote'
  remoteServerUrl: storage.getItem('quest_remote_url') || 'http://localhost:8080',
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
  isLiveMode: storage.getItem('quest_live_mode') === 'true',
  
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
  
  // Avatar Transform (Controlled by Quest 3 thumbstick / UI)
  avatarDistance: parseFloat(storage.getItem('quest_avatar_dist') || '0.0'),
  avatarScale: parseFloat(storage.getItem('quest_avatar_scale') || '1.0'),
  avatarRotationY: parseFloat(storage.getItem('quest_avatar_roty') || '0.0'),
  
  // Live Mode Sensitivity / Noise Threshold ('high_filter', 'normal', 'sensitive')
  liveSensitivity: storage.getItem('quest_live_sensitivity') || 'normal',

  // Acoustic Anti-Self-Echo Guard ('smart', 'half_duplex', 'off')
  echoGuardMode: storage.getItem('quest_echo_guard') || 'smart',

  // Voice Engines (Native OS vs Downloaded Neural Models)
  sttEngine: storage.getItem('quest_stt_engine') || 'native', // 'native' or 'whisper'
  ttsEngine: storage.getItem('quest_tts_engine') || 'native', // 'native' or 'neural'

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
    storage.setItem('quest_live_sensitivity', this.liveSensitivity);
    storage.setItem('quest_echo_guard', this.echoGuardMode);
    storage.setItem('quest_stt_engine', this.sttEngine);
    storage.setItem('quest_tts_engine', this.ttsEngine);
  }
};
