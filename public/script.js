document.addEventListener("DOMContentLoaded", function(){

console.log("TARA controls active");

/* ------------------ ELEMENTS ------------------ */

const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const menuBtn = document.getElementById("menuBtn");
const closeMenu = document.getElementById("closeMenu");
const menu = document.getElementById("menu");
const emergencyBtn = document.getElementById("emergencyBtn");
const chatBox = document.getElementById("chatBox");
const questionInput = document.getElementById("question");

/* ------------------ VOICE TOGGLE ------------------ */

let voiceEnabled = true;

const voiceToggle = document.getElementById("voiceToggle");

if(voiceToggle){
voiceToggle.addEventListener("change", function(){
voiceEnabled = this.checked;
});
}

let iosVoiceUnlocked = false;

document.addEventListener("click", function(){

if(!iosVoiceUnlocked){

const unlock = new SpeechSynthesisUtterance("");
speechSynthesis.speak(unlock);

iosVoiceUnlocked = true;

}

});
  
/* ------------------ MENU ------------------ */

if(menuBtn){
menuBtn.onclick = () => {
menu.classList.add("open");
};
}

if(closeMenu){
closeMenu.onclick = () => {
menu.classList.remove("open");
};
}

/* ------------------ BUTTON EVENTS ------------------ */

if(askBtn){
askBtn.addEventListener("click", sendQuestion);
}

if(voiceBtn){
voiceBtn.addEventListener("click", startVoice);
}

/* ------------------ SEND QUESTION ------------------ */

async function sendQuestion(){

const text = questionInput.value.trim();
if(!text) return;

chatBox.innerHTML += '<div class="user"><b>You:</b> ' + text + '</div>';
questionInput.value="";

try{

const res = await fetch("/ask",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({question:text})
});

const data = await res.json();

chatBox.innerHTML += '<div class="bot"><b>TARA:</b> ' + data.answer + '</div>';

chatBox.scrollTop = chatBox.scrollHeight;

speakResponse(data.answer);

}catch(err){

chatBox.innerHTML += '<div class="bot">Connection error</div>';

}

}

/* ------------------ VOICE INPUT ------------------ */

function startVoice(){

const SpeechRecognition =
window.SpeechRecognition || window.webkitSpeechRecognition;

if(!SpeechRecognition){
alert("Voice not supported on this device");
return;
}

const recognition = new SpeechRecognition();

recognition.start();

recognition.onresult = function(event){
questionInput.value = event.results[0][0].transcript;
};

}

/* ------------------ WAKE WORD ------------------ */

if("webkitSpeechRecognition" in window){

const wakeRec = new webkitSpeechRecognition();

wakeRec.continuous = true;

wakeRec.onresult = function(e){

const t = e.results[e.results.length - 1][0].transcript.toLowerCase();

if(t.includes("hey tara")){
alert("TARA Listening");
}

};

wakeRec.start();

}

/* ------------------ SPEAK RESPONSE ------------------ */

function speakResponse(text){

if(!voiceEnabled) return;

const speech = new SpeechSynthesisUtterance(text);

speech.rate = 1;
speech.pitch = 1;
speech.lang = "en-US";

speechSynthesis.cancel();
speechSynthesis.speak(speech);

}

/* ------------------ EMERGENCY BUTTON ------------------ */

let holdTimer;

if(emergencyBtn){

emergencyBtn.addEventListener("mousedown", startHold);
emergencyBtn.addEventListener("touchstart", startHold);

emergencyBtn.addEventListener("mouseup", cancelHold);
emergencyBtn.addEventListener("touchend", cancelHold);

}

function startHold(){

let count = 3;

emergencyBtn.innerText = count;

holdTimer = setInterval(function(){

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

emergencyBtn.innerHTML = "🚨 HOLD EMERGENCY";

}

function sendEmergency(){

navigator.geolocation.getCurrentPosition(async function(pos){

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
/* ------------------ DRIVER MINDER ------------------ */

let driverMinderActive = false;
let lastMotionTime = Date.now();

const driverMinderBtn = document.getElementById("driverMinderBtn");

if(driverMinderBtn){

driverMinderBtn.addEventListener("click", toggleDriverMinder);

}

function toggleDriverMinder(){

driverMinderActive = !driverMinderActive;

if(driverMinderActive){

driverMinderBtn.innerText = "DRIVER MINDER ON";
startMotionMonitoring();

}else{

driverMinderBtn.innerText = "DRIVER MINDER OFF";

}

}

/* MOTION SENSOR */

function startMotionMonitoring(){

if(typeof DeviceMotionEvent === "undefined"){
alert("Motion sensors not supported");
return;
}

window.addEventListener("devicemotion", function(event){

if(!driverMinderActive) return;

const x = event.accelerationIncludingGravity.x;
const y = event.accelerationIncludingGravity.y;
const z = event.accelerationIncludingGravity.z;

const impact = Math.abs(x) + Math.abs(y) + Math.abs(z);

/* IMPACT DETECTION */

if(impact > 35){

console.log("IMPACT DETECTED");

driverDownAlert();

}

lastMotionTime = Date.now();

});

}

/* DRIVER DOWN ALERT */

function driverDownAlert(){

driverMinderActive = false;

alert("DRIVER DOWN DETECTED - Sending Alert");

sendEmergency();

}
});
