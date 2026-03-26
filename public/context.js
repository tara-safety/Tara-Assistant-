const DRIVING_SPEED_MPS = 2.8; // about 10 km/h

export function setupContextAwareness(state, dom) {
  if (!state.contextMode) {
    state.contextMode = "idle";
  }

  // No UI updates anymore — silent system
  startSpeedWatch(state);
}

/* ============================= */
/* SPEED WATCH (BACKGROUND ONLY) */
/* ============================= */

function startSpeedWatch(state) {
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
        state.contextMode = "driving";
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

/* ============================= */
/* MOTION CONTEXT (BACKGROUND) */
/* ============================= */

export function updateMotionContext(state, motionLevel) {
  const now = Date.now();

  state.lastMotionLevel = motionLevel;

  // simplified scoring (kept for internal logic)
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

  // still track internally (NO UI)
  if (motionLevel > 11) {
    state.contextMode = "driving";
  } else if (motionLevel > 5) {
    state.contextMode = "working";
  } else if (motionLevel > 2.2) {
    state.contextMode = "walking";
  } else {
    state.contextMode = "idle";
  }
}

/* ============================= */
/* INACTIVITY LOGIC (UPDATED) */
/* ============================= */

export function shouldPauseInactivityForDriving(state) {
  // still needed for safety logic
  return state.contextMode === "driving";
}

export function getContextInactivityLimit(state) {
  if (state.contextMode === "driving") {
    return null;
  }

  if (state.driverMinderActive) {
    // Roadside Protection active
    return 30000; // 30 seconds (adjust later)
  }

  return 8 * 60 * 1000;
}
