import { addStatus } from "./ui.js";

const DRIVING_SPEED_MPS = 2.8; // ~10 km/h
const WORKING_MOTION_THRESHOLD = 4.5;
const IDLE_MOTION_THRESHOLD = 2.5;

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

      if (speed !== null && speed !== undefined) {
        if (speed > DRIVING_SPEED_MPS) {
          setContextMode(state, dom, "driving");
          return;
        }
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
    // driving stays priority if speed put it there recently
    if (state.contextMode === "driving") {
      if (state.lastMotionLevel < IDLE_MOTION_THRESHOLD) {
        setContextMode(state, dom, "idle");
      }
      return;
    }

    // easier working detection for walking / loading movement
    if (state.lastMotionLevel >= WORKING_MOTION_THRESHOLD) {
      setContextMode(state, dom, "working");
    } else if (state.lastMotionLevel >= IDLE_MOTION_THRESHOLD) {
      setContextMode(state, dom, "working");
    } else {
      setContextMode(state, dom, "idle");
    }
  }, 2000);
}

export function updateMotionContext(state, motionLevel) {
  state.lastMotionLevel = motionLevel;
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

export function shouldPauseInactivityForDriving(state) {
  return state.contextMode === "driving";
}
