document.addEventListener("DOMContentLoaded", function(){

console.log("TARA controls active");

/* ELEMENTS */

const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const menuBtn = document.getElementById("menuBtn");
const closeMenu = document.getElementById("closeMenu");
const menu = document.getElementById("menu");
const emergencyBtn = document.getElementById("emergencyBtn");
const chatBox = document.getElementById("chatBox");
const questionInput = document.getElementById("question");

/* MENU */

menuBtn.onclick = () => {
menu.classList.add("open");
};

closeMenu.onclick = () => {
menu.classList.remove("open");
};

/* SEND BUTTON */

async function sendQuestion(){

const text = questionInput.value.trim();
if(!text) return;

chatBox.innerHTML += `<div class="user"><b>You:</b> ${text}</div>`;
questionInput.value="";

try{

const res = await fetch("/ask",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({question:text})
});

let voiceEnabled = true;
  
const data = await res.json();

chatBox.innerHTML += `<div class="bot"><b>TARA:</b> ${data.answer}</div>`;

chatBox.scrollTop = chatBox.scrollHeight;

speakResponse(data.answer);

}catch(err){

chatBox.innerHTML += `<div class="bot">Connection error</div>`;

}

}

const voiceToggle = document.getElementById("voiceToggle");

if(voiceToggle){

voiceToggle.addEventListener("change", function(){

voiceEnabled = this.checked;

});

}
  
function startVoice(){

const SpeechRecognition =
window.SpeechRecognition || window.webkitSpeechRecognition;

if(!SpeechRecognition){
alert("Voice not supported");
return;
}

function speakResponse(text){

if(!voiceEnabled) return;

const speech = new SpeechSynthesisUtterance(text);

speech.rate = 1;
speech.pitch = 1;

speech.lang = "en-US";

speechSynthesis.speak(speech);

}
  
const recognition = new SpeechRecognition();

recognition.start();

recognition.onresult = e=>{
questionInput.value = e.results[0][0].transcript;
};

}

document
.getElementById("voiceToggle")
.addEventListener("change",function(){

voiceEnabled = this.checked;

});
/* WAKE WORD */

if ("webkitSpeechRecognition" in window) {

const wakeRec = new webkitSpeechRecognition();
wakeRec.continuous = true;

wakeRec.onresult = e => {

const t = e.results[e.results.length - 1][0].transcript.toLowerCase();

if (t.includes("hey tara")) {
alert("TARA Listening");
}

};

wakeRec.start();

}

/* EMERGENCY BUTTON */

let holdTimer;

emergencyBtn.addEventListener("mousedown", startHold);
emergencyBtn.addEventListener("touchstart", startHold);

emergencyBtn.addEventListener("mouseup", cancelHold);
emergencyBtn.addEventListener("touchend", cancelHold);

function startHold(){

let count = 3;
emergencyBtn.innerText = count;

holdTimer = setInterval(()=>{

count--;

if(count > 0){
emergencyBtn.innerText = count;
}else{
clearInterval(holdTimer);
sendEmergency();
}

},1000);

}

function cancelHold(){

clearInterval(holdTimer);

emergencyBtn.innerHTML = "🚨<br>HOLD<br>EMERGENCY";

}

function sendEmergency(){

navigator.geolocation.getCurrentPosition(async pos => {

await fetch("/emergency",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
lat: pos.coords.latitude,
lon: pos.coords.longitude,
driver:"Driver"
})
});

alert("Emergency Alert Sent");

});

}

});
