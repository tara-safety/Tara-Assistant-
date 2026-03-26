import {
  IMPACT_LIMIT,
  IMPACT_COOLDOWN,
  INACTIVITY_LIMIT
} from "./config.js";
import { addStatus } from "./ui.js";
import { requestMotionPermission } from "./permissions.js";
import {
  requestWakeLock,
  releaseWakeLock,
  restoreWakeLockIfNeeded
} from "./wakelock.js";
import {
  emergencySpeak,
  stopSpeaking,
  startSafetyVoiceListener,
  stopSafetyVoiceListener
} from "./voice.js";
import { playAlarm, stopAlarm } from "./emergency.js";
import { startSoundWatch, stopSoundWatch } from "./soundwatch.js";

const ROADSIDE_WARNING_TIME = 12000;
const WARNING_CLEAR_DELAY = 3000;
const WARNING_CLEAR_THRESHOLD = 14;
const WARNING_CLEAR_HITS_REQUIRED = 4;
const MEANINGFUL_IMPACT_RESET = 10;
const MEANINGFUL_MOTION_RESET = 4.8;
const WARNING_RETRIGGER_COOLDOWN = 5000;

const REMINDER_MS = 30 * 60 * 1000;
const HAZARD_WARNING_COOLDOWN = 9000;
const HAZARD_BANNER_TIME = 6000;
const HAZARD_ALARM_MS = 1500;

export function setupDriverMinder(state, dom, startEmergencyCountdown) {
  if (dom.driverMinderBtn && !dom.driverMinderBtn.dataset.bound) {
    dom.driverMinderBtn.dataset.bound = "true";

    dom.driverMinderBtn.addEventListener("click", async function () {
      state.driverMinderActive = !state.driverMinderActive;

      if (state.driverMinderActive) {
        dom.driverMinderBtn.innerText = "ROADSIDE PROTECTION ON";
        dom.driverMinderBtn.classList.add("active");

        if (dom.driverMinderText) {
          dom.driverMinderText.textContent = "Roadside Protection: On";
        }

        if (dom.riskText) {
          dom.riskText.textContent = "Risk: Protected";
        }

        addStatus(dom.chatBox, "🟢 Roadside Protection Activated");
        addStatus(dom.chatBox, "📡 Impact and worker safety monitoring active");

        await requestMotionPermission();

        const wakeLockOn = await requestWakeLock(state);
        if (wakeLockOn) {
          addStatus(dom.chatBox, "📱 Screen stay-awake enabled");
        } else {
          addStatus(dom.chatBox, "⚠️ Stay-awake not available on this device");
        }

        startMotionMonitoring(state, dom, startEmergencyCountdown);
        resetInactivityTimer(state, dom, startEmergencyCountdown);
        startRoadsideReminder(state, dom);
      } else {
        dom.driverMinderBtn.innerText = "ROADSIDE PROTECTION OFF";
        dom.driverMinderBtn.classList.remove("active");

        if (dom.driverMinderText) {
          dom.driverMinderText.textContent = "Roadside Protection: Off";
        }

        if (dom.riskText) {
          dom.riskText.textContent = "Risk: Normal";
        }

        addStatus(dom.chatBox, "⚪ Roadside Protection Disabled");

        clearTimeout(state.inactivityTimer);
        state.inactivityTimer = null;

        clearRoadsideReminder(state);
        clearDriverWarning(state);
        releaseWakeLock(state);
      }
    });
  }

  if (dom.towModeBtn && !dom.towModeBtn.dataset.bound) {
    dom.towModeBtn.dataset.bound = "true";
    dom.towModeBtn.innerText = "HAZARD WATCH OFF";

    dom.towModeBtn.addEventListener("click", async function () {
      state.hazardWatchActive = !state.hazardWatchActive;

      if (state.hazardWatchActive) {
        dom.towModeBtn.innerText = "HAZARD WATCH ON";
        dom.towModeBtn.classList.add("active");

        addStatus(dom.chatBox, "🟠 Hazard Watch Activated");
        addStatus(dom.chatBox, "👂 Listening for abnormal nearby danger");

        if (!state.driverMinderActive) {
          showHazardRecommendation(dom);
          addStatus(
            dom.chatBox,
            "ℹ️ Hazard Watch works best with Roadside Protection turned on"
          );
        }

        startHazardReminder(state, dom);

        await startSoundWatch(state, dom, function (reason) {
          if (reason === "hazard_sound") {
            startHazardWarning(state, dom);
          }
        });
      } else {
        dom.towModeBtn.innerText = "HAZARD WATCH OFF";
        dom.towModeBtn.classList.remove("active");

        addStatus(dom.chatBox, "⚪ Hazard Watch Disabled");

        clearHazardReminder(state);
        clearHazardBanner();
        stopSoundWatch(state, dom);
      }
    });
  }

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

    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const impact = Math.abs(magnitude - (state.lastMagnitude || magnitude));
    state.lastMagnitude = magnitude;
    const motionLevel = x * 0.35 + y * 0.35 + z * 0.2;

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

      if (
        enoughTimePassed &&
        (impact > WARNING_CLEAR_THRESHOLD ||
          motionLevel > MEANINGFUL_MOTION_RESET)
      ) {
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
      motionLevel > MEANINGFUL_MOTION_RESET;

    if (meaningfulMotion) {
      resetInactivityTimer(state, dom, startEmergencyCountdown);
    }
  });
}

