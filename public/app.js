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
import { startVoiceSystem, stopVoiceSystem } from "./voice.js";
import { openCamera } from "./camera.js";
import { setupDriverMinder } from "./motion.js";
import {
  setupEmergencyButton,
  startEmergencyCountdown
} from "./emergency.js";

document.addEventListener("DOMContentLoaded", function () {
  console.log("TARA System Booting");

  const dom = getDOM();

  setupMenu(dom.menuBtn, dom.menu);
  setupSystemUnlock(state);
  addFooter();

  if (dom.askBtn) {
    dom.askBtn.addEventListener("click", sendQuestion);
  }

  if (dom.towModeBtn) {
    dom.towModeBtn.addEventListener("click", function () {
      state.towModeActive = !state.towModeActive;

      if (state.towModeActive) {
        startVoiceSystem(state, dom, sendQuestion);
        addStatus(dom.chatBox, "🚚 Tow Mode Activated");
      } else {
        stopVoiceSystem(state, dom);
        addStatus(dom.chatBox, "🚚 Tow Mode Disabled");
      }
    });
  }

  if (dom.towCameraBtn) {
    dom.towCameraBtn.addEventListener("click", function () {
      openCamera(dom);
    });
  }

  setupDriverMinder(state, dom, () =>
    startEmergencyCountdown(state, dom)
  );

  setupEmergencyButton(state, dom, () =>
    startEmergencyCountdown(state, dom)
  );

  const emergencySection = document.querySelector(".emergencySection");
const emergencyMiniBtn = document.getElementById("emergencyMiniBtn");

function toggleMiniEmergency() {
  if (!emergencyMiniBtn) return;

  if (window.scrollY > 250) {
    emergencyMiniBtn.classList.add("show");
  } else {
    emergencyMiniBtn.classList.remove("show");
  }
}

window.addEventListener("scroll", toggleMiniEmergency);
window.addEventListener("resize", toggleMiniEmergency);
toggleMiniEmergency();
  
  async function sendQuestion() {
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
      addTaraMessage(dom.chatBox, data.answer);
    } catch (err) {
      console.error("Ask error:", err);
      thinking.remove();
      addStatus(dom.chatBox, `<span style="color:red;">TARA Error: ${err.message}</span>`);
    }
  }
});
