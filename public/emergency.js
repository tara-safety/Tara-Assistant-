import {
  DRIVER_NAME,
  COMPANY,
  EMERGENCY_COUNTDOWN
} from "./config.js";
import { addStatus } from "./ui.js";
import {
  startSafetyVoiceListener,
  stopSafetyVoiceListener,
  forceSpeak
} from "./voice.js";

const EMERGENCY_QUEUE_KEY = "tara_emergency_queue_v1";
const RETRY_INTERVAL_MS = 10000;

let retryIntervalStarted = false;

/* ============================= */
/* HIGH-RISK SIREN */
/* ============================= */

async function startHighRiskSiren(state) {
  try {
    if (!state.sirenAudioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      state.sirenAudioContext = new AudioCtx();
    }

    if (state.sirenAudioContext.state === "suspended") {
      await state.sirenAudioContext.resume();
    }

    if (state.sirenOscillator) return true;

    const ctx = state.sirenAudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(740, ctx.currentTime);

    gain.gain.setValueAtTime(0.16, ctx.currentTime);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();

    let high = false;
    state.sirenInterval = setInterval(function () {
      if (!state.sirenOscillator) return;
      high = !high;
      try {
        osc.frequency.setValueAtTime(high ? 1040 : 740, ctx.currentTime);
      } catch (e) {}
    }, 220);

    state.sirenOscillator = osc;
    state.sirenGain = gain;

    return true;
  } catch (err) {
    console.log("High-risk siren failed:", err);
    return false;
  }
}

function stopHighRiskSiren(state) {
  try {
    if (state.sirenInterval) {
      clearInterval(state.sirenInterval);
      state.sirenInterval = null;
    }

    if (state.sirenOscillator) {
      state.sirenOscillator.stop();
      state.sirenOscillator.disconnect();
      state.sirenOscillator = null;
    }

    if (state.sirenGain) {
      state.sirenGain.disconnect();
      state.sirenGain = null;
    }
  } catch (err) {
    console.log("High-risk siren stop failed:", err);
  }
}

/* ============================= */
/* ALARM */
/* ============================= */

export function playAlarm(state) {
  if (state.highRiskMode) {
    startHighRiskSiren(state);
    return;
  }

  if (!state.alarmAudio) return;

  state.alarmAudio.currentTime = 0;
  state.alarmAudio.play().catch(() => {
    console.log("Alarm blocked by iPhone");
  });
}

export function stopAlarm(state) {
  stopHighRiskSiren(state);

  if (!state.alarmAudio) return;

  state.alarmAudio.pause();
  state.alarmAudio.currentTime = 0;
}

/* ============================= */
/* EMERGENCY BUTTON SETUP */
/* ============================= */

export function setupEmergencyButton(state, dom, startEmergencyCountdown) {
  const buttons = [
    document.getElementById("emergencyBtn"),
    document.getElementById("emergencyMiniBtn")
  ].filter(Boolean);

  buttons.forEach(function (btn) {
    btn.addEventListener("mousedown", function () {
      startHold(state, startEmergencyCountdown);
    });

    btn.addEventListener("touchstart", function () {
      startHold(state, startEmergencyCountdown);
    });

    btn.addEventListener("mouseup", function () {
      cancelHold(state);
    });

    btn.addEventListener("mouseleave", function () {
      cancelHold(state);
    });

    btn.addEventListener("touchend", function () {
      cancelHold(state);
    });

    btn.addEventListener("touchcancel", function () {
      cancelHold(state);
    });
  });
}

/* ============================= */
/* HOLD LOGIC */
/* ============================= */

function startHold(state, startEmergencyCountdown) {
  if (state.holdTimer) {
    clearInterval(state.holdTimer);
  }

  let count = 3;

  playAlarm(state);

  state.holdTimer = setInterval(function () {
    count--;

    if (count <= 0) {
      clearInterval(state.holdTimer);
      state.holdTimer = null;
      startEmergencyCountdown();
    }
  }, 1000);
}

function cancelHold(state) {
  if (state.holdTimer) {
    clearInterval(state.holdTimer);
    state.holdTimer = null;
  }

  if (!state.emergencyRunning) {
    stopAlarm(state);
  }
}

/* ============================= */
/* EMERGENCY COUNTDOWN */
/* ============================= */