export function resetInactivityTimer(state, dom, startEmergencyCountdown) {
  clearTimeout(state.inactivityTimer);
  state.inactivityTimer = null;

  if (!state.driverMinderActive) return;

  state.inactivityTimer = setTimeout(function () {
    if (!state.driverMinderActive) return;
    startDriverWarning(state, dom, startEmergencyCountdown, "inactivity");
  }, INACTIVITY_LIMIT);
}

function startDriverWarning(state, dom, startEmergencyCountdown, reason) {
  if (state.warningRunning || state.emergencyRunning) return;

  if (
    Date.now() - (state.lastWarningClearedAt || 0) <
    WARNING_RETRIGGER_COOLDOWN
  ) {
    return;
  }

  state.warningRunning = true;
  state.warningStartedAt = Date.now();
  state.warningClearHits = 0;

  addStatus(
    dom.chatBox,
    reason === "impact"
      ? "⚠️ Roadside Protection warning: impact detected. Driver check started."
      : "⚠️ Roadside Protection warning: no movement detected. Driver check started."
  );

  playAlarm(state);

  if (reason === "impact") {
    emergencySpeak(
      "Impact detected. Respond now. Press I am safe or say I am safe."
    );
  } else {
    emergencySpeak(
      "Driver check required. Press I am safe or say I am safe."
    );
  }

  const warningBox = document.createElement("div");
  warningBox.id = "driverWarningBox";
  warningBox.style.position = "fixed";
  warningBox.style.top = "95px";
  warningBox.style.left = "50%";
  warningBox.style.transform = "translateX(-50%)";
  warningBox.style.zIndex = "9999";
  warningBox.style.background = "rgba(0,0,0,0.9)";
  warningBox.style.color = "#ffffff";
  warningBox.style.padding = "18px 20px";
  warningBox.style.borderRadius = "16px";
  warningBox.style.fontSize = "20px";
  warningBox.style.fontWeight = "bold";
  warningBox.style.textAlign = "center";
  warningBox.style.minWidth = "280px";
  warningBox.style.maxWidth = "90vw";
  warningBox.style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)";
  warningBox.innerText = "🚧 ROADSIDE DRIVER CHECK";

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
      emergencySpeak("Driver check still active. Respond now.");
    }
  }, 4000);

  state.warningTimeout = setTimeout(function () {
    clearDriverWarning(state);
    startEmergencyCountdown();
  }, ROADSIDE_WARNING_TIME);
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

function startHazardWarning(state, dom) {
  const now = Date.now();

  if (now - (state.lastHazardWarningAt || 0) < HAZARD_WARNING_COOLDOWN) {
    return;
  }

  state.lastHazardWarningAt = now;

  addStatus(dom.chatBox, "⚠️ Hazard Watch warning: danger detected nearby.");

  showHazardBanner();
  playAlarm(state);

  setTimeout(function () {
    if (!state.warningRunning && !state.emergencyRunning) {
      stopAlarm(state);
    }
  }, HAZARD_ALARM_MS);

  emergencySpeak("Danger nearby. Check surroundings.");
}

