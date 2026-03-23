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

document.addEventListener("DOMContentLoaded", function () {
  console.log("TARA System Booting");

  const dom = getDOM();
  initVoices();

  setupMenu(dom.menuBtn, dom.menu);
  setupSystemUnlock(state);
  addFooter();

  setupEmergencyFailSafe(dom);
  setupContextAwareness(state, dom);

  if (dom.highRiskBtn) {
    dom.highRiskBtn.addEventListener("click", function () {
      state.highRiskMode = !state.highRiskMode;

      if (dom.riskText) {
        dom.riskText.textContent = state.highRiskMode
          ? "Risk: High"
          : "Risk: Normal";
      }

      if (state.highRiskMode) {
        dom.highRiskBtn.innerText = "HIGH-RISK MODE ON";
        dom.highRiskBtn.classList.add("active");
        addStatus(dom.chatBox, "🚧 High-Risk Mode Activated");
      } else {
        dom.highRiskBtn.innerText = "HIGH-RISK MODE OFF";
        dom.highRiskBtn.classList.remove("active");
        addStatus(dom.chatBox, "✅ High-Risk Mode Disabled");
      }
    });
  }

  const voiceToggle = dom.voiceToggle;
  const emergencyMiniBtn = dom.emergencyMiniBtn;

  if (voiceToggle) {
    state.voiceEnabled = voiceToggle.checked;

    voiceToggle.addEventListener("change", function () {
      state.voiceEnabled = voiceToggle.checked;

      if (!state.voiceEnabled) {
        stopSpeaking();
        addStatus(dom.chatBox, "🔇 Voice Response Off");
      } else {
        addStatus(dom.chatBox, "🔊 Voice Response On");
      }
    });
  }

  if (dom.askBtn) {
    dom.askBtn.addEventListener("click", sendQuestion);
  }

  if (dom.questionInput) {
    dom.questionInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        sendQuestion();
      }
    });
  }

  if (dom.voiceBtn) {
    dom.voiceBtn.addEventListener("click", function () {
      startSingleVoiceInput(dom, sendQuestion);
    });
  }

  if (dom.towModeBtn) {
    dom.towModeBtn.addEventListener("click", function () {
      state.towModeActive = !state.towModeActive;

      if (state.towModeActive) {
        startVoiceSystem(state, dom, sendQuestion);
        addStatus(dom.chatBox, "🚚 Tow Mode Activated");
      } else {
        stopVoiceSystem(state);
        addStatus(dom.chatBox, "🚚 Tow Mode Disabled");
      }
    });
  }

  if (dom.towCameraBtn) {
    dom.towCameraBtn.addEventListener("click", function () {
      openCamera(dom);
    });
  }

  setupDriverMinder(state, dom, function () {
    startEmergencyCountdown(state, dom);
  });

  setupEmergencyButton(state, dom, function () {
    startEmergencyCountdown(state, dom);
  });

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
        body: JSON.stringify({ question: text })
      });

      if (!res.ok) {
        throw new Error("Server returned error");
      }

      const data = await res.json();
      thinking.remove();
      addTaraMessage(dom.chatBox, data.answer || "No response returned.");
      speak(data.answer || "No response returned.", state);
    } catch (err) {
      console.error("Ask error:", err);
      thinking.remove();
      addStatus(
        dom.chatBox,
        `<span style="color:red;">TARA Error: ${err.message}</span>`
      );
    }
  }
});
