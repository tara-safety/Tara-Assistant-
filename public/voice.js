import { addStatus } from "./ui.js";

export function speak(text) {
  if (!text) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  speechSynthesis.speak(utterance);
}

export function startVoiceSystem(state, dom, sendQuestion) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Voice not supported");
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
        speak("Yes driver");
      }
      return;
    }

    dom.questionInput.value = text;
    sendQuestion();
    state.listeningForCommand = false;
  };

  recognition.onerror = function (err) {
    console.log("Voice error:", err);
    try {
      recognition.start();
    } catch (e) {}
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
    addStatus(dom.chatBox, "🎤 Voice system started");
  } catch (e) {
    console.log("Recognition start failed", e);
  }
}

export function stopVoiceSystem(state, dom) {
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (e) {}
  }
  addStatus(dom.chatBox, "🎤 Voice system stopped");
}
