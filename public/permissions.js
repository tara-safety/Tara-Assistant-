import { ALARM_URL } from "./config.js";

export function setupSystemUnlock(state) {
  document.addEventListener("click", async function unlockOnce() {
    if (state.systemUnlocked) return;

    state.systemUnlocked = true;
    console.log("Unlocking permissions");

    try {
      const speech = new SpeechSynthesisUtterance("");
      speechSynthesis.speak(speech);
    } catch (e) {
      console.log("Speech unlock failed", e);
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.log("Mic permission not granted", e);
    }

    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function"
    ) {
      try {
        await DeviceMotionEvent.requestPermission();
      } catch (e) {
        console.log("Motion permission request failed", e);
      }
    }

    state.alarmAudio = new Audio(ALARM_URL);
    state.alarmAudio.loop = true;
  });
}

export async function requestMotionPermission() {
  if (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {
    try {
      const response = await DeviceMotionEvent.requestPermission();
      console.log("Motion permission:", response);

      if (response !== "granted") {
        alert("Motion permission is required for Driver Minder");
      }
    } catch (err) {
      console.log("Motion permission error:", err);
    }
  }
}
