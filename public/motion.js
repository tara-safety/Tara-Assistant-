import {
  IMPACT_LIMIT,
  INACTIVITY_LIMIT,
  IMPACT_COOLDOWN
} from "./config.js";
import { addStatus } from "./ui.js";
import { requestMotionPermission } from "./permissions.js";

const WARNING_TIME = 15000; // 15 seconds

export function setupDriverMinder(state, dom, startEmergencyCountdown) {
  if (!dom.driverMinderBtn) return;

  dom.driverMinderBtn.addEventListener("click", async function () {
    state.driverMinderActive = !state.driverMinderActive;

    if (state.driverMinderActive) {
      dom.driverMinderBtn.innerText = "Driver Minder ON";
      addStatus(dom.chatBox, "🟢 Driver Minder Activated");

      await requestMotionPermission();
      resetInactivityTimer(state, dom, startEmergencyCountdown);
      startMotionMonitoring(state, dom, startEmergencyCountdown);
    } else {
      dom.driverMinderBtn.innerText = "Driver Minder OFF";
      addStatus(dom.chatBox, "⚪ Driver Minder Disabled");

      clearTimeout(state.inactivityTimer);
      clearDriverWarning(state);
    }
  });
}

export function startMotionMonitoring(state, dom, startEmergencyCountdown) {
  if (state.motionStarted) return;
  state.motionStarted = true;

  window.addEventListener("devicemotion", function (e) {
    if (!state.driverMinderActive) return;

    const acc = e.accelerationIncludingGravity;
    if (!acc) return;

    const impact =
      Math.abs(acc.x || 0) +
      Math.abs(acc.y || 0) +
      Math.abs(acc.z || 0);

    if (impact > IMPACT_LIMIT) {
      const now = Date.now();

      if (now - state.lastImpactTime > IMPACT_COOLDOWN) {
        state.lastImpactTime = now;
        startDriverWarning(state, dom, startEmergencyCountdown, "impact");
      }
    }

    // if driver moves again during warning, cancel it
    if (state.warningRunning && impact > 3) {
      clearDriverWarning(state);
      addStatus(dom.chatBox, "✅ Driver activity detected. Warning cleared.");
    }

    resetInactivityTimer(state, dom, startEmergencyCountdown);
  });
}

export function resetInactivityTimer(state, dom, startEmergencyCountdown) {
  clearTimeout(state.inactivityTimer);

  state.inactivityTimer = setTimeout(function () {
    if (state.driverMinderActive) {
      startDriverWarning(state, dom, startEmergencyCountdown, "inactivity");
    }
  }, INACTIVITY_LIMIT);
}

function startDriverWarning(state, dom, startEmergencyCountdown, reason) {
  if (state.warningRunning || state.emergencyRunning) return;

  state.warningRunning = true;

  addStatus(
    dom.chatBox,
    reason === "impact"
      ? "⚠️ Driver Minder warning: impact detected. Emergency check started."
      : "⚠️ Driver Minder warning: no movement detected. Emergency check started."
  );

  const warningBox = document.createElement("div");
  warningBox.id = "driverWarningBox";
  warningBox.style.position = "fixed";
  warningBox.style.top = "95px";
  warningBox.style.left = "50%";
  warningBox.style.transform = "translateX(-50%)";
  warningBox.style.zIndex = "9999";
  warningBox.style.background = "rgba(0,0,0,0.88)";
  warningBox.style.color = "#ffffff";
  warningBox.style.padding = "18px 20px";
  warningBox.style.borderRadius = "16px";
  warningBox.style.fontSize = "20px";
  warningBox.style.fontWeight = "bold";
  warningBox.style.textAlign = "center";
  warningBox.style.minWidth = "280px";
  warningBox.style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)";
  warningBox.innerText = "⚠️ Driver Check Required";

  const safeBtn = document.createElement("button");
  safeBtn.id = "driverSafeBtn";
  safeBtn.innerText = "I AM SAFE";
  safeBtn.style.position = "fixed";
  safeBtn.style.bottom = "120px";
  safeBtn.style.left = "50%";
  safeBtn.style.transform = "translateX(-50%)";
  safeBtn.style.zIndex = "9999";
  safeBtn.style.background = "#1e9f4f";
  safeBtn.style.color = "#ffffff";
  safeBtn.style.border = "3px solid #ffffff";
  safeBtn.style.borderRadius = "16px";
  safeBtn.style.padding = "20px 30px";
  safeBtn.style.fontSize = "22px";
  safeBtn.style.fontWeight = "bold";
  safeBtn.style.minWidth = "260px";
  safeBtn.style.minHeight = "78px";
  safeBtn.style.boxShadow = "0 8px 22px rgba(0,0,0,0.4)";

  document.body.appendChild(warningBox);
  document.body.appendChild(safeBtn);

  safeBtn.onclick = function () {
    clearDriverWarning(state);
    resetInactivityTimer(state, dom, startEmergencyCountdown);
    addStatus(dom.chatBox, "✅ Driver confirmed safe.");
  };

  state.warningTimeout = setTimeout(function () {
    clearDriverWarning(state);
    startEmergencyCountdown();
  }, WARNING_TIME);
}

function clearDriverWarning(state) {
  state.warningRunning = false;

  if (state.warningTimeout) {
    clearTimeout(state.warningTimeout);
    state.warningTimeout = null;
  }

  const warningBox = document.getElementById("driverWarningBox");
  const safeBtn = document.getElementById("driverSafeBtn");

  if (warningBox) warningBox.remove();
  if (safeBtn) safeBtn.remove();
}
