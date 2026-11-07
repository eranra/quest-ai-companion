// Quest AI Companion - Global State & Storage Persistence
export const AppState = {
  // Default to Local Qwen Model as requested!
  engine: localStorage.getItem('quest_engine') || 'local', // 'local' or 'cloud'
  localModel: localStorage.getItem('quest_local_model') || 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  geminiKey: localStorage.getItem('quest_gemini_key') || '',
  avatarId: localStorage.getItem('quest_avatar_id') || 'echo',
  spaceId: localStorage.getItem('quest_space_id') || 'hall',
  isLiveMode: localStorage.getItem('quest_live_mode') === 'true',
  
  // Runtime status
  isModelLoading: false,
  modelLoadProgress: 0,
  modelStatusText: '',
  isModelReady: false,
  isListening: false,
  isSpeaking: false,
  isGenerating: false,
  geminiStatus: 'unknown', // 'online', 'offline', 'checking', 'no-key'
  
  // Avatar Transform (Controlled by Quest 3 thumbstick / UI)
  avatarDistance: parseFloat(localStorage.getItem('quest_avatar_dist') || '0.0'),
  avatarScale: parseFloat(localStorage.getItem('quest_avatar_scale') || '1.0'),
  
  // Live Mode Sensitivity / Noise Threshold ('high_filter', 'normal', 'sensitive')
  liveSensitivity: localStorage.getItem('quest_live_sensitivity') || 'normal',

  // Acoustic Anti-Self-Echo Guard ('smart', 'half_duplex', 'off')
  echoGuardMode: localStorage.getItem('quest_echo_guard') || 'smart',

  save() {
    localStorage.setItem('quest_engine', this.engine);
    localStorage.setItem('quest_local_model', this.localModel);
    localStorage.setItem('quest_gemini_key', this.geminiKey);
    localStorage.setItem('quest_avatar_id', this.avatarId);
    localStorage.setItem('quest_space_id', this.spaceId);
    localStorage.setItem('quest_live_mode', this.isLiveMode ? 'true' : 'false');
    localStorage.setItem('quest_avatar_dist', this.avatarDistance.toFixed(2));
    localStorage.setItem('quest_avatar_scale', this.avatarScale.toFixed(2));
    localStorage.setItem('quest_live_sensitivity', this.liveSensitivity);
    localStorage.setItem('quest_echo_guard', this.echoGuardMode);
  }
};
