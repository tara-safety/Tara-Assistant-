document.addEventListener("DOMContentLoaded", function(){

console.log("TARA Safety System Online");

/* ---------------- SETTINGS ---------------- */

const DRIVER_NAME = "Tow Operator";
const COMPANY = "TARA Safety";

const IMPACT_LIMIT = 35;
const INACTIVITY_LIMIT = 8 * 60 * 1000;

/* ---------------- ELEMENTS ---------------- */

const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const emergencyBtn = document.getElementById("emergencyBtn");
const driverMinderBtn = document.getElementById("driverMinderBtn");
const towModeBtn = document.getElementById("towModeBtn");

const questionInput = document.getElementById("question");
const chatBox = document.getElementById("chatBox");
const voiceToggle = document.getElementById("voiceToggle");

/* ---------------- STATES ---------------- */

let voiceEnabled = true;
let driverMinderActive = false;
let towModeActive = false;

let inactivityTimer;
let motionStarted = false;

let alarmAudio;
let holdTimer;

/* ---------------- AUDIO UNLOCK ---------------- */

document.addEventListener("click", function(){

if(!alarmAudio){

alarmAudio = new Audio(
"https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg"
);

alarmAudio.loop = true;

}

});

/* ---------------- VOICE TOGGLE ---------------- */

if(voiceToggle){

voiceToggle.addEventListener("change",function(){
voiceEnabled = this.checked;
});

}

/* ---------------- ASK BUTTON ---------------- */

if(askBtn){
askBtn.addEventListener("click",sendQuestion);
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

speakResponse(data.answer);

}catch{

chatBox.innerHTML += `<div>Connection error</div>`;

}

}

/* ---------------- SPEECH OUTPUT ---------------- */

function speakResponse(text){

if(!voiceEnabled) return;

const speech = new SpeechSynthesisUtterance(text);

speech.lang="en-US";
speech.rate=1;

speechSynthesis.cancel();
speechSynthesis.speak(speech);

}

/* ---------------- VOICE INPUT ---------------- */

if(voiceBtn){
voiceBtn.addEventListener("click",startVoice);
}

function startVoice(){

const SpeechRecognition =
window.SpeechRecognition || window.webkitSpeechRecognition;

if(!SpeechRecognition){

alert("Voice not supported");

return;

}

navigator.mediaDevices.getUserMedia({audio:true})
.then(function(){

const recognition = new SpeechRecognition();

recognition.lang="en-US";

recognition.start();

recognition.onresult=function(e){

questionInput.value = e.results[0][0].transcript;

};

});

}

/* ---------------- WAKE WORD ---------------- */

function startWakeWord(){

const SpeechRecognition =
window.SpeechRecognition || window.webkitSpeechRecognition;

if(!SpeechRecognition) return;

const recognition = new SpeechRecognition();

recognition.continuous=true;

recognition.onresult=function(e){

const text =
e.results[e.results.length-1][0].transcript.toLowerCase();

if(text.includes("hey tara")){

speakResponse("Yes driver");

startVoice();

}

};

recognition.start();

}

/* ---------------- TOW MODE ---------------- */

if(towModeBtn){

towModeBtn.addEventListener("click",function(){

towModeActive = !towModeActive;

if(towModeActive){

startWakeWord();
toggleDriverMinder(true);

alert("Tow Mode Activated");

}else{

toggleDriverMinder(false);

alert("Tow Mode Disabled");

}

});

}

/* ---------------- DRIVER MINDER ---------------- */

if(driverMinderBtn){

driverMinderBtn.addEventListener("click",function(){
toggleDriverMinder();
});

}

function toggleDriverMinder(force){

if(force===true) driverMinderActive=true;
else if(force===false) driverMinderActive=false;
else driverMinderActive=!driverMinderActive;

if(driverMinderActive){

resetInactivityTimer();
startMotionMonitoring();

driverMinderBtn.innerText="DRIVER MINDER ON";

}else{

clearTimeout(inactivityTimer);

driverMinderBtn.innerText="DRIVER MINDER OFF";

}

}

/* ---------------- MOTION ---------------- */

function startMotionMonitoring(){

if(motionStarted) return;

motionStarted=true;

window.addEventListener("devicemotion",function(e){

if(!driverMinderActive) return;

const x=e.accelerationIncludingGravity.x||0;
const y=e.accelerationIncludingGravity.y||0;
const z=e.accelerationIncludingGravity.z||0;

const impact=Math.abs(x)+Math.abs(y)+Math.abs(z);

if(impact>IMPACT_LIMIT){

startEmergencyCountdown();

}

resetInactivityTimer();

});

}

/* ---------------- INACTIVITY ---------------- */

function resetInactivityTimer(){

clearTimeout(inactivityTimer);

inactivityTimer=setTimeout(function(){

if(driverMinderActive){

startEmergencyCountdown();

}

},INACTIVITY_LIMIT);

}

/* ---------------- COUNTDOWN ---------------- */

function startEmergencyCountdown(){

let count=30;

playAlarm();

const cancelBtn=document.createElement("button");

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

alert("Emergency Cancelled");

};

const timer=setInterval(function(){

count--;

if(count<=0){

clearInterval(timer);
cancelBtn.remove();

triggerEmergency();

}

},1000);

}

/* ---------------- EMERGENCY HOLD BUTTON ---------------- */

if(emergencyBtn){

emergencyBtn.addEventListener("mousedown",startHold);
emergencyBtn.addEventListener("touchstart",startHold);

emergencyBtn.addEventListener("mouseup",cancelHold);
emergencyBtn.addEventListener("touchend",cancelHold);

}

function startHold(){

let count=3;

emergencyBtn.innerText=count;

holdTimer=setInterval(function(){

count--;

if(count<=0){

clearInterval(holdTimer);

triggerEmergency();

}else{

emergencyBtn.innerText=count;

}

},1000);

}

function cancelHold(){

clearInterval(holdTimer);

emergencyBtn.innerHTML="🚨<br>HOLD<br>EMERGENCY";

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
alarmAudio.currentTime=0;

}

}

/* ---------------- SEND EMERGENCY ---------------- */

function triggerEmergency(){

stopAlarm();

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

alert("Emergency Alert Sent");

}catch{

alert("Emergency Send Failed");

}

}

/* ---------------- FOOTER ---------------- */

const footer=document.createElement("div");

footer.style.textAlign="center";
footer.style.fontSize="11px";
footer.style.opacity="0.7";
footer.style.marginTop="10px";

footer.innerHTML="Powered by AI Intelligence • Safety Buzz Alerts • © TARA Safety Systems";

document.body.appendChild(footer);

});
