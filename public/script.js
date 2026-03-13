document.addEventListener("DOMContentLoaded", function(){

console.log("TARA System Booting");

/* ---------------- SETTINGS ---------------- */

const DRIVER_NAME = "Tow Operator";
const COMPANY = "TARA Safety";

const IMPACT_LIMIT = 30;
const INACTIVITY_LIMIT = 8 * 60 * 1000;

/* ---------------- STATE ---------------- */

let voiceEnabled = true;
let driverMinderActive = false;
let towModeActive = false;
let motionStarted = false;
let emergencyActive = false;
  
let inactivityTimer = null;
let holdTimer = null;
let alarmAudio = null;
let systemUnlocked = false;

/* ---------------- ELEMENTS ---------------- */

const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const emergencyBtn = document.getElementById("emergencyBtn");
const driverMinderBtn = document.getElementById("driverMinderBtn");
const towModeBtn = document.getElementById("towModeBtn");
const towCameraBtn = document.getElementById("towCameraBtn");

const menuBtn = document.getElementById("menuBtn");
const menu = document.querySelector(".menu");

const questionInput = document.getElementById("question");
const chatBox = document.getElementById("chatBox");

/* ---------------- MENU ---------------- */

if(menuBtn && menu){

menuBtn.addEventListener("click", function(){
menu.classList.toggle("open");
});

}

/* ---------------- PERMISSION UNLOCK ---------------- */

document.addEventListener("click", async function(){

if(systemUnlocked) return;
systemUnlocked = true;

console.log("Unlocking permissions");

const speech = new SpeechSynthesisUtterance("");
speechSynthesis.speak(speech);

try{
await navigator.mediaDevices.getUserMedia({audio:true});
}catch(e){}

if(typeof DeviceMotionEvent !== "undefined" &&
typeof DeviceMotionEvent.requestPermission === "function"){

try{
await DeviceMotionEvent.requestPermission();
}catch(e){}

}

alarmAudio = new Audio(
"https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg"
);

alarmAudio.loop = true;

});

/* ---------------- ASK TARA ---------------- */

if(askBtn){
askBtn.addEventListener("click", sendQuestion);
}

async function sendQuestion(){

const text = questionInput.value.trim();
if(!text) return;

chatBox.innerHTML += `<div><b>You:</b> ${text}</div>`;
questionInput.value="";

try{

const res = await fetch("/ask",{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({question:text})
});

const data = await res.json();

chatBox.innerHTML += `<div><b>TARA:</b> ${data.answer}</div>`;

speak(data.answer);

}catch{

chatBox.innerHTML += `<div>Connection error</div>`;

}

}

/* ---------------- SPEECH ---------------- */

function speak(text){

if(!voiceEnabled) return;

const speech = new SpeechSynthesisUtterance(text);

speech.lang="en-US";

speechSynthesis.cancel();
speechSynthesis.speak(speech);

}

/* ---------------- VOICE INPUT ---------------- */

if(voiceBtn){
voiceBtn.addEventListener("click", startVoice);
}

function startVoice(){

const SpeechRecognition =
window.SpeechRecognition || window.webkitSpeechRecognition;

if(!SpeechRecognition){
alert("Voice not supported");
return;
}

const recognition = new SpeechRecognition();
recognition.lang="en-US";

recognition.start();

recognition.onresult=function(e){

const speech = e.results[0][0].transcript;

questionInput.value = speech;

sendQuestion();

};

}

/* ---------------- WAKE WORD ---------------- */

function startWakeWord(){

const SpeechRecognition =
window.SpeechRecognition || window.webkitSpeechRecognition;

if(!SpeechRecognition) return;

const recognition = new SpeechRecognition();

recognition.continuous = true;

recognition.onresult=function(e){

const text =
e.results[e.results.length-1][0].transcript.toLowerCase();

if(text.includes("hey tara")){

speak("Yes driver");

startVoice();

}

};

recognition.start();

}

/* ---------------- TOW MODE ---------------- */

if(towModeBtn){

towModeBtn.addEventListener("click", function(){

towModeActive = !towModeActive;

if(towModeActive){

startWakeWord();
chatBox.innerHTML += "<div>🚚 Tow Mode Activated</div>";

}else{

chatBox.innerHTML += "<div>🚚 Tow Mode Disabled</div>";

}

});

}

/* ---------------- TOW CAMERA ---------------- */

if(towCameraBtn){

towCameraBtn.addEventListener("click", openCamera);

}

function openCamera(){

const input = document.createElement("input");

input.type="file";
input.accept="image/*";
input.capture="environment";

input.onchange = async function(){

const file = input.files[0];
if(!file) return;

const form = new FormData();
form.append("image",file);

chatBox.innerHTML += "<div>📷 Analyzing tow situation...</div>";

try{

const res = await fetch("/tow-ai",{
method:"POST",
body:form
});

const data = await res.json();

chatBox.innerHTML += `<div><b>Tow AI:</b> ${data.advice}</div>`;

speak(data.advice);

}catch{

chatBox.innerHTML += "<div>Image analysis failed</div>";

}

};

input.click();

}

/* ---------------- DRIVER MINDER ---------------- */

if(driverMinderBtn){

driverMinderBtn.addEventListener("click", function(){

driverMinderActive = !driverMinderActive;

if(driverMinderActive){

driverMinderBtn.innerText = "Driver Minder ON";

chatBox.innerHTML += "<div>🟢 Driver Minder Activated</div>";

requestMotionPermission();   // <-- ADD THIS LINE

resetInactivityTimer();
startMotionMonitoring();

}else{

driverMinderBtn.innerText = "Driver Minder OFF";

chatBox.innerHTML += "<div>⚪ Driver Minder Disabled</div>";

clearTimeout(inactivityTimer);

}

});

}

/* ---------------- MOTION PERMISSION (iOS) ---------------- */

async function requestMotionPermission(){

if(typeof DeviceMotionEvent !== "undefined" &&
typeof DeviceMotionEvent.requestPermission === "function"){

try{

const response = await DeviceMotionEvent.requestPermission();

console.log("Motion permission:", response);

if(response !== "granted"){

alert("Motion permission is required for Driver Minder");

}

}catch(err){

console.log("Motion permission error:", err);

}

}

}
/* ---------------- MOTION ---------------- */

function startMotionMonitoring(){

if(motionStarted) return;

motionStarted = true;

window.addEventListener("devicemotion", function(e){

if(!driverMinderActive) return;

const acc = e.accelerationIncludingGravity;

if(!acc) return;

const impact =
Math.abs(acc.x||0)+
Math.abs(acc.y||0)+
Math.abs(acc.z||0);

if(impact > IMPACT_LIMIT){

startEmergencyCountdown();

}

resetInactivityTimer();

});

}

/* ---------------- INACTIVITY ---------------- */

function resetInactivityTimer(){

clearTimeout(inactivityTimer);

inactivityTimer = setTimeout(function(){

if(driverMinderActive){
startEmergencyCountdown();
}

}, INACTIVITY_LIMIT);

}

/* ---------------- EMERGENCY BUTTON ---------------- */

if(emergencyBtn){

emergencyBtn.addEventListener("mousedown", startHold);
emergencyBtn.addEventListener("touchstart", startHold);

emergencyBtn.addEventListener("mouseup", cancelHold);
emergencyBtn.addEventListener("touchend", cancelHold);

}

function startHold(){

let count = 3;

holdTimer = setInterval(function(){

count--;

if(count <= 0){

clearInterval(holdTimer);

triggerEmergency();

}

},1000);

}

function cancelHold(){

clearInterval(holdTimer);

}

/* ---------------- EMERGENCY ---------------- */

function startEmergencyCountdown(){

let count = 30;

playAlarm();

const cancelBtn = document.createElement("button");

cancelBtn.innerText="Cancel Emergency";

cancelBtn.style.position="fixed";
cancelBtn.style.bottom="120px";
cancelBtn.style.left="50%";
cancelBtn.style.transform="translateX(-50%)";

document.body.appendChild(cancelBtn);

cancelBtn.onclick=function(){

clearInterval(timer);
stopAlarm();
cancelBtn.remove();

};

const timer = setInterval(function(){

count--;

if(count<=0){

clearInterval(timer);
cancelBtn.remove();

triggerEmergency();

}

},1000);

}

/* ---------------- ALARM ---------------- */

function playAlarm(){

if(alarmAudio){
alarmAudio.play().catch(()=>{});
}

}

function stopAlarm(){

if(alarmAudio){

alarmAudio.pause();
alarmAudio.currentTime = 0;

}

}

/* ---------------- SEND EMERGENCY ---------------- */

function triggerEmergency(){

if(emergencyActive) return;

emergencyActive = true;

navigator.geolocation.getCurrentPosition(function(pos){

sendEmergency(pos.coords.latitude,pos.coords.longitude);

});

}

async function sendEmergency(lat,lon){

try{

await fetch("/emergency",{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({

driver:DRIVER_NAME,
company:COMPANY,
time:new Date().toISOString(),
lat:lat,
lon:lon

})
});

chatBox.innerHTML += "<div>🚨 Emergency Alert Sent</div>";

alert("Emergency Alert Sent");

setTimeout(()=>{
emergencyActive=false;
},20000);

}catch{

chatBox.innerHTML += "<div>⚠️ Emergency Send Failed</div>";

alert("Emergency Send Failed");

emergencyActive=false;

}

}

/* ---------------- FOOTER ---------------- */

const footer=document.createElement("div");

footer.style.textAlign="center";
footer.style.fontSize="11px";
footer.style.opacity="0.6";
footer.style.marginTop="10px";

footer.innerHTML="Powered by AI Intelligence • Safety Buzz Alerts • © TARA Safety";

document.body.appendChild(footer);

});
