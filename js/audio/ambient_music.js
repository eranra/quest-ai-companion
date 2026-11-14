// Procedural Ambient Background Music Synthesizer & Controller
// Provides 8 continuous, comforting 2-3 minute ambient soundscapes for VR & Web
import { AppState } from '../state.js';

export const AMBIENT_TRACKS = [
  {
    id: 'serene_morning',
    title: 'Serene Morning',
    subtitle: '3:00 • Crystalline bell chimes & warm sub-pads',
    duration: 180, // 3 minutes
    scale: [293.66, 329.63, 369.99, 440.00, 493.88, 587.33, 659.25], // D Maj Pentatonic
    tempo: 4.8,
    type: 'bells_pad'
  },
  {
    id: 'zen_garden',
    title: 'Zen Temple Courtyard',
    subtitle: '3:00 • Singing bowls, bamboo flute & wind chimes',
    duration: 180,
    scale: [196.00, 233.08, 261.63, 293.66, 349.23, 392.00, 466.16], // G Dorian
    tempo: 5.5,
    type: 'bowls_flute'
  },
  {
    id: 'cozy_cafe',
    title: 'Cozy Coffeehouse',
    subtitle: '2:40 • Lo-Fi Rhodes chords & warm tape saturation',
    duration: 160, // 2:40
    scale: [174.61, 220.00, 261.63, 329.63, 349.23, 440.00], // F Maj7
    tempo: 4.0,
    type: 'rhodes_lofi'
  },
  {
    id: 'starlight',
    title: 'Starlight Voyage',
    subtitle: '3:00 • Cosmic shimmer synth & deep space pads',
    duration: 180,
    scale: [164.81, 196.00, 246.94, 293.66, 369.99, 493.88], // E Minor Lydian
    tempo: 6.0,
    type: 'cosmic_shimmer'
  },
  {
    id: 'gentle_rain',
    title: 'Gentle Rain Meditation',
    subtitle: '3:00 • Soft rainfall bed with melodic harp droplets',
    duration: 180,
    scale: [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25], // A Minor
    tempo: 3.2,
    type: 'rain_harp'
  },
  {
    id: 'autumn_hearth',
    title: 'Autumn Hearth',
    subtitle: '2:40 • Fireplace crackle & acoustic fingerpicking',
    duration: 160,
    scale: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25], // C Maj
    tempo: 3.6,
    type: 'acoustic_hearth'
  },
  {
    id: 'ocean_calm',
    title: 'Deep Ocean Waves',
    subtitle: '3:00 • Slow tidal swells & glass marimba tones',
    duration: 180,
    scale: [155.56, 196.00, 233.08, 311.13, 392.00, 466.16], // Eb Maj
    tempo: 6.5,
    type: 'ocean_marimba'
  },
  {
    id: 'twilight_piano',
    title: 'Twilight Reflection',
    subtitle: '3:00 • Intimate warm neo-classical piano progression',
    duration: 180,
    scale: [277.18, 329.63, 369.99, 415.30, 493.88, 554.37], // Db Maj
    tempo: 4.4,
    type: 'piano_warm'
  }
];

let audioCtx = null;
let masterGain = null;
let noiseNode = null;
let activeLoopTimer = null;
let trackElapsedTimer = null;

let isPlaying = false;
let currentTrackIndex = 0;
let trackPlaybackSeconds = 0;
let isMuted = false;
let autoMode = true; // Auto Mode by default: cycles to next track when one ends
let masterVolume = 0.15; // Pleasant, gentle 15% default volume

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Initializes Ambient Music engine with persistent user settings
 */
export function initAmbientMusic() {
  const savedEnabled = localStorage.getItem('quest_music_enabled');
  const savedVolume = localStorage.getItem('quest_music_volume');
  const savedTrack = localStorage.getItem('quest_music_track');
  const savedAuto = localStorage.getItem('quest_music_auto');

  if (savedVolume !== null) {
    masterVolume = parseFloat(savedVolume);
  }
  if (savedAuto !== null) {
    autoMode = savedAuto !== 'false';
  }
  if (savedTrack) {
    const idx = AMBIENT_TRACKS.findIndex(t => t.id === savedTrack);
    if (idx !== -1) currentTrackIndex = idx;
  }
  if (savedEnabled !== null) {
    isMuted = savedEnabled === 'false';
  }

  // Safe user gesture unlock listener
  const unlockAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  // Start initial playback if not muted
  if (!isMuted) {
    playCurrentTrack();
  }
}

