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

function isSafePhrase(text) {
  const value = text.toLowerCase().trim();

  return (
    value.includes("i'm safe") ||
    value.includes("im safe") ||
    value.includes("i am safe") ||
    value.includes("i'm okay") ||
    value.includes("im okay") ||
    value.includes("i am okay") ||
    value.includes("cancel emergency") ||
    value === "cancel"
  );
}

export function startSafetyVoiceListener(state, onSafeConfirm) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.log("Safety voice recognition is not supported on this device.");
    return;
  }

  stopSafetyVoiceListener(state);

  const recognition = new SpeechRecognition();
  state.safetyRecognition = recognition;
  state.safetyVoiceActive = true;

  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = function (e) {
    const text = e.results[e.results.length - 1][0].transcript.toLowerCase();
    console.log("Safety voice heard:", text);

    if (isSafePhrase(text)) {
      onSafeConfirm();
    }
  };

  recognition.onerror = function (err) {
    console.log("Safety voice error:", err);
  };

  recognition.onend = function () {
    if (state.safetyVoiceActive) {
      try {
        recognition.start();
      } catch (e) {}
    }
  };

  try {
    recognition.start();
    console.log("Safety voice listener started");
  } catch (err) {
    console.log("Safety voice listener start failed:", err);
  }
}

export function stopSafetyVoiceListener(state) {
  state.safetyVoiceActive = false;

  if (state.safetyRecognition) {
    try {
      state.safetyRecognition.stop();
    } catch (e) {}
  }

  state.safetyRecognition = null;
}
