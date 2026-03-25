import { state } from "./state.js";
import { getDOM } from "./dom.js";
import {
  addUserMessage,
  addTaraMessage,
  addStatus,
  createThinking,
  addFooter,
  setupMenu
} from "./ui.js";
import { setupSystemUnlock } from "./permissions.js";
import {
  initVoices,
  speak,
  stopSpeaking,
  startVoiceSystem,
  stopVoiceSystem,
  startSingleVoiceInput
} from "./voice.js";
import { openCamera } from "./camera.js";
import { setupDriverMinder } from "./motion.js";
import { setupContextAwareness } from "./context.js";
import {
  setupEmergencyButton,
  startEmergencyCountdown,
  setupEmergencyFailSafe
} from "./emergency.js";

/* =========================================================
   SESSION HELPERS
========================================================= */

function getOrCreateSessionId() {
  const key = "tara_session_id";
  let id = localStorage.getItem(key);

  if (!id) {
    id = `tara-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }

  return id;
}

document.addEventListener("DOMContentLoaded", function () {
  console.log("TARA System Booting");

  let dom;
  const sessionId = getOrCreateSessionId();

  try {
    dom = getDOM();
    console.log("DOM loaded:", dom);
    console.log("TARA session:", sessionId);
  } catch (err) {
    console.error("DOM setup failed:", err);
    return;
  }

  try {
    initVoices();
  } catch (err) {
    console.error("initVoices failed:", err);
  }

  try {
    setupMenu(dom.menuBtn, dom.menu);
    console.log("Menu setup complete");
  } catch (err) {
    console.error("setupMenu failed:", err);
  }

  try {
    setupSystemUnlock(state);
  } catch (err) {
    console.error("setupSystemUnlock failed:", err);
  }

  try {
    addFooter();
  } catch (err) {
    console.error("addFooter failed:", err);
  }

  try {
    setupEmergencyFailSafe(dom);
  } catch (err) {
    console.error("setupEmergencyFailSafe failed:", err);
  }

  try {
    setupContextAwareness(state, dom);
  } catch (err) {
    console.error("setupContextAwareness failed:", err);
  }

  const voiceToggle = dom.voiceToggle;
  const emergencyMiniBtn = dom.emergencyMiniBtn;

  if (voiceToggle) {
    state.voiceEnabled = voiceToggle.checked;

    voiceToggle.addEventListener("change", function () {
      state.voiceEnabled = voiceToggle.checked;

      if (!state.voiceEnabled) {
        try {
          stopSpeaking();
        } catch (err) {
          console.error("stopSpeaking failed:", err);
        }

        addStatus(dom.chatBox, "🔇 Voice Response Off");
      } else {
        addStatus(dom.chatBox, "🔊 Voice Response On");
      }
    });
  }

  if (dom.askBtn) {
    dom.askBtn.addEventListener("click", function () {
      console.log("Ask button clicked");
      sendQuestion();
    });
  } else {
    console.warn("askBtn not found");
  }

  if (dom.questionInput) {
    dom.questionInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        sendQuestion();
      }
    });
  } else {
    console.warn("questionInput not found");
  }

  if (dom.voiceBtn) {
    dom.voiceBtn.addEventListener("click", function () {
      console.log("Voice button clicked");

      try {
        startSingleVoiceInput(dom, sendQuestion);
      } catch (err) {
        console.error("startSingleVoiceInput failed:", err);
        addStatus(
          dom.chatBox,
          `<span style="color:red;">Voice input failed: ${err.message}</span>`
        );
      }
    });
  } else {
    console.warn("voiceBtn not found");
  }

  if (dom.towModeBtn) {
    dom.towModeBtn.addEventListener("click", function () {
      console.log("Tow mode button clicked");

      try {
        state.towModeActive = !state.towModeActive;

        if (state.towModeActive) {
          startVoiceSystem(state, dom, sendQuestion);
          dom.towModeBtn.textContent = "Tow Mode ON";
          addStatus(dom.chatBox, "🚚 Tow Mode Activated");
        } else {
          stopVoiceSystem(state);
          dom.towModeBtn.textContent = "Tow Mode OFF";
          addStatus(dom.chatBox, "🚚 Tow Mode Disabled");
        }
      } catch (err) {
        console.error("Tow mode failed:", err);
        addStatus(
          dom.chatBox,
          `<span style="color:red;">Tow Mode failed: ${err.message}</span>`
        );
      }
    });
  } else {
    console.warn("towModeBtn not found");
  }

  if (dom.towCameraBtn) {
    dom.towCameraBtn.addEventListener("click", function () {
      console.log("Camera button clicked");

      try {
        openCamera(dom);
      } catch (err) {
        console.error("openCamera failed:", err);
        addStatus(
          dom.chatBox,
          `<span style="color:red;">Camera failed: ${err.message}</span>`
        );
      }
    });
  } else {
    console.warn("towCameraBtn not found");
  }

  if (dom.proModeBtn) {
    dom.proModeBtn.addEventListener("click", function () {
      console.log("Pro mode button clicked");

      state.proMode = !state.proMode;

      if (state.proMode) {
        dom.proModeBtn.textContent = "PRO MODE ON";
        addStatus(dom.chatBox, "🧠 Pro Mode Activated");
      } else {
        dom.proModeBtn.textContent = "PRO MODE OFF";
        addStatus(dom.chatBox, "🧠 Pro Mode Disabled");
      }
    });
  } else {
    console.warn("proModeBtn not found");
  }

  try {
    setupDriverMinder(state, dom, function () {
      startEmergencyCountdown(state, dom);
    });
  } catch (err) {
    console.error("setupDriverMinder failed:", err);
  }

  try {
    setupEmergencyButton(state, dom, function () {
      startEmergencyCountdown(state, dom);
    });
  } catch (err) {
    console.error("setupEmergencyButton failed:", err);
  }

  function toggleMiniSOS() {
    if (!emergencyMiniBtn) return;

    if (window.scrollY > 60) {
      emergencyMiniBtn.classList.add("show");
    } else {
      emergencyMiniBtn.classList.remove("show");
    }
  }

  window.addEventListener("scroll", toggleMiniSOS);
  window.addEventListener("resize", toggleMiniSOS);
  toggleMiniSOS();

  async function sendQuestion() {
    if (!dom.questionInput || !dom.chatBox) return;

    const text = dom.questionInput.value.trim();
    if (!text) return;

    addUserMessage(dom.chatBox, text);
    dom.questionInput.value = "";

    const thinking = createThinking(dom.chatBox);

    try {
      const res = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          mode: "chat",
          sessionId,
          proMode: state.proMode
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();

      if (thinking && typeof thinking.remove === "function") {
        thinking.remove();
      }

      const answer = data.answer || "No response returned.";
      addTaraMessage(dom.chatBox, answer);

      if (data.brain) {
        const memoryOn = data.brain.chatMemory === true;
        const storedKnowledgeOn = data.brain.storedKnowledge === true;

        if (memoryOn && !storedKnowledgeOn) {
          addStatus(dom.chatBox, "🧠 Memory On | Stored Knowledge Off");
        }
      }

      if (state.voiceEnabled) {
        try {
          speak(answer, state);
        } catch (err) {
          console.error("speak failed:", err);
        }
      }
    } catch (err) {
      console.error("Ask error:", err);

      if (thinking && typeof thinking.remove === "function") {
        thinking.remove();
      }

      addStatus(
        dom.chatBox,
        `<span style="color:red;">TARA Error: ${err.message}</span>`
      );
    }
  }
});
