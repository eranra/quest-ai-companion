// Audio Module Facade & Web Audio Unlocker
import { initMicAnalyser, stopMicAnalyser, getAudioContext } from './vad.js';
import { speakReply, stopSpeaking, isSelfEcho, setLipSyncCallback } from './tts.js';
import { initSpeechRecognition, startListening, stopListening, setLiveMode } from './speech.js';

let audioUnlocked = false;

export function unlockAudio() {
  if (audioUnlocked) return;
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      // Prime mobile audio pipeline with an inaudible 0.01s utterance if idle
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        const dummy = new SpeechSynthesisUtterance(' ');
        dummy.volume = 0.01;
        window.speechSynthesis.speak(dummy);
      }
    }
    audioUnlocked = true;
  } catch (e) {}
}

export {
  initMicAnalyser,
  stopMicAnalyser,
  speakReply,
  stopSpeaking,
  isSelfEcho,
  setLipSyncCallback,
  initSpeechRecognition,
  startListening,
  stopListening,
  setLiveMode
};
