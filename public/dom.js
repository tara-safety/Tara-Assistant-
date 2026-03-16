export function getDOM() {
  return {
    askBtn: document.getElementById("askBtn"),
    voiceBtn: document.getElementById("voiceBtn"),
    emergencyBtn: document.getElementById("emergencyBtn"),
    driverMinderBtn: document.getElementById("driverMinderBtn"),
    towModeBtn: document.getElementById("towModeBtn"),
    towCameraBtn: document.getElementById("towCameraBtn"),
    menuBtn: document.getElementById("menuBtn"),
    menu: document.querySelector(".menu"),
    questionInput: document.getElementById("question"),
    chatBox: document.getElementById("chatBox")
  };
}
