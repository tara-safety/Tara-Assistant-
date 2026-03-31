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

/* ============================= */
/* VIBRATION HELPERS */
/* ============================= */

function vibrate(pattern) {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

function stopVibration() {
  if ("vibrate" in navigator) {
    navigator.vibrate(0);
  }
}

/* ============================= */
/* CONFIG */
/* ============================= */

const ROADSIDE_WARNING_TIME = 12000;
const WARNING_CLEAR_DELAY = 4000;
const WARNING_CLEAR_THRESHOLD = 18;
const WARNING_CLEAR_HITS_REQUIRED = 6;
const MEANINGFUL_IMPACT_RESET = 12;
const MEANINGFUL_MOTION_RESET = 6.2;
const WARNING_RETRIGGER_COOLDOWN = 7000;

const REMINDER_MS = 30 * 60 * 1000;
const HAZARD_WARNING_COOLDOWN = 9000;
const HAZARD_BANNER_TIME = 6000;
const HAZARD_ALARM_MS = 1500;

/* ============================= */
/* SETUP */
/* ============================= */

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

/* ============================= */
/* MOTION */
/* ============================= */

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

    const meaningfulMotion =
      impact > MEANINGFUL_IMPACT_RESET &&
      motionLevel > MEANINGFUL_MOTION_RESET;

    if (meaningfulMotion) {
      resetInactivityTimer(state, dom, startEmergencyCountdown);
    }
  });
}

/* ============================= */
/* INACTIVITY */
/* ============================= */

export function resetInactivityTimer(state, dom, startEmergencyCountdown) {
  clearTimeout(state.inactivityTimer);

  if (!state.driverMinderActive) return;

  state.inactivityTimer = setTimeout(function () {
    startDriverWarning(state, dom, startEmergencyCountdown, "inactivity");
  }, INACTIVITY_LIMIT);
}

/* ============================= */
/* DRIVER WARNING */
/* ============================= */

function startDriverWarning(state, dom, startEmergencyCountdown, reason) {
  if (state.warningRunning || state.emergencyRunning) return;

  state.warningRunning = true;

  addStatus(dom.chatBox, "⚠️ Driver check started");

  playAlarm(state);
  vibrate([500, 200, 500, 200, 1000]);

  emergencySpeak("Respond now.", function () {
    if (state.warningRunning) {
      playAlarm(state);
      vibrate([400, 150, 400, 150, 900]);
    }
  });

  startSafetyVoiceListener(state, function () {
    clearDriverWarning(state);
  });

  setTimeout(function () {
    if (state.warningRunning) {
      startEmergencyCountdown();
    }
  }, ROADSIDE_WARNING_TIME);
}

function clearDriverWarning(state) {
  state.warningRunning = false;

  stopSpeaking();
  stopSafetyVoiceListener(state);
  stopAlarm(state);
  stopVibration();
}

/* ============================= */
/* HAZARD WARNING */
/* ============================= */

function startHazardWarning(state, dom) {
  const now = Date.now();

  if (now - (state.lastHazardWarningAt || 0) < HAZARD_WARNING_COOLDOWN) {
    return;
  }

  state.lastHazardWarningAt = now;

  addStatus(dom.chatBox, "⚠️ Hazard nearby");

  showHazardBanner();

  playAlarm(state);
  vibrate([200, 120, 200]);

  setTimeout(function () {
    stopAlarm(state);
  }, HAZARD_ALARM_MS);

  emergencySpeak("Danger nearby.", function () {
    playAlarm(state);
  });
}

/* ============================= */
/* UI */
/* ============================= */

function showHazardBanner() {
  clearHazardBanner();

  const banner = document.createElement("div");
  banner.id = "hazardWarningBanner";
  banner.style.position = "fixed";
  banner.style.top = "95px";
  banner.style.left = "50%";
  banner.style.transform = "translateX(-50%)";
  banner.style.zIndex = "9999";
  banner.style.background = "red";
  banner.style.color = "#fff";
  banner.style.padding = "16px";
  banner.style.borderRadius = "16px";
  banner.style.fontSize = "20px";
  banner.style.fontWeight = "bold";
  banner.innerText = "⚠️ HAZARD NEARBY";

  document.body.appendChild(banner);

  setTimeout(clearHazardBanner, HAZARD_BANNER_TIME);
}

function clearHazardBanner() {
  const banner = document.getElementById("hazardWarningBanner");
  if (banner) banner.remove();
}
