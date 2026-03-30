let audioContext = null;
let analyser = null;
let microphone = null;
let soundLoop = null;
let mediaStream = null;

let ambientRms = 10;
let ambientPeak = 12;

let lastTriggerTime = 0;
let sustainedLoudFrames = 0;
let burstHits = 0;
let lastBurstTime = 0;

const TRIGGER_COOLDOWN_MS = 9000;
const BURST_WINDOW_MS = 2200;

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
    analyser.smoothingTimeConstant = 0.1;

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

      // Adaptive ambient tracking
      ambientRms = ambientRms * 0.985 + rms * 0.015;
      ambientPeak = ambientPeak * 0.985 + peakDeviation * 0.015;

      // 1) Short sharp loud burst (horn tap, bang, close shout)
      const sharpBurst =
        peakDeviation > Math.max(42, ambientPeak * 2.0) &&
        rms > Math.max(18, ambientRms * 1.8);

      // 2) Sustained loud event (long horn, alarm, prolonged hazard sound)
      const sustainedLoud =
        peakDeviation > Math.max(34, ambientPeak * 1.55) &&
        rms > Math.max(16, ambientRms * 1.5);

      // Count sustained frames
      if (sustainedLoud) {
        sustainedLoudFrames += 1;
      } else {
        sustainedLoudFrames = Math.max(0, sustainedLoudFrames - 1);
      }

      // Count burst hits
      if (sharpBurst) {
        if (now - lastBurstTime > 250) {
          if (now - lastBurstTime > BURST_WINDOW_MS) {
            burstHits = 0;
          }
          burstHits += 1;
          lastBurstTime = now;
        }
      } else if (now - lastBurstTime > BURST_WINDOW_MS) {
        burstHits = 0;
      }

      // Trigger conditions:
      // A) one very strong burst
      const immediateDanger =
        peakDeviation > Math.max(52, ambientPeak * 2.4) &&
        rms > Math.max(22, ambientRms * 2.0);

      // B) repeated bursts within short window
      const repeatedBurstDanger = burstHits >= 2;

      // C) sustained loud tone over several frames
      const sustainedDanger = sustainedLoudFrames >= 10;

      if (
        (immediateDanger || repeatedBurstDanger || sustainedDanger) &&
        now - lastTriggerTime > TRIGGER_COOLDOWN_MS
      ) {
        lastTriggerTime = now;
        burstHits = 0;
        sustainedLoudFrames = 0;
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
  ambientPeak = 12;
  lastTriggerTime = 0;
  sustainedLoudFrames = 0;
  burstHits = 0;
  lastBurstTime = 0;

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
