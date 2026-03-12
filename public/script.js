document.addEventListener("DOMContentLoaded", function(){

console.log("TARA Safety AI Active");

/* ---------------- SETTINGS ---------------- */

const DRIVER_NAME = "Tow Operator";
const COMPANY = "TARA Safety";

const IMPACT_LIMIT = 35;
const INACTIVITY_LIMIT = 8 * 60 * 1000;

/* ---------------- ELEMENTS ---------------- */

const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const menuBtn = document.getElementById("menuBtn");
const closeMenu = document.getElementById("closeMenu");
const menu = document.getElementById("menu");

const emergencyBtn = document.getElementById("emergencyBtn");
const driverMinderBtn = document.getElementById("driverMinderBtn");
const towModeBtn = document.getElementById("towModeBtn");

const chatBox = document.getElementById("chatBox");
const questionInput = document.getElementById("question");
const voiceToggle = document.getElementById("voiceToggle");

/* ---------------- STATES ---------------- */

let voiceEnabled = true;
let driverMinderActive = false;
let towModeActive = false;
let wakeListening = false;

let inactivityTimer;
let countdownTimer;
let motionStarted = false;

let alarmAudio;

/* ---------------- IOS AUDIO UNLOCK ---------------- */

document.addEventListener("click", function(){

if(!alarmAudio){

alarmAudio = new Audio(
"https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg"
);

alarmAudio.loop = true;

}

});

/* ---------------- MENU ---------------- */

if(menuBtn){
menuBtn.onclick=()=>menu.classList.add("open");
}

if(closeMenu){
closeMenu.onclick=()=>menu.classList.remove("open");
}

/* ---------------- BUTTON EVENTS ---------------- */

if(askBtn) askBtn.addEventListener("click", sendQuestion);
if(voiceBtn) voiceBtn.addEventListener("click", startVoice);
if(driverMinderBtn) driverMinderBtn.addEventListener("click", toggleDriverMinder);
if(towModeBtn) towModeBtn.addEventListener("click", toggleTowMode);

/* ---------------- VOICE TOGGLE ---------------- */

if(voiceToggle){

voiceToggle.addEventListener("change", function(){
voiceEnabled=this.checked;
});

}

/* ---------------- SEND QUESTION ---------------- */

async function sendQuestion(){

const text=questionInput.value.trim();
if(!text) return;

chatBox.innerHTML+=`<div class="user"><b>You:</b> ${text}</div>`;
questionInput.value="";

try{

const res=await fetch("/ask",{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({question:text})
});

const data=await res.json();

chatBox.innerHTML+=`<div class="bot"><b>TARA:</b> ${data.answer}</div>`;

chatBox.scrollTop=chatBox.scrollHeight;

speakResponse(data.answer);

}catch(err){

chatBox.innerHTML+=`<div class="bot">Connection error</div>`;

}

}

/* ---------------- SPEAK RESPONSE ---------------- */

function speakResponse(text){

if(!voiceEnabled) return;

function speakNow(){

const speech=new SpeechSynthesisUtterance(text);

speech.lang="en-US";
speech.rate=1;
speech.pitch=1;

speechSynthesis.cancel();
speechSynthesis.speak(speech);

}

if(speechSynthesis.getVoices().length===0){

speechSynthesis.onvoiceschanged=speakNow;

}else{

speakNow();

}

}

/* ---------------- VOICE INPUT ---------------- */

function startVoice(){

const SpeechRecognition=
window.SpeechRecognition || window.webkitSpeechRecognition;

if(!SpeechRecognition){

alert("Voice not supported");
return;

}

navigator.mediaDevices.getUserMedia({audio:true})
.then(function(){

const recognition=new SpeechRecognition();

recognition.lang="en-US";

recognition.start();

recognition.onresult=function(e){

questionInput.value=e.results[0][0].transcript;

};

});

}

/* ---------------- WAKE WORD ---------------- */

function startWakeWord(){

if(wakeListening) return;

const SpeechRecognition=
window.SpeechRecognition || window.webkitSpeechRecognition;

if(!SpeechRecognition) return;

wakeListening=true;

const recognition=new SpeechRecognition();

recognition.continuous=true;
recognition.interimResults=false;

recognition.onresult=function(e){

const text=e.results[e.results.length-1][0].transcript.toLowerCase();

if(text.includes("hey tara")){

speakResponse("Yes driver");

startVoice();

}

};

recognition.start();

}

/* ---------------- TOW MODE ---------------- */

function toggleTowMode(){

towModeActive=!towModeActive;

if(towModeActive){

questionInput.value="";
questionInput.blur();

toggleDriverMinder(true);

startWakeWord();

alert("Tow Mode Activated");

}else{

toggleDriverMinder(false);

wakeListening=false;

alert("Tow Mode Disabled");

}

}

/* ---------------- DRIVER MINDER ---------------- */

function toggleDriverMinder(force){

if(force===true) driverMinderActive=true;
else if(force===false) driverMinderActive=false;
else driverMinderActive=!driverMinderActive;

if(driverMinderActive){

driverMinderBtn.innerText="DRIVER MINDER ON";

resetInactivityTimer();

requestMotionPermission();

}else{

driverMinderBtn.innerText="DRIVER MINDER OFF";

clearTimeout(inactivityTimer);

}

}

/* ---------------- MOTION PERMISSION ---------------- */

async function requestMotionPermission(){

if(typeof DeviceMotionEvent !== "undefined" &&
typeof DeviceMotionEvent.requestPermission==="function"){

const response=await DeviceMotionEvent.requestPermission();

if(response==="granted"){

startMotionMonitoring();

}

}else{

startMotionMonitoring();

}

}

/* ---------------- MOTION MONITOR ---------------- */

function startMotionMonitoring(){

if(motionStarted) return;

motionStarted=true;

window.addEventListener("devicemotion", function(event){

if(!driverMinderActive) return;

const x=event.accelerationIncludingGravity.x||0;
const y=event.accelerationIncludingGravity.y||0;
const z=event.accelerationIncludingGravity.z||0;

const impact=Math.abs(x)+Math.abs(y)+Math.abs(z);

if(impact>IMPACT_LIMIT){

startEmergencyCountdown();

}

resetInactivityTimer();

});

}

/* ---------------- INACTIVITY TIMER ---------------- */

function resetInactivityTimer(){

clearTimeout(inactivityTimer);

inactivityTimer=setTimeout(function(){

if(driverMinderActive){

startEmergencyCountdown();

}

},INACTIVITY_LIMIT);

}

/* ---------------- EMERGENCY COUNTDOWN ---------------- */

function startEmergencyCountdown(){

driverMinderActive=false;

let count=30;

playAlarm();

const cancelBtn=document.createElement("button");

cancelBtn.innerText="Cancel Emergency";

cancelBtn.style.position="fixed";
cancelBtn.style.bottom="120px";
cancelBtn.style.left="50%";
cancelBtn.style.transform="translateX(-50%)";
cancelBtn.style.zIndex="9999";

document.body.appendChild(cancelBtn);

cancelBtn.onclick=function(){

clearInterval(countdownTimer);

stopAlarm();

cancelBtn.remove();

alert("Emergency Cancelled");

};

countdownTimer=setInterval(function(){

count--;

if(count<=0){

clearInterval(countdownTimer);

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

}catch(err){

alert("Emergency Send Failed");

}

}

/* ---------------- FOOTER ---------------- */

const footer=document.createElement("div");

footer.style.textAlign="center";
footer.style.fontSize="11px";
footer.style.opacity="0.7";
footer.style.marginTop="8px";

footer.innerHTML="Powered by AI Intelligence • Safety Buzz Alerts • © TARA Safety Systems";

document.body.appendChild(footer);

});
