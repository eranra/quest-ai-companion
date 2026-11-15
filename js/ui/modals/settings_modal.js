/**
 * Quest AI Companion - Settings Modal Controller
 */

import { AppState } from '../../state.js';
import { applyAvatarTransform } from '../../scene.js';
import {
  unlockAudio,
  initWhisper,
  initNeuralTTS,
  isWhisperReady,
  isNeuralTTSReady,
  PIPER_VOICE_CONFIGS,
  getActiveVoiceId,
  setActiveVoiceId,
  getDefaultVoiceForAvatar
} from '../../audio/index.js';
import {
  checkGeminiResponsiveness,
  checkRemoteServerResponsiveness,
  isQuestBrowser,
  selectRemoteModel,
  fetchRemoteModels,
  getCachedRemoteModels
} from '../../ai.js';
import { switchSpace } from '../../spaces/index.js';
import { speakAnnouncement } from '../../conversation_orchestrator.js';

export function initSettingsModal({
  onEngineChange,
  onVoiceModelProgress,
  syncMusicUI
} = {}) {
  const dom = {
    modalSettings: typeof document !== 'undefined' ? document.getElementById('modal-settings') : null,
    btnSettings: typeof document !== 'undefined' ? document.getElementById('btn-settings') : null,
    btnCloseSettings: typeof document !== 'undefined' ? document.getElementById('btn-close-settings') : null,
    btnSaveSettings: typeof document !== 'undefined' ? document.getElementById('btn-save-settings') : null,
    cfgGeminiKey: typeof document !== 'undefined' ? document.getElementById('cfg-gemini-key') : null,
    cfgEngineSelect: typeof document !== 'undefined' ? document.getElementById('cfg-engine-select') : null,
    cfgLocalModel: typeof document !== 'undefined' ? document.getElementById('cfg-local-model') : null,
    cfgSpaceSelect: typeof document !== 'undefined' ? document.getElementById('cfg-space-select') : null,
    cfgLiveSensitivity: typeof document !== 'undefined' ? document.getElementById('cfg-live-sensitivity') : null,
    cfgEchoGuard: typeof document !== 'undefined' ? document.getElementById('cfg-echo-guard') : null,
    cfgCompanionMood: typeof document !== 'undefined' ? document.getElementById('cfg-companion-mood') : null,
    groupLocalModel: typeof document !== 'undefined' ? document.getElementById('group-local-model') : null,
    groupGemini: typeof document !== 'undefined' ? document.getElementById('group-gemini') : null,
    btnTestGemini: typeof document !== 'undefined' ? document.getElementById('btn-test-gemini') : null,
    geminiTestStatus: typeof document !== 'undefined' ? document.getElementById('gemini-test-status') : null,
    groupRemote: typeof document !== 'undefined' ? document.getElementById('group-remote') : null,
    cfgRemoteUrl: typeof document !== 'undefined' ? document.getElementById('cfg-remote-url') : null,
    btnTestRemote: typeof document !== 'undefined' ? document.getElementById('btn-test-remote') : null,
    remoteTestStatus: typeof document !== 'undefined' ? document.getElementById('remote-test-status') : null,
    remoteModelSelection: typeof document !== 'undefined' ? document.getElementById('remote-model-selection') : null,
    cfgRemoteSttModel: typeof document !== 'undefined' ? document.getElementById('cfg-remote-stt-model') : null,
    cfgRemoteLlmModel: typeof document !== 'undefined' ? document.getElementById('cfg-remote-llm-model') : null,
    cfgRemoteTtsModel: typeof document !== 'undefined' ? document.getElementById('cfg-remote-tts-model') : null,
    engineSummaryHint: typeof document !== 'undefined' ? document.getElementById('engine-summary-hint') : null,
    cfgVoiceSelect: typeof document !== 'undefined' ? document.getElementById('cfg-voice-select') : null,
    btnTestVoice: typeof document !== 'undefined' ? document.getElementById('btn-test-voice') : null,
    sliderScale: typeof document !== 'undefined' ? document.getElementById('slider-scale') : null,
    sliderDist: typeof document !== 'undefined' ? document.getElementById('slider-dist') : null,
    sliderHeight: typeof document !== 'undefined' ? document.getElementById('slider-height') : null,
    valScale: typeof document !== 'undefined' ? document.getElementById('val-scale') : null,
    valDist: typeof document !== 'undefined' ? document.getElementById('val-dist') : null,
    valHeight: typeof document !== 'undefined' ? document.getElementById('val-height') : null,
    cfgSttEngine: typeof document !== 'undefined' ? document.getElementById('cfg-stt-engine') : null,
    whisperLoaderBox: typeof document !== 'undefined' ? document.getElementById('whisper-loader-box') : null,
    btnDownloadWhisper: typeof document !== 'undefined' ? document.getElementById('btn-download-whisper') : null,
    whisperStatusLabel: typeof document !== 'undefined' ? document.getElementById('whisper-status-label') : null,
    cfgTtsEngine: typeof document !== 'undefined' ? document.getElementById('cfg-tts-engine') : null,
    ttsLoaderBox: typeof document !== 'undefined' ? document.getElementById('tts-loader-box') : null,
    btnDownloadTts: typeof document !== 'undefined' ? document.getElementById('btn-download-tts') : null,
    ttsStatusLabel: typeof document !== 'undefined' ? document.getElementById('tts-status-label') : null,
    questGpuFlagStatus: typeof document !== 'undefined' ? document.getElementById('quest-gpu-flag-status') : null,
    btnFocusToggleModal: typeof document !== 'undefined' ? document.getElementById('btn-focus-toggle-modal') : null,
    focusToggleLabel: typeof document !== 'undefined' ? document.getElementById('focus-toggle-label') : null
  };

  function syncFocusUI() {
    if (dom.btnFocusToggleModal && dom.focusToggleLabel) {
      dom.focusToggleLabel.textContent = AppState.isFocusMode ? 'ON' : 'OFF';
      dom.btnFocusToggleModal.style.background = AppState.isFocusMode ? '#059669' : '#4f46e5';
    }
  }

  function populateVoiceList() {
    if (!dom.cfgVoiceSelect || typeof document === 'undefined') return;
    dom.cfgVoiceSelect.innerHTML = '';
    const currentActiveVoice = getActiveVoiceId();
    const currentAvatarId = (typeof localStorage !== 'undefined' ? localStorage.getItem('quest_avatar_id') : null) || AppState.avatarId || 'echo';
    const avatarDefaultVoice = getDefaultVoiceForAvatar(currentAvatarId);

    // Group 1: Fast Lightweight Neural Piper Voices
    const neuralGroup = document.createElement('optgroup');
    neuralGroup.label = '⚡ Fast Neural Voices (Offline Piper WASM)';

    Object.values(PIPER_VOICE_CONFIGS).forEach(pv => {
      const option = document.createElement('option');
      option.value = pv.id;
      const isDefault = pv.id === avatarDefaultVoice;
      option.textContent = `${pv.name}${isDefault ? ' ⭐ (Default for Avatar)' : ''}`;
      if (pv.id === currentActiveVoice) {
        option.selected = true;
      }
      neuralGroup.appendChild(option);
    });
    dom.cfgVoiceSelect.appendChild(neuralGroup);

    // Group 2: Native OS voices (if available in browser/Android)
    const osVoices = (typeof window !== 'undefined' && 'speechSynthesis' in window) ? window.speechSynthesis.getVoices() : [];
    if (osVoices && osVoices.length > 0) {
      const osGroup = document.createElement('optgroup');
      osGroup.label = '📱 Device OS Voices';
      osVoices.forEach(voice => {
        const option = document.createElement('option');
        option.textContent = `${voice.name} (${voice.lang})`;
        option.value = voice.name;
        if (voice.name === currentActiveVoice) {
          option.selected = true;
        }
        osGroup.appendChild(option);
      });
      dom.cfgVoiceSelect.appendChild(osGroup);
    }
  }

  populateVoiceList();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = populateVoiceList;
  }

  if (dom.cfgVoiceSelect) {
    dom.cfgVoiceSelect.onchange = () => {
      setActiveVoiceId(dom.cfgVoiceSelect.value);
    };
  }

  function populateRemoteModels(models, active) {
    if (!models || !dom.remoteModelSelection || typeof document === 'undefined') return;
    dom.remoteModelSelection.style.display = 'block';

    if (models.stt && dom.cfgRemoteSttModel) {
      dom.cfgRemoteSttModel.innerHTML = '';
      models.stt.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        dom.cfgRemoteSttModel.appendChild(opt);
      });
      dom.cfgRemoteSttModel.value = AppState.remoteSttModel || active?.stt || models.stt[0].id;
    }

    if (models.llm && dom.cfgRemoteLlmModel) {
      dom.cfgRemoteLlmModel.innerHTML = '';
      models.llm.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        dom.cfgRemoteLlmModel.appendChild(opt);
      });
      dom.cfgRemoteLlmModel.value = AppState.remoteLlmModel || active?.llm || models.llm[0].id;

      const agCard = document.getElementById('antigravity-session-card');
      const agId = document.getElementById('antigravity-session-id');
      const updateAgCard = () => {
        if (!agCard) return;
        const isAg = dom.cfgRemoteLlmModel.value === 'antigravity';
        agCard.style.display = isAg ? 'block' : 'none';
        const agSession = AppState.antigravitySession;
        if (agId && agSession?.conversationId) {
          agId.textContent = `Session: ${agSession.conversationId} (${agSession.turnsCount || 0} turns synced)`;
        }
      };
      dom.cfgRemoteLlmModel.onchange = () => {
        AppState.remoteLlmModel = dom.cfgRemoteLlmModel.value;
        updateAgCard();
      };
      updateAgCard();
    }

    if (models.tts && dom.cfgRemoteTtsModel) {
      dom.cfgRemoteTtsModel.innerHTML = '';
      models.tts.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        dom.cfgRemoteTtsModel.appendChild(opt);
      });
      dom.cfgRemoteTtsModel.value = AppState.remoteTtsModel || active?.tts || models.tts[0].id;
    }
  }

  function updateEngineVisibility(engine) {
    if (engine === 'cloud') {
      if (dom.groupGemini) dom.groupGemini.style.display = 'block';
      if (dom.groupLocalModel) dom.groupLocalModel.style.display = 'none';
      if (dom.groupRemote) dom.groupRemote.style.display = 'none';
      if (dom.engineSummaryHint) dom.engineSummaryHint.textContent = 'Connects to Google Gemini 2.5 Flash cloud API for fast answers.';
    } else if (engine === 'remote') {
      if (dom.groupGemini) dom.groupGemini.style.display = 'none';
      if (dom.groupLocalModel) dom.groupLocalModel.style.display = 'none';
      if (dom.groupRemote) dom.groupRemote.style.display = 'block';
      if (dom.engineSummaryHint) dom.engineSummaryHint.textContent = 'Connects to your local PC/Mac server over Wi-Fi for ultra-low latency & 8B models.';
    } else {
      if (dom.groupGemini) dom.groupGemini.style.display = 'none';
      if (dom.groupLocalModel) dom.groupLocalModel.style.display = 'block';
      if (dom.groupRemote) dom.groupRemote.style.display = 'none';
      if (dom.engineSummaryHint) dom.engineSummaryHint.textContent = 'Runs 100% offline via CPU WebAssembly (WASM). Zero API keys, completely private.';
    }
  }

  if (dom.btnSettings) {
    dom.btnSettings.onclick = () => {
      unlockAudio();
      if (syncMusicUI) syncMusicUI();
      syncFocusUI();
      if (dom.cfgGeminiKey) dom.cfgGeminiKey.value = AppState.geminiKey;
      if (dom.cfgEngineSelect) dom.cfgEngineSelect.value = AppState.engine;
      if (dom.cfgLocalModel) dom.cfgLocalModel.value = AppState.localModel;
      if (dom.cfgSpaceSelect) dom.cfgSpaceSelect.value = AppState.spaceId;
      if (dom.cfgLiveSensitivity) dom.cfgLiveSensitivity.value = AppState.liveSensitivity || 'normal';
      if (dom.cfgEchoGuard) dom.cfgEchoGuard.value = AppState.echoGuardMode || 'smart';
      if (dom.cfgCompanionMood) dom.cfgCompanionMood.value = AppState.companionMood || 'auto';
      if (dom.cfgSttEngine) {
        dom.cfgSttEngine.value = AppState.sttEngine || 'native';
        if (dom.whisperLoaderBox) dom.whisperLoaderBox.style.display = dom.cfgSttEngine.value === 'whisper' ? 'block' : 'none';
        if (dom.whisperStatusLabel) dom.whisperStatusLabel.textContent = isWhisperReady() ? '✅ Whisper Ready' : 'Ready to download';
      }
      if (dom.cfgTtsEngine) {
        dom.cfgTtsEngine.value = AppState.ttsEngine || 'native';
        if (dom.ttsLoaderBox) dom.ttsLoaderBox.style.display = dom.cfgTtsEngine.value === 'neural' ? 'block' : 'none';
        if (dom.ttsStatusLabel) dom.ttsStatusLabel.textContent = isNeuralTTSReady() ? '✅ Neural TTS Ready' : 'Ready to download';
      }
      populateVoiceList();
      if (dom.sliderScale) dom.sliderScale.value = AppState.avatarScale;
      if (dom.sliderDist) dom.sliderDist.value = AppState.avatarDistance;
      if (dom.sliderHeight) dom.sliderHeight.value = AppState.avatarHeightOffset || 0.0;
      if (dom.valScale) dom.valScale.textContent = `${AppState.avatarScale.toFixed(2)}x`;
      if (dom.valDist) dom.valDist.textContent = `${(1.5 + AppState.avatarDistance).toFixed(2)}m`;
      if (dom.valHeight) dom.valHeight.textContent = `${(AppState.avatarHeightOffset || 0.0).toFixed(2)}m`;

      if (dom.cfgRemoteUrl) {
        dom.cfgRemoteUrl.value = AppState.remoteServerUrl || 'http://localhost:8080';
      }

      const cachedModels = getCachedRemoteModels();
      if (cachedModels) {
        populateRemoteModels(cachedModels);
      } else if (AppState.engine === 'remote') {
        fetchRemoteModels().then(data => {
          if (data && data.models) populateRemoteModels(data.models, data.active);
        }).catch(() => {});
      }

      updateEngineVisibility(AppState.engine);

      const questNotice = typeof document !== 'undefined' ? document.getElementById('quest-engine-notice') : null;
      if (questNotice) {
        questNotice.style.display = isQuestBrowser() ? 'block' : 'none';
      }

      if (dom.questGpuFlagStatus) {
        dom.questGpuFlagStatus.innerHTML = '<span style="color: #34d399;">🟢 Local Engine: CPU WebAssembly (WASM) — 100% Native on Meta Quest 3, zero flags needed!</span>';
      }

      if (dom.modalSettings) dom.modalSettings.classList.add('open');
    };
  }

  if (dom.btnCloseSettings) {
    dom.btnCloseSettings.onclick = () => {
      if (dom.modalSettings) dom.modalSettings.classList.remove('open');
    };
  }

  if (dom.cfgEngineSelect) {
    dom.cfgEngineSelect.onchange = () => {
      updateEngineVisibility(dom.cfgEngineSelect.value);
    };
  }

  if (dom.btnTestRemote) {
    dom.btnTestRemote.onclick = async () => {
      unlockAudio();
      const testUrl = dom.cfgRemoteUrl ? dom.cfgRemoteUrl.value.trim() : '';
      if (!testUrl) {
        if (dom.remoteTestStatus) {
          dom.remoteTestStatus.textContent = '⚠️ Enter Server URL first';
          dom.remoteTestStatus.style.color = '#f59e0b';
        }
        return;
      }
      if (dom.remoteTestStatus) {
        dom.remoteTestStatus.textContent = 'Testing connection...';
        dom.remoteTestStatus.style.color = '#38bdf8';
      }

      AppState.remoteServerUrl = testUrl;
      const check = await checkRemoteServerResponsiveness(testUrl);
      if (check.responsive) {
        if (dom.remoteTestStatus) {
          dom.remoteTestStatus.textContent = `✅ Connected! (${check.cores} cores)`;
          dom.remoteTestStatus.style.color = '#10b981';
        }
        if (check.models) {
          populateRemoteModels(check.models, check.activeModels);
        }
      } else {
        if (dom.remoteTestStatus) {
          dom.remoteTestStatus.textContent = `❌ ${check.reason}`;
          dom.remoteTestStatus.style.color = '#ef4444';
        }
      }
    };
  }

  if (dom.btnTestGemini) {
    dom.btnTestGemini.onclick = async () => {
      unlockAudio();
      const testKey = dom.cfgGeminiKey ? dom.cfgGeminiKey.value.trim() : '';
      if (!testKey) {
        if (dom.geminiTestStatus) {
          dom.geminiTestStatus.textContent = '⚠️ Enter API key first';
          dom.geminiTestStatus.style.color = '#f59e0b';
        }
        return;
      }
      if (dom.geminiTestStatus) {
        dom.geminiTestStatus.textContent = 'Testing connection...';
        dom.geminiTestStatus.style.color = '#38bdf8';
      }

      AppState.geminiKey = testKey;
      const check = await checkGeminiResponsiveness();
      if (check.responsive) {
        if (dom.geminiTestStatus) {
          dom.geminiTestStatus.textContent = '✅ Responsive & Ready!';
          dom.geminiTestStatus.style.color = '#10b981';
        }
      } else {
        if (dom.geminiTestStatus) {
          dom.geminiTestStatus.textContent = `❌ ${check.reason}`;
          dom.geminiTestStatus.style.color = '#ef4444';
        }
      }
    };
  }

  if (dom.cfgSttEngine) {
    dom.cfgSttEngine.onchange = () => {
      if (dom.whisperLoaderBox) {
        dom.whisperLoaderBox.style.display = dom.cfgSttEngine.value === 'whisper' ? 'block' : 'none';
      }
    };
  }

  if (dom.btnDownloadWhisper) {
    dom.btnDownloadWhisper.onclick = async () => {
      unlockAudio();
      dom.btnDownloadWhisper.disabled = true;
      if (dom.whisperStatusLabel) {
        dom.whisperStatusLabel.textContent = 'Downloading Whisper-tiny (~39 MB)...';
        dom.whisperStatusLabel.style.color = '#38bdf8';
      }
      if (onVoiceModelProgress) onVoiceModelProgress(true, 'Downloading Whisper STT (~39 MB)...', 0);
      try {
        await initWhisper((report) => {
          if (dom.whisperStatusLabel) dom.whisperStatusLabel.textContent = report.text || `Loading (${report.progress}%)`;
          if (onVoiceModelProgress) onVoiceModelProgress(true, report.text || `Whisper STT: ${report.progress}%`, report.progress);
        });
        if (dom.whisperStatusLabel) {
          dom.whisperStatusLabel.textContent = '✅ Whisper Ready!';
          dom.whisperStatusLabel.style.color = '#10b981';
        }
        if (onVoiceModelProgress) onVoiceModelProgress(false);
      } catch (err) {
        if (dom.whisperStatusLabel) {
          dom.whisperStatusLabel.textContent = `❌ Error: ${err.message}`;
          dom.whisperStatusLabel.style.color = '#ef4444';
        }
        if (onVoiceModelProgress) onVoiceModelProgress(false);
      } finally {
        dom.btnDownloadWhisper.disabled = false;
      }
    };
  }

  if (dom.cfgTtsEngine) {
    dom.cfgTtsEngine.onchange = () => {
      if (dom.ttsLoaderBox) {
        dom.ttsLoaderBox.style.display = dom.cfgTtsEngine.value === 'neural' ? 'block' : 'none';
      }
    };
  }

  if (dom.btnDownloadTts) {
    dom.btnDownloadTts.onclick = async () => {
      unlockAudio();
      dom.btnDownloadTts.disabled = true;
      if (dom.ttsStatusLabel) {
        dom.ttsStatusLabel.textContent = 'Downloading Neural Voice (~36 MB)...';
        dom.ttsStatusLabel.style.color = '#38bdf8';
      }
      if (onVoiceModelProgress) onVoiceModelProgress(true, 'Downloading Neural Voice (~36 MB)...', 0);
      try {
        await initNeuralTTS((report) => {
          if (dom.ttsStatusLabel) dom.ttsStatusLabel.textContent = report.text || `Loading (${report.progress}%)`;
          if (onVoiceModelProgress) onVoiceModelProgress(true, report.text || `Neural Voice: ${report.progress}%`, report.progress);
        });
        if (dom.ttsStatusLabel) {
          dom.ttsStatusLabel.textContent = '✅ Neural Voice Ready!';
          dom.ttsStatusLabel.style.color = '#10b981';
        }
        if (onVoiceModelProgress) onVoiceModelProgress(false);
      } catch (err) {
        if (dom.ttsStatusLabel) {
          dom.ttsStatusLabel.textContent = `❌ Error: ${err.message}`;
          dom.ttsStatusLabel.style.color = '#ef4444';
        }
        if (onVoiceModelProgress) onVoiceModelProgress(false);
      } finally {
        dom.btnDownloadTts.disabled = false;
      }
    };
  }

  if (dom.sliderScale) {
    dom.sliderScale.oninput = (e) => {
      AppState.avatarScale = parseFloat(e.target.value);
      if (dom.valScale) dom.valScale.textContent = `${AppState.avatarScale.toFixed(2)}x`;
      applyAvatarTransform();
    };
  }

  if (dom.sliderDist) {
    dom.sliderDist.oninput = (e) => {
      AppState.avatarDistance = parseFloat(e.target.value);
      if (dom.valDist) dom.valDist.textContent = `${(1.5 + AppState.avatarDistance).toFixed(2)}m`;
      applyAvatarTransform();
    };
  }

  if (dom.sliderHeight) {
    dom.sliderHeight.oninput = (e) => {
      AppState.avatarHeightOffset = parseFloat(e.target.value);
      if (dom.valHeight) dom.valHeight.textContent = `${AppState.avatarHeightOffset.toFixed(2)}m`;
      applyAvatarTransform();
    };
  }

  if (dom.btnTestVoice) {
    dom.btnTestVoice.onclick = () => {
      unlockAudio();
      if (dom.cfgVoiceSelect) {
        setActiveVoiceId(dom.cfgVoiceSelect.value);
      }
      dom.btnTestVoice.innerHTML = '<span>⏳ Synthesizing Voice...</span>';
      dom.btnTestVoice.style.background = '#6366f1';
      dom.btnTestVoice.disabled = true;

      speakAnnouncement("Hello! Testing voice synthesis and body language.", () => {
        if (dom.btnTestVoice) {
          dom.btnTestVoice.innerHTML = '<span>▶️ Test Speech & Motion</span>';
          dom.btnTestVoice.style.background = '#10b981';
          dom.btnTestVoice.disabled = false;
        }
      });
    };
  }

  if (dom.btnFocusToggleModal) {
    dom.btnFocusToggleModal.onclick = () => {
      unlockAudio();
      if (typeof window !== 'undefined' && window.toggleFocusMode) {
        window.toggleFocusMode();
      }
      syncFocusUI();
      if (syncMusicUI) syncMusicUI();
    };
  }

  if (dom.btnSaveSettings) {
    dom.btnSaveSettings.onclick = () => {
      unlockAudio();
      const prevEngine = AppState.engine;
      const prevModel = AppState.localModel;
      const prevSpace = AppState.spaceId;
      const prevStt = AppState.sttEngine;
      const prevTts = AppState.ttsEngine;

      if (dom.cfgGeminiKey) AppState.geminiKey = dom.cfgGeminiKey.value.trim();
      if (dom.cfgEngineSelect) AppState.engine = dom.cfgEngineSelect.value;
      if (dom.cfgRemoteUrl) {
        AppState.remoteServerUrl = dom.cfgRemoteUrl.value.trim() || 'http://localhost:8080';
      }
      if (dom.cfgLocalModel) AppState.localModel = dom.cfgLocalModel.value;
      if (dom.cfgSpaceSelect && dom.cfgSpaceSelect.value !== prevSpace) {
        switchSpace(dom.cfgSpaceSelect.value);
      }
      if (dom.cfgLiveSensitivity) AppState.liveSensitivity = dom.cfgLiveSensitivity.value;
      if (dom.cfgEchoGuard) AppState.echoGuardMode = dom.cfgEchoGuard.value;
      if (dom.cfgCompanionMood) AppState.companionMood = dom.cfgCompanionMood.value;
      if (dom.cfgSttEngine) AppState.sttEngine = dom.cfgSttEngine.value;
      if (dom.cfgTtsEngine) AppState.ttsEngine = dom.cfgTtsEngine.value;
      if (dom.cfgVoiceSelect) setActiveVoiceId(dom.cfgVoiceSelect.value);
      if (dom.cfgRemoteSttModel) AppState.remoteSttModel = dom.cfgRemoteSttModel.value;
      if (dom.cfgRemoteLlmModel) AppState.remoteLlmModel = dom.cfgRemoteLlmModel.value;
      if (dom.cfgRemoteTtsModel) AppState.remoteTtsModel = dom.cfgRemoteTtsModel.value;

      if (AppState.engine === 'remote') {
        selectRemoteModel({
          stt: AppState.remoteSttModel,
          llm: AppState.remoteLlmModel,
          tts: AppState.remoteTtsModel
        }).catch(() => {});
      }
      AppState.save();

      if (dom.modalSettings) dom.modalSettings.classList.remove('open');

      if (onEngineChange) {
        onEngineChange(prevEngine, prevModel, { prevStt, prevTts });
      }
    };
  }

  return {
    populateVoiceList,
    populateRemoteModels,
    syncFocusUI
  };
}
