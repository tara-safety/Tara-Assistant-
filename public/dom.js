export function getDOM() {
  return {
    askBtn: document.getElementById("askBtn"),
    voiceBtn: document.getElementById("voiceBtn"),
    voiceToggle: document.getElementById("voiceToggle"),
    emergencyBtn: document.getElementById("emergencyBtn"),
    emergencyMiniBtn: document.getElementById("emergencyMiniBtn"),
    driverMinderBtn: document.getElementById("driverMinderBtn"),
    towModeBtn: document.getElementById("towModeBtn"),
    towCameraBtn: document.getElementById("towCameraBtn"),
    menuBtn: document.getElementById("menuBtn"),
    menu: document.querySelector(".menu"),
    questionInput: document.getElementById("question"),
    chatBox: document.getElementById("chatBox"),
    contextText: document.getElementById("contextText"),
    riskText: document.getElementById("riskText"),
    soundText: document.getElementById("soundText"),
    driverMinderText: document.getElementById("driverMinderText"),
    contextBadge: document.getElementById("contextBadge"),
    motionDebug: document.getElementById("motionDebug")
  };
}
