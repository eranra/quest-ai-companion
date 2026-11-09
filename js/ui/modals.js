// UI Controllers for Settings, Space Selection, and Avatar Selection Modals
import { AppState } from '../state.js';
import { buildAvatar } from '../avatars/index.js';
import { avatarGroup, applyAvatarTransform, flipAvatarOrientation, resetCameraView } from '../scene.js';
import { unlockAudio, speakReply, initWhisper, initNeuralTTS, isWhisperReady, isNeuralTTSReady, PIPER_VOICE_CONFIGS, getActiveVoiceId, setActiveVoiceId, getDefaultVoiceForAvatar } from '../audio/index.js';
import { checkGeminiResponsiveness, checkRemoteServerResponsiveness, isQuestBrowser, checkQuestWebGPUFlagStatus, checkWebGPUSupport, selectRemoteModel, fetchRemoteModels, getCachedRemoteModels } from '../ai.js';
import { switchSpace, SPACE_DEFINITIONS } from '../spaces/index.js';

export function initModals({ onEngineChange, onVoiceModelProgress } = {}) {
  const dom = {
    modalAvatars: document.getElementById('modal-avatars'),
    modalSpaces: document.getElementById('modal-spaces'),
    modalSettings: document.getElementById('modal-settings'),
    btnAvatars: document.getElementById('btn-avatars'),
    btnSpaces: document.getElementById('btn-spaces'),
    btnSettings: document.getElementById('btn-settings'),
    btnCloseAvatars: document.getElementById('btn-close-avatars'),
    btnCloseSpaces: document.getElementById('btn-close-spaces'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnConfirmAvatar: document.getElementById('btn-confirm-avatar'),
    btnConfirmSpace: document.getElementById('btn-confirm-space'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    cfgGeminiKey: document.getElementById('cfg-gemini-key'),
    cfgEngineSelect: document.getElementById('cfg-engine-select'),
    cfgLocalModel: document.getElementById('cfg-local-model'),
    cfgSpaceSelect: document.getElementById('cfg-space-select'),
    cfgLiveSensitivity: document.getElementById('cfg-live-sensitivity'),
    cfgEchoGuard: document.getElementById('cfg-echo-guard'),
    groupLocalModel: document.getElementById('group-local-model'),
    groupGemini: document.getElementById('group-gemini'),
    btnTestGemini: document.getElementById('btn-test-gemini'),
    geminiTestStatus: document.getElementById('gemini-test-status'),
    groupRemote: document.getElementById('group-remote'),
    cfgRemoteUrl: document.getElementById('cfg-remote-url'),
    btnTestRemote: document.getElementById('btn-test-remote'),
    remoteTestStatus: document.getElementById('remote-test-status'),
    remoteModelSelection: document.getElementById('remote-model-selection'),
    cfgRemoteSttModel: document.getElementById('cfg-remote-stt-model'),
    cfgRemoteLlmModel: document.getElementById('cfg-remote-llm-model'),
    cfgRemoteTtsModel: document.getElementById('cfg-remote-tts-model'),
    engineSummaryHint: document.getElementById('engine-summary-hint'),
    cfgVoiceSelect: document.getElementById('cfg-voice-select'),
    btnTestVoice: document.getElementById('btn-test-voice'),
    sliderScale: document.getElementById('slider-scale'),
    sliderDist: document.getElementById('slider-dist'),
    sliderHeight: document.getElementById('slider-height'),
    valScale: document.getElementById('val-scale'),
    valDist: document.getElementById('val-dist'),
    valHeight: document.getElementById('val-height'),
    cfgSttEngine: document.getElementById('cfg-stt-engine'),
    whisperLoaderBox: document.getElementById('whisper-loader-box'),
    btnDownloadWhisper: document.getElementById('btn-download-whisper'),
    whisperStatusLabel: document.getElementById('whisper-status-label'),
    cfgTtsEngine: document.getElementById('cfg-tts-engine'),
    ttsLoaderBox: document.getElementById('tts-loader-box'),
    btnDownloadTts: document.getElementById('btn-download-tts'),
    ttsStatusLabel: document.getElementById('tts-status-label'),
    modalQuestGpuAlert: document.getElementById('modal-quest-gpu-alert'),
    btnCloseQuestAlert: document.getElementById('btn-close-quest-alert'),
    btnQuestSwitchGemini: document.getElementById('btn-quest-switch-gemini'),
    btnQuestAlertGotIt: document.getElementById('btn-quest-alert-got-it'),
    questGpuFlagStatus: document.getElementById('quest-gpu-flag-status')
  };

  // Sync active avatar card
  function syncAvatarCards() {
    document.querySelectorAll('.avatar-card').forEach(card => {
      card.classList.toggle('active', card.dataset.avatarId === AppState.avatarId);
    });
  }

  // Sync active space card
  function syncSpaceCards() {
    document.querySelectorAll('.space-card').forEach(card => {
      card.classList.toggle('active', card.dataset.spaceId === AppState.spaceId);
    });
  }

  // Populate voice dropdown with character-aligned Piper voices & optional OS voices
  function populateVoiceList() {
    if (!dom.cfgVoiceSelect) return;
    dom.cfgVoiceSelect.innerHTML = '';
    const currentActiveVoice = getActiveVoiceId();
    const currentAvatarId = localStorage.getItem('quest_avatar_id') || AppState.avatarId || 'echo';
    const avatarDefaultVoice = getDefaultVoiceForAvatar(currentAvatarId);

    // Group 1: Fast Lightweight Neural Piper Voices (Offline, non-robotic, sub-second streaming)
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
    const osVoices = ('speechSynthesis' in window) ? window.speechSynthesis.getVoices() : [];
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
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = populateVoiceList;
  }

  // Allow manual voice override anytime user changes voice dropdown
  if (dom.cfgVoiceSelect) {
    dom.cfgVoiceSelect.onchange = () => {
      setActiveVoiceId(dom.cfgVoiceSelect.value);
    };
  }

  // Avatar Modal Handlers
  if (dom.btnAvatars) {
    dom.btnAvatars.onclick = () => {
      unlockAudio();
      syncAvatarCards();
      dom.modalAvatars.classList.add('open');
    };
  }

  if (dom.btnCloseAvatars) {
    dom.btnCloseAvatars.onclick = () => dom.modalAvatars.classList.remove('open');
  }

  document.querySelectorAll('.avatar-card').forEach(card => {
    card.onclick = () => {
      unlockAudio();
      document.querySelectorAll('.avatar-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    };
  });

  if (dom.btnConfirmAvatar) {
    dom.btnConfirmAvatar.onclick = () => {
      unlockAudio();
      const activeCard = document.querySelector('.avatar-card.active');
      const selectedId = activeCard ? activeCard.dataset.avatarId : 'echo';
      AppState.avatarId = selectedId;
      AppState.save();

      buildAvatar(selectedId, avatarGroup);
      applyAvatarTransform();

      // Automatically align default voice to chosen character (e.g. Maya -> Amy Female, Alex/Ollie -> Ryan Male)
      const defaultVoice = getDefaultVoiceForAvatar(selectedId);
      setActiveVoiceId(defaultVoice);
      populateVoiceList();

      dom.modalAvatars.classList.remove('open');
      const avatarName = selectedId.charAt(0).toUpperCase() + selectedId.slice(1);
      speakReply(`Hello! I am now ready as ${avatarName}.`);
    };
  }

  const btnModalTurn = document.getElementById('btn-modal-turn-avatar');
  if (btnModalTurn) {
    btnModalTurn.onclick = () => {
      unlockAudio();
      flipAvatarOrientation();
    };
  }

  const btnModalRecenter = document.getElementById('btn-modal-recenter-cam');
  if (btnModalRecenter) {
    btnModalRecenter.onclick = () => {
      unlockAudio();
      resetCameraView();
    };
  }

  // Space Modal Handlers
  if (dom.btnSpaces) {
    dom.btnSpaces.onclick = () => {
      unlockAudio();
      syncSpaceCards();
      dom.modalSpaces.classList.add('open');
    };
  }

  if (dom.btnCloseSpaces) {
    dom.btnCloseSpaces.onclick = () => dom.modalSpaces.classList.remove('open');
  }

  document.querySelectorAll('.space-card').forEach(card => {
    card.onclick = () => {
      unlockAudio();
      document.querySelectorAll('.space-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    };
  });

  if (dom.btnConfirmSpace) {
    dom.btnConfirmSpace.onclick = () => {
      unlockAudio();
      const activeCard = document.querySelector('.space-card.active');
      const selectedSpaceId = activeCard ? activeCard.dataset.spaceId : 'hall';
      const def = switchSpace(selectedSpaceId);
      dom.modalSpaces.classList.remove('open');
      if (def) {
        speakReply(`Entered ${def.name}.`);
      }
    };
  }

  function populateRemoteModels(models, active) {
    if (!models || !dom.remoteModelSelection) return;
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

  // Settings Modal Handlers
  if (dom.btnSettings) {
    dom.btnSettings.onclick = () => {
      unlockAudio();
      dom.cfgGeminiKey.value = AppState.geminiKey;
      dom.cfgEngineSelect.value = AppState.engine;
      dom.cfgLocalModel.value = AppState.localModel;
      if (dom.cfgSpaceSelect) dom.cfgSpaceSelect.value = AppState.spaceId;
      dom.cfgLiveSensitivity.value = AppState.liveSensitivity || 'normal';
      dom.cfgEchoGuard.value = AppState.echoGuardMode || 'smart';
      if (dom.cfgSttEngine) {
        dom.cfgSttEngine.value = AppState.sttEngine || 'native';
        dom.whisperLoaderBox.style.display = dom.cfgSttEngine.value === 'whisper' ? 'block' : 'none';
        dom.whisperStatusLabel.textContent = isWhisperReady() ? '✅ Whisper Ready' : 'Ready to download';
      }
      if (dom.cfgTtsEngine) {
        dom.cfgTtsEngine.value = AppState.ttsEngine || 'native';
        dom.ttsLoaderBox.style.display = dom.cfgTtsEngine.value === 'neural' ? 'block' : 'none';
        dom.ttsStatusLabel.textContent = isNeuralTTSReady() ? '✅ Neural TTS Ready' : 'Ready to download';
      }
      populateVoiceList();
      dom.sliderScale.value = AppState.avatarScale;
      dom.sliderDist.value = AppState.avatarDistance;
      if (dom.sliderHeight) dom.sliderHeight.value = AppState.avatarHeightOffset || 0.0;
      dom.valScale.textContent = `${AppState.avatarScale.toFixed(2)}x`;
      dom.valDist.textContent = `${(1.5 + AppState.avatarDistance).toFixed(2)}m`;
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

      function updateEngineVisibility(engine) {
        if (engine === 'cloud') {
          if (dom.groupGemini) dom.groupGemini.style.display = 'block';
          if (dom.groupLocalModel) dom.groupLocalModel.style.display = 'none';
          if (dom.groupRemote) dom.groupRemote.style.display = 'none';
          dom.engineSummaryHint.textContent = 'Connects to Google Gemini 2.5 Flash cloud API for fast answers.';
        } else if (engine === 'remote') {
          if (dom.groupGemini) dom.groupGemini.style.display = 'none';
          if (dom.groupLocalModel) dom.groupLocalModel.style.display = 'none';
          if (dom.groupRemote) dom.groupRemote.style.display = 'block';
          dom.engineSummaryHint.textContent = 'Connects to your local PC/Mac server over Wi-Fi for ultra-low latency & 8B models.';
        } else {
          if (dom.groupGemini) dom.groupGemini.style.display = 'none';
          if (dom.groupLocalModel) dom.groupLocalModel.style.display = 'block';
          if (dom.groupRemote) dom.groupRemote.style.display = 'none';
          dom.engineSummaryHint.textContent = 'Runs 100% offline via CPU WebAssembly (WASM). Zero API keys, completely private.';
        }
      }

      updateEngineVisibility(AppState.engine);

      const questNotice = document.getElementById('quest-engine-notice');
      if (questNotice) {
        questNotice.style.display = isQuestBrowser() ? 'block' : 'none';
      }

      if (dom.questGpuFlagStatus) {
        dom.questGpuFlagStatus.innerHTML = '<span style="color: #34d399;">🟢 Local Engine: CPU WebAssembly (WASM) — 100% Native on Meta Quest 3, zero flags needed!</span>';
      }

      dom.modalSettings.classList.add('open');
    };
  }

  if (dom.btnCloseSettings) {
    dom.btnCloseSettings.onclick = () => dom.modalSettings.classList.remove('open');
  }

  if (dom.cfgEngineSelect) {
    dom.cfgEngineSelect.onchange = () => {
      const selected = dom.cfgEngineSelect.value;
      if (selected === 'cloud') {
        if (dom.groupGemini) dom.groupGemini.style.display = 'block';
        if (dom.groupLocalModel) dom.groupLocalModel.style.display = 'none';
        if (dom.groupRemote) dom.groupRemote.style.display = 'none';
        dom.engineSummaryHint.textContent = 'Connects to Google Gemini 2.5 Flash cloud API for fast answers.';
      } else if (selected === 'remote') {
        if (dom.groupGemini) dom.groupGemini.style.display = 'none';
        if (dom.groupLocalModel) dom.groupLocalModel.style.display = 'none';
        if (dom.groupRemote) dom.groupRemote.style.display = 'block';
        dom.engineSummaryHint.textContent = 'Connects to your local PC/Mac server over Wi-Fi for ultra-low latency & 8B models.';
      } else {
        if (dom.groupGemini) dom.groupGemini.style.display = 'none';
        if (dom.groupLocalModel) dom.groupLocalModel.style.display = 'block';
        if (dom.groupRemote) dom.groupRemote.style.display = 'none';
        dom.engineSummaryHint.textContent = 'Runs 100% offline via CPU WebAssembly (WASM). Zero API keys, completely private.';
      }
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
      const testKey = dom.cfgGeminiKey.value.trim();
      if (!testKey) {
        dom.geminiTestStatus.textContent = '⚠️ Enter API key first';
        dom.geminiTestStatus.style.color = '#f59e0b';
        return;
      }
      dom.geminiTestStatus.textContent = 'Testing connection...';
      dom.geminiTestStatus.style.color = '#38bdf8';

      AppState.geminiKey = testKey;
      const check = await checkGeminiResponsiveness();
      if (check.responsive) {
        dom.geminiTestStatus.textContent = '✅ Responsive & Ready!';
        dom.geminiTestStatus.style.color = '#10b981';
      } else {
        dom.geminiTestStatus.textContent = `❌ ${check.reason}`;
        dom.geminiTestStatus.style.color = '#ef4444';
      }
    };
  }

  // Voice Engine (STT: Whisper) Handlers
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
      dom.whisperStatusLabel.textContent = 'Downloading Whisper-tiny (~39 MB)...';
      dom.whisperStatusLabel.style.color = '#38bdf8';
      if (onVoiceModelProgress) onVoiceModelProgress(true, 'Downloading Whisper STT (~39 MB)...', 0);
      try {
        await initWhisper((report) => {
          dom.whisperStatusLabel.textContent = report.text || `Loading (${report.progress}%)`;
          if (onVoiceModelProgress) onVoiceModelProgress(true, report.text || `Whisper STT: ${report.progress}%`, report.progress);
        });
        dom.whisperStatusLabel.textContent = '✅ Whisper Ready!';
        dom.whisperStatusLabel.style.color = '#10b981';
        if (onVoiceModelProgress) onVoiceModelProgress(false);
      } catch (err) {
        dom.whisperStatusLabel.textContent = `❌ Error: ${err.message}`;
        dom.whisperStatusLabel.style.color = '#ef4444';
        if (onVoiceModelProgress) onVoiceModelProgress(false);
      } finally {
        dom.btnDownloadWhisper.disabled = false;
      }
    };
  }

  // Voice Engine (TTS: Neural) Handlers
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
      dom.ttsStatusLabel.textContent = 'Downloading Neural Voice (~36 MB)...';
      dom.ttsStatusLabel.style.color = '#38bdf8';
      if (onVoiceModelProgress) onVoiceModelProgress(true, 'Downloading Neural Voice (~36 MB)...', 0);
      try {
        await initNeuralTTS((report) => {
          dom.ttsStatusLabel.textContent = report.text || `Loading (${report.progress}%)`;
          if (onVoiceModelProgress) onVoiceModelProgress(true, report.text || `Neural Voice: ${report.progress}%`, report.progress);
        });
        dom.ttsStatusLabel.textContent = '✅ Neural Voice Ready!';
        dom.ttsStatusLabel.style.color = '#10b981';
        if (onVoiceModelProgress) onVoiceModelProgress(false);
      } catch (err) {
        dom.ttsStatusLabel.textContent = `❌ Error: ${err.message}`;
        dom.ttsStatusLabel.style.color = '#ef4444';
        if (onVoiceModelProgress) onVoiceModelProgress(false);
      } finally {
        dom.btnDownloadTts.disabled = false;
      }
    };
  }

  if (dom.sliderScale) {
    dom.sliderScale.oninput = (e) => {
      AppState.avatarScale = parseFloat(e.target.value);
      dom.valScale.textContent = `${AppState.avatarScale.toFixed(2)}x`;
      applyAvatarTransform();
    };
  }

  if (dom.sliderDist) {
    dom.sliderDist.oninput = (e) => {
      AppState.avatarDistance = parseFloat(e.target.value);
      dom.valDist.textContent = `${(1.5 + AppState.avatarDistance).toFixed(2)}m`;
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

      speakReply("Hello! Testing voice synthesis and body language.", () => {
        dom.btnTestVoice.innerHTML = '<span>▶️ Test Speech & Motion</span>';
        dom.btnTestVoice.style.background = '#10b981';
        dom.btnTestVoice.disabled = false;
      });
    };
  }

  function showQuestGPUAlert() {
    unlockAudio();
    if (dom.modalQuestGpuAlert) {
      dom.modalQuestGpuAlert.classList.add('open');
    }
  }

  function hideQuestGPUAlert() {
    if (dom.modalQuestGpuAlert) {
      dom.modalQuestGpuAlert.classList.remove('open');
    }
  }

  if (dom.btnCloseQuestAlert) {
    dom.btnCloseQuestAlert.onclick = () => hideQuestGPUAlert();
  }

  if (dom.btnQuestAlertGotIt) {
    dom.btnQuestAlertGotIt.onclick = () => hideQuestGPUAlert();
  }

  if (dom.btnQuestSwitchGemini) {
    dom.btnQuestSwitchGemini.onclick = () => {
      unlockAudio();
      const prevEngine = AppState.engine;
      const prevModel = AppState.localModel;
      AppState.engine = 'cloud';
      AppState.save();
      hideQuestGPUAlert();
      if (dom.cfgEngineSelect) {
        dom.cfgEngineSelect.value = 'cloud';
        dom.groupGemini.style.display = 'block';
        dom.groupLocalModel.style.display = 'none';
        dom.engineSummaryHint.textContent = 'Connects to Google Gemini 2.5 Flash cloud API for fast answers.';
      }
      if (onEngineChange) {
        onEngineChange(prevEngine, prevModel, { prevStt: AppState.sttEngine, prevTts: AppState.ttsEngine });
      }
      if (!AppState.geminiKey || !AppState.geminiKey.trim()) {
        dom.modalSettings.classList.add('open');
        if (dom.cfgGeminiKey) dom.cfgGeminiKey.focus();
        speakReply("Switched to Google Gemini Cloud. Enter your free API key in settings to talk!");
      } else {
        speakReply("Switched to Google Gemini Cloud mode. I am ready to talk with you!");
      }
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

      AppState.geminiKey = dom.cfgGeminiKey.value.trim();
      AppState.engine = dom.cfgEngineSelect.value;
      if (dom.cfgRemoteUrl) {
        AppState.remoteServerUrl = dom.cfgRemoteUrl.value.trim() || 'http://localhost:8080';
      }
      AppState.localModel = dom.cfgLocalModel.value;
      if (dom.cfgSpaceSelect && dom.cfgSpaceSelect.value !== prevSpace) {
        switchSpace(dom.cfgSpaceSelect.value);
      }
      AppState.liveSensitivity = dom.cfgLiveSensitivity.value;
      AppState.echoGuardMode = dom.cfgEchoGuard.value;
      if (dom.cfgSttEngine) {
        AppState.sttEngine = dom.cfgSttEngine.value;
      }
      if (dom.cfgTtsEngine) {
        AppState.ttsEngine = dom.cfgTtsEngine.value;
      }
      if (dom.cfgVoiceSelect) {
        setActiveVoiceId(dom.cfgVoiceSelect.value);
      }
      if (dom.cfgRemoteSttModel) {
        AppState.remoteSttModel = dom.cfgRemoteSttModel.value;
      }
      if (dom.cfgRemoteLlmModel) {
        AppState.remoteLlmModel = dom.cfgRemoteLlmModel.value;
      }
      if (dom.cfgRemoteTtsModel) {
        AppState.remoteTtsModel = dom.cfgRemoteTtsModel.value;
      }
      if (AppState.engine === 'remote') {
        selectRemoteModel({
          stt: AppState.remoteSttModel,
          llm: AppState.remoteLlmModel,
          tts: AppState.remoteTtsModel
        }).catch(() => {});
      }
      AppState.save();

      dom.modalSettings.classList.remove('open');

      if (onEngineChange) {
        onEngineChange(prevEngine, prevModel, { prevStt, prevTts });
      }
    };
  }

  return { 
    syncAvatarCards, 
    syncSpaceCards, 
    populateVoiceList,
    showQuestGPUAlert,
    hideQuestGPUAlert
  };
}
