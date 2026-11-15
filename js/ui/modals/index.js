/**
 * Quest AI Companion - Modals Module Aggregator & Initializer
 * Re-exports and orchestrates Avatars, Spaces, Music, Settings, and Quest GPU Alert Modals.
 */

import { initAvatarsModal } from './avatars_modal.js';
import { initSpacesModal } from './spaces_modal.js';
import { initMusicModal } from './music_modal.js';
import { initQuestGPUAlert } from './quest_gpu_alert.js';
import { initSettingsModal } from './settings_modal.js';

export { initAvatarsModal } from './avatars_modal.js';
export { initSpacesModal } from './spaces_modal.js';
export { initMusicModal } from './music_modal.js';
export { initQuestGPUAlert } from './quest_gpu_alert.js';
export { initSettingsModal } from './settings_modal.js';

/**
 * Initializes all modal controllers and integrates them with AppState reactivity
 */
export function initModals({ onEngineChange, onVoiceModelProgress } = {}) {
  // 1. Ambient Music Modal
  const musicModal = initMusicModal();

  // 2. Settings Modal
  const settingsModal = initSettingsModal({
    onEngineChange,
    onVoiceModelProgress,
    syncMusicUI: musicModal.syncMusicUI
  });

  // 3. Quest GPU Alert Modal
  const questGpuAlert = initQuestGPUAlert({
    onEngineChange,
    openSettingsWithGeminiFocus: () => {
      const modalSettings = document.getElementById('modal-settings');
      const cfgGeminiKey = document.getElementById('cfg-gemini-key');
      if (modalSettings) modalSettings.classList.add('open');
      if (cfgGeminiKey) cfgGeminiKey.focus();
    }
  });

  // 4. Avatars Modal
  const avatarsModal = initAvatarsModal({
    onVoiceChanged: () => {
      settingsModal.populateVoiceList();
    }
  });

  // 5. Spaces Modal
  const spacesModal = initSpacesModal();

  return {
    syncAvatarCards: avatarsModal.syncAvatarCards,
    syncSpaceCards: spacesModal.syncSpaceCards,
    populateVoiceList: settingsModal.populateVoiceList,
    populateRemoteModels: settingsModal.populateRemoteModels,
    syncFocusUI: settingsModal.syncFocusUI,
    syncMusicUI: musicModal.syncMusicUI,
    showQuestGPUAlert: questGpuAlert.showQuestGPUAlert,
    hideQuestGPUAlert: questGpuAlert.hideQuestGPUAlert
  };
}
