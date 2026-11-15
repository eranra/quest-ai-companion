/**
 * Quest AI Companion - Quest GPU Alert Modal Controller
 */

import { AppState } from '../../state.js';
import { unlockAudio } from '../../audio/index.js';
import { speakAnnouncement } from '../../conversation_orchestrator.js';

export function initQuestGPUAlert({ onEngineChange, openSettingsWithGeminiFocus } = {}) {
  const modalQuestGpuAlert = typeof document !== 'undefined' ? document.getElementById('modal-quest-gpu-alert') : null;
  const btnCloseQuestAlert = typeof document !== 'undefined' ? document.getElementById('btn-close-quest-alert') : null;
  const btnQuestAlertGotIt = typeof document !== 'undefined' ? document.getElementById('btn-quest-alert-got-it') : null;
  const btnQuestSwitchGemini = typeof document !== 'undefined' ? document.getElementById('btn-quest-switch-gemini') : null;

  function showQuestGPUAlert() {
    unlockAudio();
    if (modalQuestGpuAlert) {
      modalQuestGpuAlert.classList.add('open');
    }
  }

  function hideQuestGPUAlert() {
    if (modalQuestGpuAlert) {
      modalQuestGpuAlert.classList.remove('open');
    }
  }

  if (btnCloseQuestAlert) {
    btnCloseQuestAlert.onclick = () => hideQuestGPUAlert();
  }

  if (btnQuestAlertGotIt) {
    btnQuestAlertGotIt.onclick = () => hideQuestGPUAlert();
  }

  if (btnQuestSwitchGemini) {
    btnQuestSwitchGemini.onclick = () => {
      unlockAudio();
      const prevEngine = AppState.engine;
      const prevModel = AppState.localModel;
      AppState.engine = 'cloud';
      AppState.save();
      hideQuestGPUAlert();

      const cfgEngineSelect = document.getElementById('cfg-engine-select');
      const groupGemini = document.getElementById('group-gemini');
      const groupLocalModel = document.getElementById('group-local-model');
      const engineSummaryHint = document.getElementById('engine-summary-hint');

      if (cfgEngineSelect) cfgEngineSelect.value = 'cloud';
      if (groupGemini) groupGemini.style.display = 'block';
      if (groupLocalModel) groupLocalModel.style.display = 'none';
      if (engineSummaryHint) engineSummaryHint.textContent = 'Connects to Google Gemini 2.5 Flash cloud API for fast answers.';

      if (onEngineChange) {
        onEngineChange(prevEngine, prevModel, { prevStt: AppState.sttEngine, prevTts: AppState.ttsEngine });
      }

      if (!AppState.geminiKey || !AppState.geminiKey.trim()) {
        if (openSettingsWithGeminiFocus) {
          openSettingsWithGeminiFocus();
        } else {
          const modalSettings = document.getElementById('modal-settings');
          const cfgGeminiKey = document.getElementById('cfg-gemini-key');
          if (modalSettings) modalSettings.classList.add('open');
          if (cfgGeminiKey) cfgGeminiKey.focus();
        }
        speakAnnouncement("Switched to Google Gemini Cloud. Enter your free API key in settings to talk!");
      } else {
        speakAnnouncement("Switched to Google Gemini Cloud mode. I am ready to talk with you!");
      }
    };
  }

  return { showQuestGPUAlert, hideQuestGPUAlert };
}
