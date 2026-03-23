const DRIVING_SPEED_MPS = 2.8; // about 10 km/h

export function setupContextAwareness(state, dom) {
  if (!state.contextMode) {
    state.contextMode = "idle";
  }

  updateContextUI(state, dom);
  startSpeedWatch(state, dom);
}

function startSpeedWatch(state, dom) {
  if (!navigator.geolocation) {
    console.log("Geolocation watch not supported");
    return;
  }

  if (state.watchId !== null && state.watchId !== undefined) return;

  state.watchId = navigator.geolocation.watchPosition(
    function (pos) {
      const speed = pos.coords.speed;

      if (
        speed !== null &&
        speed !== undefined &&
        speed > DRIVING_SPEED_MPS
      ) {
        forceContextMode(state, dom, "driving");
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

export function updateMotionContext(state, motionLevel) {
  const now = Date.now();

  state.lastMotionLevel = motionLevel;

  if (motionLevel > 11) {
    state.motionActivityScore = 20;
  } else if (motionLevel > 5) {
    state.motionActivityScore = 12;
  } else if (motionLevel > 2.2) {
    state.motionActivityScore = 6;
  } else {
    state.motionActivityScore = 0;
  }

  if (motionLevel > 2.2) {
    state.lastMovementTime = now;
  }

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
    updateContextUI(state);
  }
}

export function shouldPauseInactivityForDriving(state) {
  return state.contextMode === "driving";
}

export function getContextInactivityLimit(state) {
  if (state.contextMode === "driving") {
    return null;
  }

  if (state.highRiskMode) {
    if (state.contextMode === "working") {
      return 25000;
    }

    if (state.contextMode === "walking") {
      return 35000;
    }

    return 60000;
  }

  if (state.contextMode === "working") {
    return 120000;
  }

  if (state.contextMode === "walking") {
    return 180000;
  }

  return 8 * 60 * 1000;
}

function forceContextMode(state, dom, mode) {
  if (state.contextMode === mode) return;

  state.contextMode = mode;
  state.pendingContext = mode;
  state.pendingContextSince = Date.now();
  state.lastContextChangeAt = Date.now();

  updateContextUI(state, dom);
}

function updateContextUI(state, dom) {
  const contextText =
    (dom && dom.contextText) || document.getElementById("contextText");
  const riskText =
    (dom && dom.riskText) || document.getElementById("riskText");
  const soundText =
    (dom && dom.soundText) || document.getElementById("soundText");
  const badge =
    (dom && dom.contextBadge) || document.getElementById("contextBadge");
  const debug =
    (dom && dom.motionDebug) || document.getElementById("motionDebug");

  if (contextText) {
    contextText.textContent =
      `Context: ${capitalize(state.contextMode || "idle")}`;
  }

  if (riskText) {
    riskText.textContent = state.highRiskMode ? "Risk: High" : "Risk: Normal";
  }

  if (soundText) {
    soundText.textContent = state.soundWatchActive
      ? "Sound Watch: On"
      : "Sound Watch: Off";
  }

  if (badge) {
    if (state.contextMode === "driving") {
      badge.innerText = "🟢 DRIVING";
    } else if (state.contextMode === "working") {
      badge.innerText = "🟡 WORKING";
    } else if (state.contextMode === "walking") {
      badge.innerText = "🚶 WALKING";
    } else {
      badge.innerText = "⚪ IDLE";
    }
  }

  if (debug) {
    debug.innerText =
      `Motion: ${(state.lastMotionLevel || 0).toFixed(2)} | ` +
      `Score: ${state.motionActivityScore || 0} | ` +
      `Mode: ${(state.contextMode || "idle").toUpperCase()}`;
  }
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