export function startEmergencyCountdown(state, dom) {
  if (state.emergencyRunning) return;

  state.emergencyRunning = true;
  playAlarm(state);
  addStatus(dom.chatBox, "🚨 Emergency countdown started");

  if (state.highRiskMode) {
    forceSpeak("High-risk emergency countdown started. Say cancel emergency now.");
  } else {
    forceSpeak("Emergency countdown started. Say cancel emergency to stop.");
  }

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
  cancelBtn.style.border = "3px solid #ffffff";
  cancelBtn.style.borderRadius = "16px";
  cancelBtn.style.padding = "20px 30px";
  cancelBtn.style.fontSize = "22px";
  cancelBtn.style.fontWeight = "bold";
  cancelBtn.style.boxShadow = "0 8px 22px rgba(0,0,0,0.4)";
  cancelBtn.style.minWidth = "280px";
  cancelBtn.style.minHeight = "78px";
  cancelBtn.style.textAlign = "center";

  document.body.appendChild(cancelBtn);

  function cancelEmergencyCountdown() {
    clearInterval(timer);
    stopAlarm(state);
    stopSafetyVoiceListener(state);
    cancelBtn.remove();
    addStatus(dom.chatBox, "Emergency cancelled");
    state.emergencyRunning = false;
    state.emergencyActive = false;
  }

  cancelBtn.onclick = function () {
    cancelEmergencyCountdown();
  };

  startSafetyVoiceListener(state, function () {
    cancelEmergencyCountdown();
  });

  const timer = setInterval(function () {
    count--;

    if (count === 20) {
      forceSpeak("Emergency in twenty seconds. Say cancel emergency to stop.");
    }

    if (count === 10) {
      forceSpeak("Emergency in ten seconds. Say cancel emergency to stop.");
    }

    if (count <= 0) {
      clearInterval(timer);
      stopSafetyVoiceListener(state);
      cancelBtn.remove();
      triggerEmergency(state, dom);
    }
  }, 1000);
}

/* ============================= */
/* TRIGGER EMERGENCY */
/* ============================= */

export function triggerEmergency(state, dom) {
  if (state.emergencyActive) return;

  state.emergencyActive = true;

  if (!navigator.geolocation) {
    addStatus(dom.chatBox, "⚠️ Geolocation not supported");
    queueAndSendEmergency(state, dom, null, null);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      queueAndSendEmergency(
        state,
        dom,
        pos.coords.latitude,
        pos.coords.longitude
      );
    },
    function () {
      addStatus(dom.chatBox, "⚠️ Location unavailable, sending without GPS");
      queueAndSendEmergency(state, dom, null, null);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  );
}

/* ============================= */
/* QUEUE + SEND */
/* ============================= */

function makeEmergencyPayload(lat, lon) {
  return {
    id: "emg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    driver: DRIVER_NAME,
    company: COMPANY,
    time: new Date().toISOString(),
    lat,
    lon,
    status: "pending"
  };
}

function readEmergencyQueue() {
  try {
    const raw = localStorage.getItem(EMERGENCY_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.log("Queue read failed:", err);
    return [];
  }
}

function writeEmergencyQueue(queue) {
  try {
    localStorage.setItem(EMERGENCY_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.log("Queue write failed:", err);
  }
}

function addToEmergencyQueue(payload) {
  const queue = readEmergencyQueue();
  queue.push(payload);
  writeEmergencyQueue(queue);
}

function removeFromEmergencyQueue(id) {
  const queue = readEmergencyQueue().filter((item) => item.id !== id);
  writeEmergencyQueue(queue);
}

export async function queueAndSendEmergency(state, dom, lat, lon) {
  const payload = makeEmergencyPayload(lat, lon);

  addToEmergencyQueue(payload);
  addStatus(dom.chatBox, "📦 Emergency saved for fail-safe delivery");

  const sent = await sendQueuedPayload(payload);

  if (sent) {
    removeFromEmergencyQueue(payload.id);
    addStatus(dom.chatBox, "🚨 Emergency Alert Sent");
  } else {
    addStatus(dom.chatBox, "⚠️ Alert not delivered yet. Retry queue active.");
  }

  stopAlarm(state);
  state.emergencyRunning = false;
  state.emergencyActive = false;
}

async function sendQueuedPayload(payload) {
  try {
    const res = await fetch(
      "https://tara-assistant-dwhg.onrender.com/emergency",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver: payload.driver,
          company: payload.company,
          time: payload.time,
          lat: payload.lat,
          lon: payload.lon
        })
      }
    );

    if (!res.ok) {
      throw new Error("server error");
    }

    return true;
  } catch (error) {
    console.log("Queued emergency send failed:", error);
    return false;
  }
}

/* ============================= */
/* FAIL-SAFE RETRY SYSTEM */
/* ============================= */

export function setupEmergencyFailSafe(dom) {
  if (retryIntervalStarted) return;
  retryIntervalStarted = true;

  async function processEmergencyQueue() {
    const queue = readEmergencyQueue();
    if (!queue.length) return;

    for (const payload of queue) {
      const sent = await sendQueuedPayload(payload);

      if (sent) {
        removeFromEmergencyQueue(payload.id);
        if (dom && dom.chatBox) {
          addStatus(dom.chatBox, "✅ Queued emergency delivered");
        }
      }
    }
  }

  window.addEventListener("online", function () {
    console.log("Connection restored. Retrying queued emergencies.");
    processEmergencyQueue();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      processEmergencyQueue();
    }
  });

  setInterval(processEmergencyQueue, RETRY_INTERVAL_MS);
  processEmergencyQueue();
}