/**
 * Procedural generative audio synthesizer for individual gentle notes & chord pads
 */
function playProceduralNote(ctx, freq, duration, noteType = 'bells_pad', baseVolume = 0.08) {
  if (!ctx || isMuted || !isPlaying) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const noteGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  if (noteType === 'bowls_flute') {
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc2.detune.setValueAtTime(4, now);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.5, now);
    filter.Q.setValueAtTime(3.0, now);
  } else if (noteType === 'rhodes_lofi') {
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc2.detune.setValueAtTime(-5, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
  } else if (noteType === 'cosmic_shimmer') {
    osc1.type = 'sine';
    osc2.type = 'sawtooth';
    osc2.detune.setValueAtTime(7, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);
  } else if (noteType === 'rain_harp') {
    osc1.type = 'triangle';
    osc2.type = 'sine';
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(300, now);
  } else if (noteType === 'piano_warm') {
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc2.detune.setValueAtTime(3, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, now);
  } else {
    // Default bells & warm pads
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc2.detune.setValueAtTime(6, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
  }

  osc1.frequency.setValueAtTime(freq, now);
  osc2.frequency.setValueAtTime(freq, now);

  // Soft attack and natural gentle decay envelope
  const attack = Math.min(0.6, duration * 0.2);
  const release = duration * 0.8;

  noteGain.gain.setValueAtTime(0.0001, now);
  noteGain.gain.exponentialRampToValueAtTime(baseVolume, now + attack);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(noteGain);
  noteGain.connect(masterGain);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + attack + release + 0.1);
  osc2.stop(now + attack + release + 0.1);
}

/**
 * Starts continuous generative sequence for the active ambient track
 */
export function playCurrentTrack() {
  stopCurrentTrack();
  const ctx = getAudioContext();
  if (!ctx || isMuted) {
    isPlaying = false;
    return;
  }

  isPlaying = true;
  trackPlaybackSeconds = 0;
  const currentTrack = AMBIENT_TRACKS[currentTrackIndex];
  localStorage.setItem('quest_music_track', currentTrack.id);

  // Periodic phrase generator
  const stepTime = currentTrack.tempo || 4.5;
  const scale = currentTrack.scale;

  const playChordPhrase = () => {
    if (!isPlaying || isMuted) return;

    // Pick 2-3 harmonious notes from scale
    const rootIdx = Math.floor(Math.random() * (scale.length - 2));
    const thirdIdx = (rootIdx + 2) % scale.length;
    const fifthIdx = (rootIdx + 4) % scale.length;

    const baseFreq = scale[rootIdx];
    const thirdFreq = scale[thirdIdx];
    const fifthFreq = scale[fifthIdx];

    const noteDur = stepTime * 1.8;
    playProceduralNote(ctx, baseFreq, noteDur, currentTrack.type, 0.07);
    setTimeout(() => {
      playProceduralNote(ctx, thirdFreq, noteDur * 0.8, currentTrack.type, 0.05);
    }, 450);
    setTimeout(() => {
      playProceduralNote(ctx, fifthFreq, noteDur * 0.7, currentTrack.type, 0.04);
    }, 900);
  };

  playChordPhrase();
  activeLoopTimer = setInterval(playChordPhrase, stepTime * 1000);

  // Track progress and automotive transition timer
  trackElapsedTimer = setInterval(() => {
    trackPlaybackSeconds += 1;
    if (trackPlaybackSeconds >= currentTrack.duration) {
      if (autoMode) {
        // Automotive Mode: Automatically transition to next track and loop forever
        nextTrack(true);
      } else {
        // Single Repeat Mode: Loop current track from beginning
        trackPlaybackSeconds = 0;
      }
    }
  }, 1000);

  updateVolumeGain();
}

