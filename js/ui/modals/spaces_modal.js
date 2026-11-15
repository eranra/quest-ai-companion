/**
 * Quest AI Companion - Spaces Selection Modal Controller
 */

import { AppState } from '../../state.js';
import { switchSpace } from '../../spaces/index.js';
import { unlockAudio } from '../../audio/index.js';
import { speakAnnouncement } from '../../conversation_orchestrator.js';

export function initSpacesModal() {
  const modalSpaces = typeof document !== 'undefined' ? document.getElementById('modal-spaces') : null;
  const btnSpaces = typeof document !== 'undefined' ? document.getElementById('btn-spaces') : null;
  const btnCloseSpaces = typeof document !== 'undefined' ? document.getElementById('btn-close-spaces') : null;
  const btnConfirmSpace = typeof document !== 'undefined' ? document.getElementById('btn-confirm-space') : null;

  function syncSpaceCards() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.space-card').forEach(card => {
      card.classList.toggle('active', card.dataset.spaceId === AppState.spaceId);
    });
  }

  // Reactive listener: automatically highlight active space card when changed by AI tools or user
  if (AppState && typeof AppState.on === 'function') {
    AppState.on('change:spaceId', () => {
      syncSpaceCards();
    });
  }

  if (btnSpaces) {
    btnSpaces.onclick = () => {
      unlockAudio();
      syncSpaceCards();
      if (modalSpaces) modalSpaces.classList.add('open');
    };
  }

  if (btnCloseSpaces) {
    btnCloseSpaces.onclick = () => {
      if (modalSpaces) modalSpaces.classList.remove('open');
    };
  }

  if (typeof document !== 'undefined') {
    document.querySelectorAll('.space-card').forEach(card => {
      card.onclick = () => {
        unlockAudio();
        document.querySelectorAll('.space-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      };
    });
  }

  if (btnConfirmSpace) {
    btnConfirmSpace.onclick = () => {
      unlockAudio();
      const activeCard = typeof document !== 'undefined' ? document.querySelector('.space-card.active') : null;
      const selectedSpaceId = activeCard ? activeCard.dataset.spaceId : 'hall';
      const def = switchSpace(selectedSpaceId);
      if (modalSpaces) modalSpaces.classList.remove('open');
      if (def) {
        speakAnnouncement(`Entered ${def.name}.`);
      }
    };
  }

  return { syncSpaceCards };
}
