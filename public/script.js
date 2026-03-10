const askBtn = document.getElementById("askBtn");
const questionInput = document.getElementById("question");
const chatBox = document.getElementById("chatBox");
const voiceBtn = document.getElementById("voiceBtn");
const menuBtn = document.getElementById("menuBtn");
const menu = document.getElementById("menu");
const closeMenu = document.getElementById("closeMenu");
const emergencyBtn = document.getElementById("emergencyBtn");
const progress = document.getElementById("progressCircle");

/* ---------------- MENU ---------------- */

menuBtn.onclick = () => {
menu.style.left = "0";
};

closeMenu.onclick = () => {
menu.style.left = "-260px";
};

/* ---------------- CHAT ---------------- */

askBtn.onclick = async () => {

const question = questionInput.value.trim();

if(!question) return;

chatBox.innerHTML += `<div><b>You:</b> ${question}</div>`;

questionInput.value = "";

chatBox.innerHTML += `<div id="thinking">TARA is thinking...</div>`;

const res = await fetch("/ask",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({question})
});

const data = await res.json();

document.getElementById("thinking").remove();

chatBox.innerHTML += `<div><b>TARA:</b> ${data.answer}</div>`;

chatBox.scrollTop = chatBox.scrollHeight;

};

/* ---------------- VOICE ---------------- */
voiceBtn.onclick = () => {

const recognition = new(window.SpeechRecognition || window.webkitSpeechRecognition)();

recognition.lang = "en-US";

recognition.start();

recognition.onresult = function(event){

const transcript = event.results[0][0].transcript;

document.getElementById("question").value = transcript;

};

};

/* ---------------- WAKE WORD ---------------- */

const wakeRec = new webkitSpeechRecognition();
wakeRec.continuous = true;

wakeRec.onresult = e => {
  const t = e.results[e.results.length - 1][0].transcript.toLowerCase();
  if (t.includes("hey tara")) {
    alert("TARA Listening");
  }
};

wakeRec.start();

/* ---------------- EMERGENCY ---------------- */

let holdTimer;

emergencyBtn.addEventListener("touchstart", startHold, { passive:false });
emergencyBtn.addEventListener("mousedown", startHold);

emergencyBtn.addEventListener("touchend", cancelHold);
emergencyBtn.addEventListener("mouseup", cancelHold);

function startHold(e) {
  e.preventDefault();
  progress.style.width = "100%";
  holdTimer = setTimeout(triggerEmergency, 3000);
}

function cancelHold() {
  progress.style.width = "0%";
  clearTimeout(holdTimer);
}

function triggerEmergency() {
  navigator.geolocation.getCurrentPosition(async pos => {

    await fetch("/emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        driver: "Driver 00"
      })
    });

    alert("Emergency Alert Sent");
  });
}
