let audioContext = null;
let analyser = null;
let microphone = null;
let soundLoop = null;
let mediaStream = null;
let loudHits = 0;
let lastPeakTime = 0;

export async function startSoundWatch(state, dom, onDanger) {
  if (state.soundWatchActive) return;
  state.soundWatchActive = true;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    microphone = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;

    microphone.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    function checkAudio() {
      if (!state.soundWatchActive || !analyser) return;

      analyser.getByteFrequencyData(data);

      let sum = 0;
      let peak = 0;

      for (let i = 0; i < data.length; i++) {
        sum += data[i];
        if (data[i] > peak) peak = data[i];
      }

      const avg = sum / data.length;
      const now = Date.now();

      const roadsideArmed =
        state.highRiskMode ||
        state.contextMode === "working" ||
        state.contextMode === "walking";

      if (roadsideArmed) {
        if (peak > 210 || avg > 90) {
          if (now - lastPeakTime > 1200) {
            loudHits += 1;
            lastPeakTime = now;
          }
        }

        if (loudHits >= 2) {
          loudHits = 0;
          onDanger("loud_sound");
        }
      } else {
        loudHits = 0;
      }

      soundLoop = requestAnimationFrame(checkAudio);
    }

    checkAudio();

    if (dom.soundText) {
      dom.soundText.textContent = "Sound Watch: On";
    }
  } catch (err) {
    console.error("Sound watch failed:", err);
    state.soundWatchActive = false;

    if (dom.soundText) {
      dom.soundText.textContent = "Sound Watch: Unavailable";
    }
  }
}

export function stopSoundWatch(state, dom) {
  state.soundWatchActive = false;
  loudHits = 0;
  lastPeakTime = 0;

  if (soundLoop) {
    cancelAnimationFrame(soundLoop);
    soundLoop = null;
  }

  if (microphone) {
    microphone.disconnect();
    microphone = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  analyser = null;

  if (dom.soundText) {
    dom.soundText.textContent = "Sound Watch: Off";
  }
}
