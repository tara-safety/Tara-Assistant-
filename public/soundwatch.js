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
    analyser.smoothingTimeConstant = 0.25;

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

      // 🔊 Frequency bands
      let lowMid = 0;
      let mid = 0;
      let high = 0;

      for (let i = 5; i < 20; i++) lowMid += freqData[i];
      for (let i = 20; i < 60; i++) mid += freqData[i];
      for (let i = 60; i < 120; i++) high += freqData[i];

      // 🔥 More forgiving detection
      const loudEvent = rms > ambientRms * 1.8 + 6;
      const sharpPeak = peakDeviation > 55;

      // Horn OR sudden loud spike
      const hornLike =
        (mid > lowMid * 1.1) && (mid > high * 0.8);

      const danger =
        (loudEvent && sharpPeak) ||
        (hornLike && rms > ambientRms * 1.5 + 5);

      if (danger) {
        if (now - lastSpikeTime > 400) {
          if (now - lastSpikeTime > SPIKE_WINDOW_MS) {
            spikeHits = 0;
          }

          spikeHits += 1;
          lastSpikeTime = now;
        }
      } else {
        ambientRms = ambientRms * 0.96 + rms * 0.04;

        if (now - lastSpikeTime > SPIKE_WINDOW_MS) {
          spikeHits = 0;
        }
      }

      // 🔥 Trigger faster (less strict)
      if (
        spikeHits >= 1 &&
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
