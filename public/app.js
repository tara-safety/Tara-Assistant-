// ================================
// TARA CORE APP CONTROLLER (UPGRADED SAFE)
// ================================

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

  // ================================
  // 🔐 USER AGREEMENT (NEW)
  // ================================
  if (localStorage.getItem("tara_agreed") !== "true") {
    window.location.href = "/agreement.html";
    return;
  }

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
      sendQuestion();
    });
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
      try {
        startSingleVoiceInput(dom, sendQuestion);
      } catch (err) {
        addStatus(
          dom.chatBox,
          `<span style="color:red;">Voice input failed: ${err.message}</span>`
        );
      }
    });
  }

  if (dom.towCameraBtn) {
    dom.towCameraBtn.addEventListener("click", function () {
      try {
        openCamera(dom);
      } catch (err) {
        addStatus(
          dom.chatBox,
          `<span style="color:red;">Camera failed: ${err.message}</span>`
        );
      }
    });
  }

  if (dom.proModeBtn) {
    dom.proModeBtn.addEventListener("click", function () {
      state.proMode = !state.proMode;

      if (state.proMode) {
        dom.proModeBtn.textContent = "PRO MODE ON";
        addStatus(dom.chatBox, "🧠 Pro Mode Activated");
      } else {
        dom.proModeBtn.textContent = "PRO MODE OFF";
        addStatus(dom.chatBox, "🧠 Pro Mode Disabled");
      }
    });
  }

  try {
    setupDriverMinder(state, dom, function () {
      startEmergencyCountdown(state, dom);
    });
  } catch (err) {}

  try {
    setupEmergencyButton(state, dom, function () {
      startEmergencyCountdown(state, dom);
    });
  } catch (err) {}

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

  // ================================
  // 💬 CHAT SYSTEM
  // ================================
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

      const data = await res.json();

      thinking?.remove();

      const answer = data.answer || "No response returned.";
      addTaraMessage(dom.chatBox, answer);

      if (state.voiceEnabled) {
        speak(answer, state);
      }

    } catch (err) {
      thinking?.remove();

      addStatus(
        dom.chatBox,
        `<span style="color:red;">TARA Error: ${err.message}</span>`
      );
    }
  }

  // ================================
  // 📊 NEAR MISS SYSTEM (NEW)
  // ================================
  const reportForm = document.getElementById("reportForm");

  if (reportForm) {
    reportForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const report = {
        name: document.getElementById("name")?.value || "",
        company: document.getElementById("company")?.value || "",
        location: document.getElementById("location")?.value || "",
        details: document.getElementById("details")?.value || "",
        date: new Date().toISOString()
      };

      let reports = JSON.parse(localStorage.getItem("tara_reports") || "[]");
      reports.push(report);
      localStorage.setItem("tara_reports", JSON.stringify(reports));

      alert("Near miss report submitted");

      reportForm.reset();
    });
  }

  console.log("TARA READY");

});