export function stopCurrentTrack() {
  if (activeLoopTimer) {
    clearInterval(activeLoopTimer);
    activeLoopTimer = null;
  }
  if (trackElapsedTimer) {
    clearInterval(trackElapsedTimer);
    trackElapsedTimer = null;
  }
  isPlaying = false;
}

/**
 * Sets Master Ambient Music Volume (0.0 to 1.0)
 */
export function setMusicVolume(volume) {
  const clean = Math.max(0.0, Math.min(1.0, parseFloat(volume) || 0.15));
  masterVolume = clean;
  localStorage.setItem('quest_music_volume', clean.toString());
  updateVolumeGain();
  return clean;
}

export function getMusicVolume() {
  return masterVolume;
}

function updateVolumeGain() {
  if (!masterGain || !audioCtx) return;
  const now = audioCtx.currentTime;

  let targetGain = masterVolume;
  if (isMuted || !isPlaying) {
    targetGain = 0.0001;
  } else if (AppState && AppState.isSpeaking) {
    // Intelligent Speech Ducking: Ducks background music during avatar speaking
    targetGain = masterVolume * 0.55;
  }

  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.35);
}

/**
 * Toggles Music Mute / Off
 */
export function toggleMusicMute() {
  isMuted = !isMuted;
  localStorage.setItem('quest_music_enabled', (!isMuted).toString());
  if (!isMuted) {
    playCurrentTrack();
  } else {
    updateVolumeGain();
  }
  return isMuted;
}

export function setMusicMuted(muted) {
  isMuted = !!muted;
  localStorage.setItem('quest_music_enabled', (!isMuted).toString());
  if (!isMuted) {
    playCurrentTrack();
  } else {
    updateVolumeGain();
  }
  return isMuted;
}

export function isMusicMuted() {
  return isMuted;
}

/**
 * Enables or disables Automotive mode (cycling tracks automatically vs repeating single)
 */
export function setMusicAutoMode(enabled) {
  autoMode = !!enabled;
  localStorage.setItem('quest_music_auto', autoMode.toString());
  return autoMode;
}

export function getMusicAutoMode() {
  return autoMode;
}

/**
 * Changes to a specific track by ID
 */
export function selectTrackById(trackId) {
  const idx = AMBIENT_TRACKS.findIndex(t => t.id === trackId);
  if (idx !== -1) {
    currentTrackIndex = idx;
    // When user explicitly selects a track, default to repeating it unless auto is explicitly on
    playCurrentTrack();
    return AMBIENT_TRACKS[currentTrackIndex];
  }
  return null;
}

/**
 * Advance to next track (called automatically or by user)
 */
export function nextTrack(fromAuto = false) {
  currentTrackIndex = (currentTrackIndex + 1) % AMBIENT_TRACKS.length;
  playCurrentTrack();
  return AMBIENT_TRACKS[currentTrackIndex];
}

/**
 * Return to previous track
 */
export function prevTrack() {
  currentTrackIndex = (currentTrackIndex - 1 + AMBIENT_TRACKS.length) % AMBIENT_TRACKS.length;
  playCurrentTrack();
  return AMBIENT_TRACKS[currentTrackIndex];
}

/**
 * Return current music playback status
 */
export function getMusicStatus() {
  const current = AMBIENT_TRACKS[currentTrackIndex];
  return {
    isPlaying: isPlaying && !isMuted,
    isMuted,
    autoMode,
    volume: masterVolume,
    trackIndex: currentTrackIndex,
    trackId: current.id,
    trackTitle: current.title,
    trackSubtitle: current.subtitle,
    duration: current.duration,
    playbackSeconds: trackPlaybackSeconds
  };
}

/**
 * Label for In-VR HUD Button
 */
export function getMusicHUDLabel() {
  if (isMuted || !isPlaying) {
    return '🎵 Music: OFF';
  }
  const current = AMBIENT_TRACKS[currentTrackIndex];
  const shortTitle = current.title.split(' ')[0];
  return `🎵 ${shortTitle}`;
}

// Hook speaking status for speech ducking
if (typeof window !== 'undefined') {
  setInterval(() => {
    updateVolumeGain();
  }, 250);
}
