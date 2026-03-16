import {
  IMPACT_LIMIT,
  INACTIVITY_LIMIT,
  IMPACT_COOLDOWN
} from "./config.js";
import { addStatus } from "./ui.js";
import { requestMotionPermission } from "./permissions.js";

export function setupDriverMinder(state, dom, startEmergencyCountdown) {
  if (!dom.driverMinderBtn) return;

  dom.driverMinderBtn.addEventListener("click", async function () {
    state.driverMinderActive = !state.driverMinderActive;

    if (state.driverMinderActive) {
      dom.driverMinderBtn.innerText = "Driver Minder ON";
      addStatus(dom.chatBox, "🟢 Driver Minder Activated");

      await requestMotionPermission();
      resetInactivityTimer(state, startEmergencyCountdown);
      startMotionMonitoring(state, startEmergencyCountdown);
    } else {
      dom.driverMinderBtn.innerText = "Driver Minder OFF";
      addStatus(dom.chatBox, "⚪ Driver Minder Disabled");
      clearTimeout(state.inactivityTimer);
    }
  });
}

export function startMotionMonitoring(state, startEmergencyCountdown) {
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
        startEmergencyCountdown();
      }
    }

    resetInactivityTimer(state, startEmergencyCountdown);
  });
}

export function resetInactivityTimer(state, startEmergencyCountdown) {
  clearTimeout(state.inactivityTimer);

  state.inactivityTimer = setTimeout(function () {
    if (state.driverMinderActive) {
      startEmergencyCountdown();
    }
  }, INACTIVITY_LIMIT);
}
