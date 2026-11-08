// UI Controllers for Settings, Space Selection, and Avatar Selection Modals
import { AppState } from '../state.js';
import { buildAvatar } from '../avatars/index.js';
import { avatarGroup, applyAvatarTransform, flipAvatarOrientation, resetCameraView } from '../scene.js';
import { unlockAudio, speakReply, initWhisper, initNeuralTTS, isWhisperReady, isNeuralTTSReady } from '../audio/index.js';
import { checkGeminiResponsiveness } from '../ai.js';
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
    engineSummaryHint: document.getElementById('engine-summary-hint'),
    cfgVoiceSelect: document.getElementById('cfg-voice-select'),
    btnTestVoice: document.getElementById('btn-test-voice'),
    sliderScale: document.getElementById('slider-scale'),
    sliderDist: document.getElementById('slider-dist'),
    valScale: document.getElementById('val-scale'),
    valDist: document.getElementById('val-dist'),
    cfgSttEngine: document.getElementById('cfg-stt-engine'),
    whisperLoaderBox: document.getElementById('whisper-loader-box'),
    btnDownloadWhisper: document.getElementById('btn-download-whisper'),
    whisperStatusLabel: document.getElementById('whisper-status-label'),
    cfgTtsEngine: document.getElementById('cfg-tts-engine'),
    ttsLoaderBox: document.getElementById('tts-loader-box'),
    btnDownloadTts: document.getElementById('btn-download-tts'),
    ttsStatusLabel: document.getElementById('tts-status-label')
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

  // Populate voice dropdown
  function populateVoiceList() {
    if (!('speechSynthesis' in window) || !dom.cfgVoiceSelect) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return;
    dom.cfgVoiceSelect.innerHTML = '';

    const savedVoice = localStorage.getItem('quest_voice_name');
    voices.forEach(voice => {
      const option = document.createElement('option');
      option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' [Default]' : ''}`;
      option.value = voice.name;
      if (savedVoice ? voice.name === savedVoice : (voice.lang.startsWith('en') && voice.name.includes('Natural'))) {
        option.selected = true;
      }
      dom.cfgVoiceSelect.appendChild(option);
    });
  }

  if ('speechSynthesis' in window) {
    populateVoiceList();
    window.speechSynthesis.onvoiceschanged = populateVoiceList;
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
      dom.modalAvatars.classList.remove('open');
      speakReply(`Hello! I am now ready as your companion.`);
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
      dom.sliderScale.value = AppState.avatarScale;
      dom.sliderDist.value = AppState.avatarDistance;
      dom.valScale.textContent = `${AppState.avatarScale.toFixed(2)}x`;
      dom.valDist.textContent = `${(1.5 + AppState.avatarDistance).toFixed(2)}m`;

      if (AppState.engine === 'cloud') {
        dom.groupGemini.style.display = 'block';
        dom.groupLocalModel.style.display = 'none';
        dom.engineSummaryHint.textContent = 'Connects to Google Gemini 2.5 Flash cloud API for fast answers.';
      } else {
        dom.groupGemini.style.display = 'none';
        dom.groupLocalModel.style.display = 'block';
        dom.engineSummaryHint.textContent = 'Runs offline on your device GPU with Qwen 2.5. Zero API keys, completely private.';
      }

      dom.modalSettings.classList.add('open');
    };
  }

  if (dom.btnCloseSettings) {
    dom.btnCloseSettings.onclick = () => dom.modalSettings.classList.remove('open');
  }

  if (dom.cfgEngineSelect) {
    dom.cfgEngineSelect.onchange = () => {
      if (dom.cfgEngineSelect.value === 'cloud') {
        dom.groupGemini.style.display = 'block';
        dom.groupLocalModel.style.display = 'none';
        dom.engineSummaryHint.textContent = 'Connects to Google Gemini 2.5 Flash cloud API for fast answers.';
      } else {
        dom.groupGemini.style.display = 'none';
        dom.groupLocalModel.style.display = 'block';
        dom.engineSummaryHint.textContent = 'Runs offline on your device GPU with Qwen 2.5. Zero API keys, completely private.';
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

  if (dom.btnTestVoice) {
    dom.btnTestVoice.onclick = () => {
      unlockAudio();
      localStorage.setItem('quest_voice_name', dom.cfgVoiceSelect.value);
      speakReply("Hello Eran! This is a test of my speech synthesis voice and speaking body language.");
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
        localStorage.setItem('quest_voice_name', dom.cfgVoiceSelect.value);
      }
      AppState.save();

      dom.modalSettings.classList.remove('open');

      if (onEngineChange) {
        onEngineChange(prevEngine, prevModel, { prevStt, prevTts });
      }
    };
  }

  return { syncAvatarCards, syncSpaceCards, populateVoiceList };
}
