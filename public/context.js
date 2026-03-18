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
  state.lastMotionLevel = motionLevel;

  const now = Date.now();

  if (motionLevel >= 2.2) {
    state.motionActivityScore = Math.min(state.motionActivityScore + 3, 20);
    state.lastMovementTime = now;
  } else if (motionLevel >= 1.2) {
    state.motionActivityScore = Math.min(state.motionActivityScore + 1, 20);
    state.lastMovementTime = now;
  } else {
    state.motionActivityScore = Math.max(state.motionActivityScore - 1, 0);
  }
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
