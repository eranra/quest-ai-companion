/**
 * Quest AI Companion - Dedicated Ambient Music Modal Controller
 */

import { unlockAudio } from '../../audio/index.js';
import {
  selectTrackById,
  setMusicVolume,
  toggleMusicMute,
  setMusicAutoMode,
  getMusicStatus,
  nextTrack,
  prevTrack
} from '../../audio/ambient_music.js';

export function initMusicModal() {
  const dom = {
    btnAmbientMusic: typeof document !== 'undefined' ? document.getElementById('btn-ambient-music') : null,
    modalMusic: typeof document !== 'undefined' ? document.getElementById('modal-music') : null,
    btnCloseMusic: typeof document !== 'undefined' ? document.getElementById('btn-close-music') : null,
    btnCloseMusicBottom: typeof document !== 'undefined' ? document.getElementById('btn-close-music-bottom') : null,
    musicCurrentTitle: typeof document !== 'undefined' ? document.getElementById('modal-music-current-title') : null,
    musicCurrentDesc: typeof document !== 'undefined' ? document.getElementById('modal-music-current-desc') : null,
    btnMusicToggleMain: typeof document !== 'undefined' ? document.getElementById('btn-music-toggle-main') : null,
    musicToggleMainLabel: typeof document !== 'undefined' ? document.getElementById('music-toggle-main-label') : null,
    cfgMusicTrackMain: typeof document !== 'undefined' ? document.getElementById('cfg-music-track-main') : null,
    btnMusicPrev: typeof document !== 'undefined' ? document.getElementById('btn-music-prev') : null,
    btnMusicNext: typeof document !== 'undefined' ? document.getElementById('btn-music-next') : null,
    sliderMusicVolumeMain: typeof document !== 'undefined' ? document.getElementById('slider-music-volume-main') : null,
    valMusicVolumeMain: typeof document !== 'undefined' ? document.getElementById('val-music-volume-main') : null,
    chkMusicAutoMain: typeof document !== 'undefined' ? document.getElementById('chk-music-auto-main') : null,
    // Settings modal music references to keep synchronized
    cfgMusicTrack: typeof document !== 'undefined' ? document.getElementById('cfg-music-track') : null,
    sliderMusicVolume: typeof document !== 'undefined' ? document.getElementById('slider-music-volume') : null,
    valMusicVolume: typeof document !== 'undefined' ? document.getElementById('val-music-volume') : null,
    btnMusicToggle: typeof document !== 'undefined' ? document.getElementById('btn-music-toggle') : null,
    musicToggleLabel: typeof document !== 'undefined' ? document.getElementById('music-toggle-label') : null,
    chkMusicAuto: typeof document !== 'undefined' ? document.getElementById('chk-music-auto') : null
  };

  function syncMusicUI() {
    const status = getMusicStatus();

    // Settings modal elements
    if (dom.cfgMusicTrack) dom.cfgMusicTrack.value = status.trackId;
    if (dom.sliderMusicVolume) dom.sliderMusicVolume.value = status.volume;
    if (dom.valMusicVolume) dom.valMusicVolume.textContent = `${Math.round(status.volume * 100)}%`;
    if (dom.chkMusicAuto) dom.chkMusicAuto.checked = status.autoMode;
    if (dom.btnMusicToggle && dom.musicToggleLabel) {
      dom.musicToggleLabel.textContent = status.isMuted ? '🔇 Muted' : '🔊 Playing';
      dom.btnMusicToggle.style.background = status.isMuted ? '#ef4444' : '#059669';
    }

    // Dedicated Ambient Music Modal elements
    if (dom.musicCurrentTitle) dom.musicCurrentTitle.textContent = status.currentTrack ? status.currentTrack.title : 'Ambient Soundscape';
    if (dom.musicCurrentDesc) dom.musicCurrentDesc.textContent = status.currentTrack ? status.currentTrack.desc : '';
    if (dom.cfgMusicTrackMain) dom.cfgMusicTrackMain.value = status.trackId;
    if (dom.sliderMusicVolumeMain) dom.sliderMusicVolumeMain.value = status.volume;
    if (dom.valMusicVolumeMain) dom.valMusicVolumeMain.textContent = `${Math.round(status.volume * 100)}%`;
    if (dom.chkMusicAutoMain) dom.chkMusicAutoMain.checked = status.autoMode;
    if (dom.btnMusicToggleMain && dom.musicToggleMainLabel) {
      dom.musicToggleMainLabel.textContent = status.isMuted ? '🔇 Muted' : '🔊 Playing';
      dom.btnMusicToggleMain.style.background = status.isMuted ? '#ef4444' : '#059669';
    }

    // Top Bar Ambient Music Icon state
    if (dom.btnAmbientMusic) {
      dom.btnAmbientMusic.innerHTML = `<span style="font-size: 15px;">${status.isMuted ? '🔇' : '🎵'}</span>`;
      dom.btnAmbientMusic.classList.toggle('active', !status.isMuted);
      dom.btnAmbientMusic.setAttribute('data-floating-tooltip', status.isMuted ? '🎵 Ambient Music: Muted (Click to open music controls)' : `🎵 Ambient Music: Playing - ${status.currentTrack ? status.currentTrack.title : 'Music'} (Click to open controls)`);
    }
  }

  // Settings modal music event listeners
  if (dom.btnMusicToggle) {
    dom.btnMusicToggle.onclick = () => {
      unlockAudio();
      toggleMusicMute();
      syncMusicUI();
    };
  }

  if (dom.cfgMusicTrack) {
    dom.cfgMusicTrack.onchange = (e) => {
      unlockAudio();
      selectTrackById(e.target.value);
      syncMusicUI();
    };
  }

  if (dom.sliderMusicVolume) {
    dom.sliderMusicVolume.oninput = (e) => {
      unlockAudio();
      const vol = setMusicVolume(e.target.value);
      if (dom.valMusicVolume) dom.valMusicVolume.textContent = `${Math.round(vol * 100)}%`;
    };
  }

  if (dom.chkMusicAuto) {
    dom.chkMusicAuto.onchange = (e) => {
      setMusicAutoMode(e.target.checked);
    };
  }

  // Dedicated Music Modal Listeners
  if (dom.btnAmbientMusic) {
    dom.btnAmbientMusic.onclick = () => {
      unlockAudio();
      syncMusicUI();
      if (dom.modalMusic) dom.modalMusic.classList.add('open');
    };
  }

  if (dom.btnCloseMusic) {
    dom.btnCloseMusic.onclick = () => {
      if (dom.modalMusic) dom.modalMusic.classList.remove('open');
    };
  }

  if (dom.btnCloseMusicBottom) {
    dom.btnCloseMusicBottom.onclick = () => {
      if (dom.modalMusic) dom.modalMusic.classList.remove('open');
    };
  }

  if (dom.btnMusicToggleMain) {
    dom.btnMusicToggleMain.onclick = () => {
      unlockAudio();
      toggleMusicMute();
      syncMusicUI();
    };
  }

  if (dom.cfgMusicTrackMain) {
    dom.cfgMusicTrackMain.onchange = (e) => {
      unlockAudio();
      selectTrackById(e.target.value);
      syncMusicUI();
    };
  }

  if (dom.btnMusicPrev) {
    dom.btnMusicPrev.onclick = () => {
      unlockAudio();
      prevTrack();
      syncMusicUI();
    };
  }

  if (dom.btnMusicNext) {
    dom.btnMusicNext.onclick = () => {
      unlockAudio();
      nextTrack();
      syncMusicUI();
    };
  }

  if (dom.sliderMusicVolumeMain) {
    dom.sliderMusicVolumeMain.oninput = (e) => {
      unlockAudio();
      setMusicVolume(e.target.value);
      syncMusicUI();
    };
  }

  if (dom.chkMusicAutoMain) {
    dom.chkMusicAutoMain.onchange = (e) => {
      setMusicAutoMode(e.target.checked);
      syncMusicUI();
    };
  }

  return { syncMusicUI };
}
