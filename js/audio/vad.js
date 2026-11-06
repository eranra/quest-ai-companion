// Voice Activity & Microphone Audio Level Analyser (Web Audio API)
// Provides continuous microphone level detection and live visualization with zero system beeps

let audioContext = null;
let mediaStream = null;
let analyserNode = null;
let dataArray = null;
let animationFrameId = null;
let isMetering = false;
let volumeCallback = null;

export async function initMicAnalyser(onVolume) {
  volumeCallback = onVolume;
  if (isMetering && analyserNode) return true;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume().catch(() => {});
    }

    if (!mediaStream) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('getUserMedia not available');
        return false;
      }
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    }

    const source = audioContext.createMediaStreamSource(mediaStream);
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.5;
    source.connect(analyserNode);

    dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    isMetering = true;
    startMeterLoop();
    return true;
  } catch (err) {
    console.warn('Could not initialize microphone analyser:', err);
    return false;
  }
}

function startMeterLoop() {
  if (!isMetering || !analyserNode) return;

  function loop() {
    if (!isMetering || !analyserNode) return;
    analyserNode.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length; // 0 to 255
    const normalized = Math.min(1.0, Math.max(0.0, (avg - 10) / 70)); // scaled 0 to 1

    if (volumeCallback) {
      volumeCallback(normalized);
    }

    animationFrameId = requestAnimationFrame(loop);
  }
  loop();
}

export function stopMicAnalyser() {
  isMetering = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  if (volumeCallback) {
    volumeCallback(0);
  }
}

export function getAudioContext() {
  return audioContext;
}