function showHazardBanner() {
  clearHazardBanner();

  const banner = document.createElement("div");
  banner.id = "hazardWarningBanner";
  banner.style.position = "fixed";
  banner.style.top = "95px";
  banner.style.left = "50%";
  banner.style.transform = "translateX(-50%)";
  banner.style.zIndex = "9999";
  banner.style.background = "rgba(198, 40, 40, 0.96)";
  banner.style.color = "#ffffff";
  banner.style.padding = "16px 20px";
  banner.style.borderRadius = "16px";
  banner.style.fontSize = "20px";
  banner.style.fontWeight = "bold";
  banner.style.textAlign = "center";
  banner.style.minWidth = "280px";
  banner.style.maxWidth = "90vw";
  banner.style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)";
  banner.innerText = "⚠️ HAZARD NEARBY — CHECK SURROUNDINGS";

  document.body.appendChild(banner);

  setTimeout(function () {
    clearHazardBanner();
  }, HAZARD_BANNER_TIME);
}

function showHazardRecommendation(dom) {
  const existing = document.getElementById("hazardRecommendationBanner");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.id = "hazardRecommendationBanner";
  banner.style.position = "fixed";
  banner.style.top = "95px";
  banner.style.left = "50%";
  banner.style.transform = "translateX(-50%)";
  banner.style.zIndex = "9998";
  banner.style.background = "rgba(0,0,0,0.9)";
  banner.style.color = "#ffffff";
  banner.style.padding = "14px 18px";
  banner.style.borderRadius = "14px";
  banner.style.fontSize = "16px";
  banner.style.fontWeight = "bold";
  banner.style.textAlign = "center";
  banner.style.minWidth = "280px";
  banner.style.maxWidth = "90vw";
  banner.style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)";
  banner.innerText =
    "Hazard Watch is on. For full worker protection, turn on Roadside Protection.";

  document.body.appendChild(banner);

  setTimeout(function () {
    const current = document.getElementById("hazardRecommendationBanner");
    if (current) current.remove();
  }, 6000);
}

function clearHazardBanner() {
  const banner = document.getElementById("hazardWarningBanner");
  if (banner) banner.remove();
}

/* ============================= */
/* 30 MINUTE REMINDERS */
/* ============================= */

function startRoadsideReminder(state, dom) {
  clearRoadsideReminder(state);

  state.roadsideReminderTimer = setTimeout(function () {
    if (!state.driverMinderActive) return;

    addStatus(
      dom.chatBox,
      "⏰ Reminder: Roadside Protection is still on. Turn it off when the scene is complete."
    );

    showTimedReminderBanner(
      "Roadside Protection is still ON. Turn it off when the scene is complete."
    );
  }, REMINDER_MS);
}

function clearRoadsideReminder(state) {
  if (state.roadsideReminderTimer) {
    clearTimeout(state.roadsideReminderTimer);
    state.roadsideReminderTimer = null;
  }
}

function startHazardReminder(state, dom) {
  clearHazardReminder(state);

  state.hazardReminderTimer = setTimeout(function () {
    if (!state.hazardWatchActive) return;

    addStatus(
      dom.chatBox,
      "⏰ Reminder: Hazard Watch is still on. Turn it off when monitoring is no longer needed."
    );

    showTimedReminderBanner(
      "Hazard Watch is still ON. Turn it off when monitoring is no longer needed."
    );
  }, REMINDER_MS);
}

function clearHazardReminder(state) {
  if (state.hazardReminderTimer) {
    clearTimeout(state.hazardReminderTimer);
    state.hazardReminderTimer = null;
  }
}

function showTimedReminderBanner(message) {
  const existing = document.getElementById("taraReminderBanner");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.id = "taraReminderBanner";
  banner.style.position = "fixed";
  banner.style.top = "95px";
  banner.style.left = "50%";
  banner.style.transform = "translateX(-50%)";
  banner.style.zIndex = "9998";
  banner.style.background = "rgba(0,0,0,0.9)";
  banner.style.color = "#ffffff";
  banner.style.padding = "14px 18px";
  banner.style.borderRadius = "14px";
  banner.style.fontSize = "16px";
  banner.style.fontWeight = "bold";
  banner.style.textAlign = "center";
  banner.style.minWidth = "280px";
  banner.style.maxWidth = "90vw";
  banner.style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)";
  banner.innerText = message;

  document.body.appendChild(banner);

  setTimeout(function () {
    const current = document.getElementById("taraReminderBanner");
    if (current) current.remove();
  }, 7000);
}
