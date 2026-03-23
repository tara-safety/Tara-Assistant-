import { addStatus } from "./ui.js";

const DRIVING_SPEED_MPS = 2.8; // ~10 km/h
const WORKING_SCORE_THRESHOLD = 8;
const IDLE_SCORE_THRESHOLD = 2;

export function setupContextAwareness(state, dom) {
  startSpeedWatch(state, dom);
  startContextHeartbeat(state, dom);
}

function startSpeedWatch(state, dom) {
  if (!navigator.geolocation) {
    console.log("Geolocation watch not supported");
    return;
  }

  if (state.watchId !== null) return;

  state.watchId = navigator.geolocation.watchPosition(
    function (pos) {
      const speed = pos.coords.speed;

      if (speed !== null && speed !== undefined && speed > DRIVING_SPEED_MPS) {
        setContextMode(state, dom, "driving");
      }
    },
    function (err) {
      console.log("Speed watch error:", err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000
    }
  );
}

function startContextHeartbeat(state, dom) {
  setInterval(function () {
    if (state.contextMode === "driving") {
      const now = Date.now();
const timeSinceMove = now - state.lastMovementTime;

// require 6 seconds of no movement before going idle
if (
  state.motionActivityScore <= IDLE_SCORE_THRESHOLD &&
  timeSinceMove > 6000
) {
  setContextMode(state, dom, "idle");
}
      updateMotionDebug(dom, state);
      return;
    }

    if (state.motionActivityScore >= WORKING_SCORE_THRESHOLD) {
      setContextMode(state, dom, "working");
    } else if (state.motionActivityScore <= IDLE_SCORE_THRESHOLD) {
      setContextMode(state, dom, "idle");
    }

    updateMotionDebug(dom, state);
  }, 1000);
}

export function updateMotionContext(state, motionLevel) {
  const now = Date.now();

  let candidate = "idle";

  if (motionLevel > 11) {
    candidate = "driving";
  } else if (motionLevel > 5) {
    candidate = "working";
  } else if (motionLevel > 2.2) {
    candidate = "walking";
  }

  if (state.pendingContext !== candidate) {
    state.pendingContext = candidate;
    state.pendingContextSince = now;
    return;
  }

  const holdTime = candidate === "driving" ? 2500 : 4000;
  const canSwitch =
    !state.lastContextChangeAt ||
    now - state.lastContextChangeAt > 3000;

  if (
    canSwitch &&
    state.contextMode !== candidate &&
    now - state.pendingContextSince >= holdTime
  ) {
    state.contextMode = candidate;
    state.lastContextChangeAt = now;

    const el = document.getElementById("contextText");
    if (el) {
      el.textContent =
        `Context: ${candidate.charAt(0).toUpperCase() + candidate.slice(1)}`;
    }
  }
}

export function shouldPauseInactivityForDriving(state) {
  return state.contextMode === "driving";
}

export function setContextMode(state, dom, mode) {
  if (state.contextMode === mode) return;

  state.contextMode = mode;
  updateContextBadge(dom, mode);

  if (mode === "driving") {
    addStatus(dom.chatBox, "🟢 Context: Driving");
  } else if (mode === "working") {
    addStatus(dom.chatBox, "🟡 Context: Working");
  } else {
    addStatus(dom.chatBox, "⚪ Context: Idle");
  }
}

export function updateContextBadge(dom, mode) {
  const badge = document.getElementById("contextBadge");
  if (!badge) return;

  if (mode === "driving") {
    badge.innerText = "🟢 DRIVING";
  } else if (mode === "working") {
    badge.innerText = "🟡 WORKING";
  } else {
    badge.innerText = "⚪ IDLE";
  }
}

function updateMotionDebug(dom, state) {
  const debug = document.getElementById("motionDebug");
  if (!debug) return;

  debug.innerText =
    `Motion: ${state.lastMotionLevel.toFixed(2)} | ` +
    `Score: ${state.motionActivityScore} | ` +
    `Mode: ${state.contextMode.toUpperCase()}`;
}

export function shouldPauseInactivityForDriving(state) {
  return state.contextMode === "driving";
}

export function getContextInactivityLimit(state) {
  if (state.contextMode === "working") {
    return 120000; // 2 minutes while actively working
  }

  if (state.contextMode === "idle") {
    return 8 * 60 * 1000; // 8 minutes normal idle
  }

  if (state.contextMode === "driving") {
    return null; // paused while driving
  }

  return 8 * 60 * 1000;
}
