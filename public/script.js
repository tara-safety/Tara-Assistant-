const chatBox = document.getElementById("chatBox");
const input = document.getElementById("question");
const askBtn = document.getElementById("askBtn");
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

function addMessage(text, type) {
  const div = document.createElement("div");
  div.className = type;
  div.innerText = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendQuestion() {
  const text = input.value.trim();
  if (!text) return;

  addMessage("YOU: " + text, "user");
  input.value = "";

  const res = await fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: text })
  });

  const data = await res.json();
  addMessage("TARA: " + data.answer, "bot");
}

askBtn.onclick = sendQuestion;

input.addEventListener("keypress", e => {
  if (e.key === "Enter") sendQuestion();
});

/* ---------------- VOICE ---------------- */

voiceBtn.onclick = () => {
  const rec = new webkitSpeechRecognition();
  rec.lang = "en-US";
  rec.onresult = e => {
    input.value = e.results[0][0].transcript;
    sendQuestion();
  };
  rec.start();
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
