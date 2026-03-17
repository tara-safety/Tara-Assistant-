import {
  DRIVER_NAME,
  COMPANY,
  EMERGENCY_COUNTDOWN
} from "./config.js";
import { addStatus } from "./ui.js";

export function playAlarm(state) {
  if (!state.alarmAudio) return;

  state.alarmAudio.currentTime = 0;
  state.alarmAudio.play().catch(() => {
    console.log("Alarm blocked by iOS");
  });
}

export function stopAlarm(state) {
  if (!state.alarmAudio) return;

  state.alarmAudio.pause();
  state.alarmAudio.currentTime = 0;
}

export function setupEmergencyButton(state, dom, startEmergencyCountdown) {
  if (!dom.emergencyBtn) return;

  dom.emergencyBtn.addEventListener("mousedown", () =>
    startHold(state, startEmergencyCountdown)
  );
  dom.emergencyBtn.addEventListener("touchstart", () =>
    startHold(state, startEmergencyCountdown)
  );

  dom.emergencyBtn.addEventListener("mouseup", () => cancelHold(state));
  dom.emergencyBtn.addEventListener("mouseleave", () => cancelHold(state));
  dom.emergencyBtn.addEventListener("touchend", () => cancelHold(state));
}

function startHold(state, startEmergencyCountdown) {
  let count = 3;

  state.holdTimer = setInterval(function () {
    count--;

    if (count <= 0) {
      clearInterval(state.holdTimer);
      startEmergencyCountdown();
    }
  }, 1000);
}

function cancelHold(state) {
  clearInterval(state.holdTimer);
}

export function startEmergencyCountdown(state, dom) {
  if (state.emergencyRunning) return;

  state.emergencyRunning = true;
  playAlarm(state);
  addStatus(dom.chatBox, "🚨 Emergency countdown started");

  let count = EMERGENCY_COUNTDOWN;

  const cancelBtn = document.createElement("button");
cancelBtn.innerText = "CANCEL EMERGENCY";
cancelBtn.style.position = "fixed";
cancelBtn.style.bottom = "120px";
cancelBtn.style.left = "50%";
cancelBtn.style.transform = "translateX(-50%)";
cancelBtn.style.zIndex = "9999";

cancelBtn.style.background = "#c62828";
cancelBtn.style.color = "#ffffff";
cancelBtn.style.border = "none";
cancelBtn.style.borderRadius = "14px";
cancelBtn.style.padding = "18px 28px";
cancelBtn.style.fontSize = "20px";
cancelBtn.style.fontWeight = "bold";
cancelBtn.style.boxShadow = "0 6px 18px rgba(0,0,0,0.35)";
cancelBtn.style.minWidth = "260px";
cancelBtn.style.minHeight = "70px";
cancelBtn.style.textAlign = "center";
cancelBtn.style.cursor = "pointer";
cancelBtn.style.border = "3px solid #ffffff";

  document.body.appendChild(cancelBtn);

  const timer = setInterval(function () {
    count--;
    if (count <= 0) {
      clearInterval(timer);
      cancelBtn.remove();
      triggerEmergency(state, dom);
    }
  }, 1000);

  cancelBtn.onclick = function () {
    clearInterval(timer);
    stopAlarm(state);
    cancelBtn.remove();
    addStatus(dom.chatBox, "Emergency cancelled");
    state.emergencyRunning = false;
    state.emergencyActive = false;
  };
}

export function triggerEmergency(state, dom) {
  if (state.emergencyActive) return;

  state.emergencyActive = true;

  if (!navigator.geolocation) {
    addStatus(dom.chatBox, "⚠️ Geolocation not supported");
    sendEmergency(state, dom, null, null);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      sendEmergency(
        state,
        dom,
        pos.coords.latitude,
        pos.coords.longitude
      );
    },
    function () {
      addStatus(dom.chatBox, "⚠️ Location unavailable, sending without GPS");
      sendEmergency(state, dom, null, null);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  );
}

export async function sendEmergency(state, dom, lat, lon, retry = 0) {
  try {
    console.log("Sending emergency alert");

    const res = await fetch(
      "https://tara-assistant-dwhg.onrender.com/emergency",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver: DRIVER_NAME,
          company: COMPANY,
          time: new Date().toISOString(),
          lat,
          lon
        })
      }
    );

    if (!res.ok) {
      throw new Error("server error");
    }

    addStatus(dom.chatBox, "🚨 Emergency Alert Sent");
    stopAlarm(state);
    state.emergencyRunning = false;
    state.emergencyActive = false;
  } catch (error) {
    console.log("Emergency error:", error);
    addStatus(dom.chatBox, "⚠️ Alert failed");

    if (retry < 3) {
      addStatus(dom.chatBox, "🔁 Retrying...");
      setTimeout(function () {
        sendEmergency(state, dom, lat, lon, retry + 1);
      }, 5000);
    } else {
      addStatus(dom.chatBox, "❌ Emergency failed after retries");
      stopAlarm(state);
      state.emergencyRunning = false;
      state.emergencyActive = false;
    }
  }
}
