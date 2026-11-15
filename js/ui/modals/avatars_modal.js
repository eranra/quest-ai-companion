/**
 * Quest AI Companion - Avatars Selection Modal Controller
 */

import { AppState } from '../../state.js';
import { buildAvatar, getDefaultVoiceForAvatar } from '../../avatars/index.js';
import { avatarGroup, applyAvatarTransform, flipAvatarOrientation, resetCameraView } from '../../scene.js';
import { unlockAudio, setActiveVoiceId } from '../../audio/index.js';
import { speakAnnouncement } from '../../conversation_orchestrator.js';

export function initAvatarsModal({ onVoiceChanged } = {}) {
  const modalAvatars = typeof document !== 'undefined' ? document.getElementById('modal-avatars') : null;
  const btnAvatars = typeof document !== 'undefined' ? document.getElementById('btn-avatars') : null;
  const btnCloseAvatars = typeof document !== 'undefined' ? document.getElementById('btn-close-avatars') : null;
  const btnConfirmAvatar = typeof document !== 'undefined' ? document.getElementById('btn-confirm-avatar') : null;
  const btnModalTurn = typeof document !== 'undefined' ? document.getElementById('btn-modal-turn-avatar') : null;
  const btnModalRecenter = typeof document !== 'undefined' ? document.getElementById('btn-modal-recenter-cam') : null;

  function syncAvatarCards() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.avatar-card').forEach(card => {
      card.classList.toggle('active', card.dataset.avatarId === AppState.avatarId);
    });
  }

  // Reactive listener: automatically highlight active avatar card on AppState change
  if (AppState && typeof AppState.on === 'function') {
    AppState.on('change:avatarId', () => {
      syncAvatarCards();
    });
  }

  if (btnAvatars) {
    btnAvatars.onclick = () => {
      unlockAudio();
      syncAvatarCards();
      if (modalAvatars) modalAvatars.classList.add('open');
    };
  }

  if (btnCloseAvatars) {
    btnCloseAvatars.onclick = () => {
      if (modalAvatars) modalAvatars.classList.remove('open');
    };
  }

  if (typeof document !== 'undefined') {
    document.querySelectorAll('.avatar-card').forEach(card => {
      card.onclick = () => {
        unlockAudio();
        document.querySelectorAll('.avatar-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      };
    });
  }

  if (btnConfirmAvatar) {
    btnConfirmAvatar.onclick = () => {
      unlockAudio();
      const activeCard = typeof document !== 'undefined' ? document.querySelector('.avatar-card.active') : null;
      const selectedId = activeCard ? activeCard.dataset.avatarId : 'echo';
      AppState.avatarId = selectedId;
      AppState.save();

      buildAvatar(selectedId, avatarGroup);
      applyAvatarTransform();

      // Automatically align default voice to chosen character
      const defaultVoice = getDefaultVoiceForAvatar(selectedId);
      setActiveVoiceId(defaultVoice);
      if (onVoiceChanged) onVoiceChanged(defaultVoice);

      if (modalAvatars) modalAvatars.classList.remove('open');
      const avatarName = selectedId.charAt(0).toUpperCase() + selectedId.slice(1);
      speakAnnouncement(`Hello! I am now ready as ${avatarName}.`);
    };
  }

  if (btnModalTurn) {
    btnModalTurn.onclick = () => {
      unlockAudio();
      flipAvatarOrientation();
    };
  }

  if (btnModalRecenter) {
    btnModalRecenter.onclick = () => {
      unlockAudio();
      resetCameraView();
    };
  }

  return { syncAvatarCards };
}
