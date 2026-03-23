import {
  IMPACT_LIMIT,
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
  shouldPauseInactivityForDriving,
  getContextInactivityLimit
} from "./context.js";
import { playAlarm, stopAlarm } from "./emergency.js";
import { startSoundWatch, stopSoundWatch } from "./soundwatch.js";

const NORMAL_WARNING_TIME = 15000;
const HIGH_RISK_WARNING_TIME = 8000;

const WARNING_CLEAR_DELAY = 3000;
const WARNING_CLEAR_THRESHOLD = 12;
const WARNING_CLEAR_HITS_REQUIRED = 3;

const MEANINGFUL_IMPACT_RESET = 8;
const MEANINGFUL_MOTION_RESET = 3.5;
const WARNING_RETRIGGER_COOLDOWN = 5000;

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

      startMotionMonitoring(state, dom, startEmergencyCountdown);

      startSoundWatch(state, dom, function (reason) {
        if (reason === "loud_sound") {
          startDriverWarning(state, dom, startEmergencyCountdown, "loud_sound");
        }
      });

      resetInactivityTimer(state, dom, startEmergencyCountdown);
    } else {
      dom.driverMinderBtn.innerText = "Driver Minder OFF";
      addStatus(dom.chatBox, "⚪ Driver Minder Disabled");

      clearTimeout(state.inactivityTimer);
      state.inactivityTimer = null;

      clearDriverWarning(state);
      stopSoundWatch(state, dom);
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

    const x = Math.abs(acc.x || 0);
    const y = Math.abs(acc.y || 0);
    const z = Math.abs(acc.z || 0);

    const impact = x + y + z;
    const motionLevel = (x * 0.35) + (y * 0.35) + (z * 0.2);

    updateMotionContext(state, motionLevel);

    if (impact > IMPACT_LIMIT) {
      const now = Date.now();

      if (now - (state.lastImpactTime || 0) > IMPACT_COOLDOWN) {
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

    const meaningfulMotion =
      impact > MEANINGFUL_IMPACT_RESET ||
      motionLevel > MEANINGFUL_MOTION_RESET ||
      state.contextMode === "driving" ||
      state.contextMode === "working" ||
      state.contextMode === "walking";

    if (meaningfulMotion) {
      resetInactivityTimer(state, dom, startEmergencyCountdown);
    }
  });
}

export function resetInactivityTimer(state, dom, startEmergencyCountdown) {
  clearTimeout(state.inactivityTimer);
  state.inactivityTimer = null;

  if (!state.driverMinderActive) return;

  if (shouldPauseInactivityForDriving(state)) {
    state.inactivityTimer = setTimeout(function () {
      if (!state.driverMinderActive) return;

      if (shouldPauseInactivityForDriving(state)) {
        resetInactivityTimer(state, dom, startEmergencyCountdown);
      }
    }, 30000);

    return;
  }

  const limit = getContextInactivityLimit(state);
  if (!limit) return;

  state.inactivityTimer = setTimeout(function () {
    if (!state.driverMinderActive) return;

    if (shouldPauseInactivityForDriving(state)) {
      resetInactivityTimer(state, dom, startEmergencyCountdown);
      return;
    }

    startDriverWarning(state, dom, startEmergencyCountdown, "inactivity");
  }, limit);
}

function getWarningTime(state) {
  return state.highRiskMode ? HIGH_RISK_WARNING_TIME : NORMAL_WARNING_TIME;
}

function startDriverWarning(state, dom, startEmergencyCountdown, reason) {
  if (state.warningRunning || state.emergencyRunning) return;

  if (Date.now() - (state.lastWarningClearedAt || 0) < WARNING_RETRIGGER_COOLDOWN) {
    return;
  }

  state.warningRunning = true;
  state.warningStartedAt = Date.now();
  state.warningClearHits = 0;

  addStatus(
    dom.chatBox,
    reason === "impact"
      ? "⚠️ Driver Minder warning: impact detected. Emergency check started."
      : reason === "loud_sound"
      ? "⚠️ Driver Minder warning: loud hazard detected nearby. Emergency check started."
      : "⚠️ Driver Minder warning: no movement detected. Emergency check started."
  );

  if (state.highRiskMode) {
    playAlarm(state);

    if (reason === "loud_sound") {
      forceSpeak("Danger nearby. Loud hazard detected. Respond now. Press I am safe or say I am safe.");
    } else if (reason === "impact") {
      forceSpeak("Impact detected. Respond now. Press I am safe or say I am safe.");
    } else {
      forceSpeak("Danger detected. Respond now. Press I am safe or say I am safe.");
    }
  } else {
    if (reason === "loud_sound") {
      forceSpeak("Loud hazard detected nearby. Press I am safe or say I am safe to cancel.");
    } else {
      forceSpeak("Driver check required. Press I am safe or say I am safe to cancel.");
    }
  }

  const warningBox = document.createElement("div");
  warningBox.id = "driverWarningBox";
  warningBox.style.position = "fixed";
  warningBox.style.top = "95px";
  warningBox.style.left = "50%";
  warningBox.style.transform = "translateX(-50%)";
  warningBox.style.zIndex = "9999";
  warningBox.style.background = state.highRiskMode
    ? "rgba(120,0,0,0.92)"
    : "rgba(0,0,0,0.88)";
  warningBox.style.color = "#ffffff";
  warningBox.style.padding = "18px 20px";
  warningBox.style.borderRadius = "16px";
  warningBox.style.fontSize = "20px";
  warningBox.style.fontWeight = "bold";
  warningBox.style.textAlign = "center";
  warningBox.style.minWidth = "280px";
  warningBox.style.maxWidth = "90vw";
  warningBox.style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)";
  warningBox.innerText = state.highRiskMode
    ? "🚧 HIGH-RISK DRIVER CHECK"
    : "⚠️ Driver Check Required";

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
      if (state.highRiskMode) {
        forceSpeak("High-risk danger continues. Respond now.");
      } else {
        forceSpeak("Respond now or emergency will start.");
      }
    }
  }, 4000);

  state.warningTimeout = setTimeout(function () {
    clearDriverWarning(state);
    startEmergencyCountdown();
  }, getWarningTime(state));
}

function clearDriverWarning(state) {
  state.warningRunning = false;
  state.warningStartedAt = 0;
  state.warningClearHits = 0;
  state.lastWarningClearedAt = Date.now();

  if (state.warningTimeout) {
    clearTimeout(state.warningTimeout);
    state.warningTimeout = null;
  }

  stopSpeaking();
  stopSafetyVoiceListener(state);

  if (!state.emergencyRunning) {
    stopAlarm(state);
  }

  const warningBox = document.getElementById("driverWarningBox");
  const safeBtn = document.getElementById("driverSafeBtn");

  if (warningBox) warningBox.remove();
  if (safeBtn) safeBtn.remove();
}
