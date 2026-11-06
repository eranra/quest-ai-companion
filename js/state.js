// Quest AI Companion - Global State & Storage Persistence
export const AppState = {
  engine: localStorage.getItem('quest_engine') || 'cloud', // 'local' or 'cloud'
  geminiKey: localStorage.getItem('quest_gemini_key') || '',
  avatarId: localStorage.getItem('quest_avatar_id') || 'echo',
  isLiveMode: localStorage.getItem('quest_live_mode') === 'true',
  
  // Runtime status
  isListening: false,
  isSpeaking: false,
  isGenerating: false,
  
  // Avatar Transform (Controlled by Quest 3 thumbstick / UI)
  avatarDistance: parseFloat(localStorage.getItem('quest_avatar_dist') || '0.0'),
  avatarScale: parseFloat(localStorage.getItem('quest_avatar_scale') || '1.0'),
  
  save() {
    localStorage.setItem('quest_engine', this.engine);
    localStorage.setItem('quest_gemini_key', this.geminiKey);
    localStorage.setItem('quest_avatar_id', this.avatarId);
    localStorage.setItem('quest_live_mode', this.isLiveMode ? 'true' : 'false');
    localStorage.setItem('quest_avatar_dist', this.avatarDistance.toFixed(2));
    localStorage.setItem('quest_avatar_scale', this.avatarScale.toFixed(2));
  }
};
