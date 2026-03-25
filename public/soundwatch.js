let audioContext = null;
let analyser = null;
let microphone = null;
let soundLoop = null;
let mediaStream = null;

let ambientRms = 10;
let lastSpikeTime = 0;
let spikeHits = 0;
let lastTriggerTime = 0;

const SPIKE_WINDOW_MS = 2500;
const TRIGGER_COOLDOWN_MS = 9000;

export async function startSoundWatch(state, dom, onDanger) {
  if (state.soundWatchActive) return;
  state.soundWatchActive = true;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    microphone = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.2;

    microphone.connect(analyser);

    const timeData = new Uint8Array(analyser.fftSize);

    function checkAudio() {
      if (!state.soundWatchActive || !analyser) return;

      analyser.getByteTimeDomainData(timeData);

      let peakDeviation = 0;
      let squareSum = 0;

      for (let i = 0; i < timeData.length; i++) {
        const deviation = Math.abs(timeData[i] - 128);
        if (deviation > peakDeviation) peakDeviation = deviation;
        squareSum += deviation * deviation;
      }

      const rms = Math.sqrt(squareSum / timeData.length);
      const now = Date.now();

      const suddenSpike =
        peakDeviation > 58 &&
        rms > ambientRms * 1.9 + 6;

      const mediumSpike =
        peakDeviation > 48 &&
        rms > ambientRms * 2.2 + 8;

      const isHazardSpike = suddenSpike || mediumSpike;

      if (isHazardSpike) {
        if (now - lastSpikeTime > 600) {
          if (now - lastSpikeTime > SPIKE_WINDOW_MS) {
            spikeHits = 0;
          }

          spikeHits += 1;
          lastSpikeTime = now;
        }
      } else {
        ambientRms = ambientRms * 0.95 + rms * 0.05;

        if (now - lastSpikeTime > SPIKE_WINDOW_MS) {
          spikeHits = 0;
        }
      }

      if (
        spikeHits >= 2 &&
        now - lastTriggerTime > TRIGGER_COOLDOWN_MS
      ) {
        spikeHits = 0;
        lastTriggerTime = now;
        onDanger("hazard_sound");
      }

      soundLoop = requestAnimationFrame(checkAudio);
    }

    checkAudio();

    if (dom.soundText) {
      dom.soundText.textContent = "Hazard Watch: On";
    }
  } catch (err) {
    console.error("Hazard watch failed:", err);
    state.soundWatchActive = false;

    if (dom.soundText) {
      dom.soundText.textContent = "Hazard Watch: Unavailable";
    }
  }
}

export function stopSoundWatch(state, dom) {
  state.soundWatchActive = false;

  ambientRms = 10;
  lastSpikeTime = 0;
  spikeHits = 0;
  lastTriggerTime = 0;

  if (soundLoop) {
    cancelAnimationFrame(soundLoop);
    soundLoop = null;
  }

  if (microphone) {
    microphone.disconnect();
    microphone = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  analyser = null;

  if (dom.soundText) {
    dom.soundText.textContent = "Hazard Watch: Off";
  }
}
