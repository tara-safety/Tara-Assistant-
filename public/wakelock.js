export async function requestWakeLock(state) {
  if (!("wakeLock" in navigator)) {
    console.log("Wake Lock not supported on this device/browser");
    return false;
  }

  try {
    state.wakeLock = await navigator.wakeLock.request("screen");
    console.log("Wake Lock active");

    state.wakeLock.addEventListener("release", () => {
      console.log("Wake Lock released");
    });

    return true;
  } catch (err) {
    console.log("Wake Lock request failed:", err);
    return false;
  }
}

export async function releaseWakeLock(state) {
  if (!state.wakeLock) return;

  try {
    await state.wakeLock.release();
    state.wakeLock = null;
    console.log("Wake Lock released manually");
  } catch (err) {
    console.log("Wake Lock release failed:", err);
  }
}

export async function restoreWakeLockIfNeeded(state) {
  if (!state.driverMinderActive) return;
  if (!("wakeLock" in navigator)) return;
  if (document.visibilityState !== "visible") return;

  try {
    if (!state.wakeLock) {
      state.wakeLock = await navigator.wakeLock.request("screen");
      console.log("Wake Lock restored");
    }
  } catch (err) {
    console.log("Wake Lock restore failed:", err);
  }
}
