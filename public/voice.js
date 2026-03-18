export function speak(text, state) {
  if (!text) return;
  if (state && state.voiceEnabled === false) return;

  try {
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    speechSynthesis.speak(utterance);
  } catch (err) {
    console.log("Speech output failed:", err);
  }
}

export function forceSpeak(text) {
  if (!text) return;

  try {
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    speechSynthesis.speak(utterance);
  } catch (err) {
    console.log("Forced speech output failed:", err);
  }
}

export function stopSpeaking() {
  try {
    speechSynthesis.cancel();
  } catch (err) {
    console.log("Stop speaking failed:", err);
  }
}

export function startVoiceSystem(state, dom, sendQuestion) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Voice recognition is not supported on this device.");
    return;
  }

  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (e) {}
  }

  const recognition = new SpeechRecognition();
  state.recognition = recognition;

  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = function (e) {
    const text = e.results[e.results.length - 1][0].transcript.toLowerCase();
    console.log("Heard:", text);

    if (!state.listeningForCommand) {
      if (text.includes("hey tara")) {
        state.listeningForCommand = true;
        speak("Yes driver", state);
      }
      return;
    }

    dom.questionInput.value = text;
    sendQuestion();
    state.listeningForCommand = false;
  };

  recognition.onerror = function (err) {
    console.log("Voice error:", err);
  };

  recognition.onend = function () {
    if (state.towModeActive) {
      try {
        recognition.start();
      } catch (e) {}
    }
  };

  try {
    recognition.start();
    console.log("Tow mode voice started");
  } catch (err) {
    console.log("Recognition start failed:", err);
  }
}

export function stopVoiceSystem(state) {
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (e) {}
  }

  state.listeningForCommand = false;
}

export function startSingleVoiceInput(dom, sendQuestion) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Voice recognition is not supported on this device.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = function (e) {
    const text = e.results[0][0].transcript;
    console.log("Single voice heard:", text);
    dom.questionInput.value = text;
    sendQuestion();
  };

  recognition.onerror = function (err) {
    console.log("Single voice error:", err);
  };

  try {
    recognition.start();
  } catch (err) {
    console.log("Single voice start failed:", err);
  }
}
