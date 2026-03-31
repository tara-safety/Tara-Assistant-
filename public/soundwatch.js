let audioContext = null;
let analyser = null;
let microphone = null;
let soundLoop = null;
let mediaStream = null;

let ambientRms = 10;
let ambientPeak = 10;
let lastTriggerTime = 0;
let burstHits = 0;
let lastBurstTime = 0;
let sustainedFrames = 0;

const BURST_WINDOW_MS = 2200;
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
    analyser.smoothingTimeConstant = 0.12;

    microphone.connect(analyser);

    const timeData = new Uint8Array(analyser.fftSize);
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    function checkAudio() {
      if (!state.soundWatchActive || !analyser) return;

      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      let peakDeviation = 0;
      let squareSum = 0;

      for (let i = 0; i < timeData.length; i++) {
        const deviation = Math.abs(timeData[i] - 128);
        if (deviation > peakDeviation) peakDeviation = deviation;
        squareSum += deviation * deviation;
      }

      const rms = Math.sqrt(squareSum / timeData.length);
      const now = Date.now();

      // Broad band energy checks
      let lowBand = 0;
      let midBand = 0;
      let highBand = 0;

      for (let i = 4; i < 18; i++) lowBand += freqData[i];
      for (let i = 18; i < 70; i++) midBand += freqData[i];
      for (let i = 70; i < 140; i++) highBand += freqData[i];

      const totalBand = lowBand + midBand + highBand;

      // Adaptive ambient tracking
      ambientRms = ambientRms * 0.985 + rms * 0.015;
      ambientPeak = ambientPeak * 0.985 + peakDeviation * 0.015;

      // Strong nearby burst: horn tap, yell, bang, knock
      const sharpBurst =
        peakDeviation > Math.max(30, ambientPeak * 1.7) &&
        rms > Math.max(12, ambientRms * 1.45);

      // Very strong event: immediate trigger candidate
      const veryStrongBurst =
        peakDeviation > Math.max(42, ambientPeak * 2.1) &&
        rms > Math.max(18, ambientRms * 1.8);

      // Sustained loud event: long horn, alarm, repeated close noise
      const sustainedLoud =
        peakDeviation > Math.max(24, ambientPeak * 1.35) &&
        rms > Math.max(10, ambientRms * 1.28) &&
        totalBand > 900;

      // Optional tone-ish help, but not required
      const toneish =
        midBand > lowBand * 0.9 ||
        highBand > lowBand * 0.8;

      if (sustainedLoud && toneish) {
        sustainedFrames += 1;
      } else if (sustainedLoud) {
        sustainedFrames += 0.6;
      } else {
        sustainedFrames = Math.max(0, sustainedFrames - 1);
      }

      if (sharpBurst) {
        if (now - lastBurstTime > 220) {
          if (now - lastBurstTime > BURST_WINDOW_MS) {
            burstHits = 0;
          }
          burstHits += 1;
          lastBurstTime = now;
        }
      } else if (now - lastBurstTime > BURST_WINDOW_MS) {
        burstHits = 0;
      }

      const repeatedBurstDanger = burstHits >= 2;
      const sustainedDanger = sustainedFrames >= 8;
      const immediateDanger = veryStrongBurst;

      if (
        (immediateDanger || repeatedBurstDanger || sustainedDanger) &&
        now - lastTriggerTime > TRIGGER_COOLDOWN_MS
      ) {
        lastTriggerTime = now;
        burstHits = 0;
        sustainedFrames = 0;
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
  ambientPeak = 10;
  lastTriggerTime = 0;
  burstHits = 0;
  lastBurstTime = 0;
  sustainedFrames = 0;

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
