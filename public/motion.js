import {
  IMPACT_LIMIT,
  INACTIVITY_LIMIT,
  IMPACT_COOLDOWN
} from "./config.js";
import { addStatus } from "./ui.js";
import { requestMotionPermission } from "./permissions.js";
import {
  requestWakeLock,
  releaseWakeLock,
  restoreWakeLockIfNeeded
} from "./wakelock.js";
import {
  forceSpeak,
  stopSpeaking,
  startSafetyVoiceListener,
  stopSafetyVoiceListener
} from "./voice.js";
import {
  updateMotionContext,
  shouldPauseInactivityForDriving
} from "./context.js";

const WARNING_TIME = 15000;
const WARNING_CLEAR_DELAY = 3000;
const WARNING_CLEAR_THRESHOLD = 12;
const WARNING_CLEAR_HITS_REQUIRED = 3;

export function setupDriverMinder(state, dom, startEmergencyCountdown) {
  if (!dom.driverMinderBtn) return;

  dom.driverMinderBtn.addEventListener("click", async function () {
    state.driverMinderActive = !state.driverMinderActive;

    if (state.driverMinderActive) {
      dom.driverMinderBtn.innerText = "Driver Minder ON";
      addStatus(dom.chatBox, "🟢 Driver Minder Activated");

      await requestMotionPermission();

      const wakeLockOn = await requestWakeLock(state);
      if (wakeLockOn) {
        addStatus(dom.chatBox, "📱 Screen stay-awake enabled");
      } else {
        addStatus(dom.chatBox, "⚠️ Stay-awake not available on this device");
      }

      resetInactivityTimer(state, dom, startEmergencyCountdown);
      startMotionMonitoring(state, dom, startEmergencyCountdown);
    } else {
      dom.driverMinderBtn.innerText = "Driver Minder OFF";
      addStatus(dom.chatBox, "⚪ Driver Minder Disabled");

      clearTimeout(state.inactivityTimer);
      clearDriverWarning(state);
      releaseWakeLock(state);
    }
  });

  document.addEventListener("visibilitychange", function () {
    restoreWakeLockIfNeeded(state);
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

    updateMotionContext(state, impact);

    if (impact > IMPACT_LIMIT) {
      const now = Date.now();

      if (now - state.lastImpactTime > IMPACT_COOLDOWN) {
        state.lastImpactTime = now;
        startDriverWarning(state, dom, startEmergencyCountdown, "impact");
      }
    }

    if (state.warningRunning) {
      const now = Date.now();
      const enoughTimePassed =
        now - state.warningStartedAt > WARNING_CLEAR_DELAY;

      if (enoughTimePassed && impact > WARNING_CLEAR_THRESHOLD) {
        state.warningClearHits += 1;
      }

      if (state.warningClearHits >= WARNING_CLEAR_HITS_REQUIRED) {
        clearDriverWarning(state);
        resetInactivityTimer(state, dom, startEmergencyCountdown);
        addStatus(dom.chatBox, "✅ Driver activity confirmed. Warning cleared.");
      }
    }

    resetInactivityTimer(state, dom, startEmergencyCountdown);
  });
}

export function resetInactivityTimer(state, dom, startEmergencyCountdown) {
  clearTimeout(state.inactivityTimer);

  state.inactivityTimer = setTimeout(function () {
    if (!state.driverMinderActive) return;

    // Stage 5: pause inactivity escalation while driving
    if (shouldPauseInactivityForDriving(state)) {
      addStatus(dom.chatBox, "🟢 Driving detected. Inactivity check paused.");
      resetInactivityTimer(state, dom, startEmergencyCountdown);
      return;
    }

    startDriverWarning(state, dom, startEmergencyCountdown, "inactivity");
  }, INACTIVITY_LIMIT);
}

function startDriverWarning(state, dom, startEmergencyCountdown, reason) {
  if (state.warningRunning || state.emergencyRunning) return;

  state.warningRunning = true;
  state.warningStartedAt = Date.now();
  state.warningClearHits = 0;

  addStatus(
    dom.chatBox,
    reason === "impact"
      ? "⚠️ Driver Minder warning: impact detected. Emergency check started."
      : "⚠️ Driver Minder warning: no movement detected. Emergency check started."
  );

  forceSpeak("Driver check required. Press I am safe or say I am safe to cancel.");

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

  function confirmSafe() {
    clearDriverWarning(state);
    resetInactivityTimer(state, dom, startEmergencyCountdown);
    addStatus(dom.chatBox, "✅ Driver confirmed safe.");
  }

  safeBtn.onclick = function () {
    confirmSafe();
  };

  startSafetyVoiceListener(state, function () {
    confirmSafe();
  });

  setTimeout(function () {
    if (state.warningRunning) {
      forceSpeak("Respond now or emergency will start.");
    }
  }, 5000);

  setTimeout(function () {
    if (state.warningRunning) {
      forceSpeak("Final warning. Say I am safe to cancel.");
    }
  }, 10000);

  state.warningTimeout = setTimeout(function () {
    clearDriverWarning(state);
    startEmergencyCountdown();
  }, WARNING_TIME);
}

function clearDriverWarning(state) {
  state.warningRunning = false;
  state.warningStartedAt = 0;
  state.warningClearHits = 0;

  if (state.warningTimeout) {
    clearTimeout(state.warningTimeout);
    state.warningTimeout = null;
  }

  stopSpeaking();
  stopSafetyVoiceListener(state);

  const warningBox = document.getElementById("driverWarningBox");
  const safeBtn = document.getElementById("driverSafeBtn");

  if (warningBox) warningBox.remove();
  if (safeBtn) safeBtn.remove();
}
