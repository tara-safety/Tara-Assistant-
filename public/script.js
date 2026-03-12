document.addEventListener("DOMContentLoaded", function(){

console.log("TARA Safety System Active");

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

/* ---------------- SETTINGS ---------------- */

const DRIVER_NAME = "Tow Operator";
const COMPANY = "TARA Safety";
const IMPACT_LIMIT = 35;
const INACTIVITY_LIMIT = 8 * 60 * 1000;

let voiceEnabled = true;
let driverMinderActive = false;
let towModeActive = false;

let inactivityTimer;
let countdownTimer;
let motionStarted = false;

/* ---------------- IOS SHAKE FIX ---------------- */

window.addEventListener("shake", function(e){
e.preventDefault();
});

/* ---------------- VOICE ---------------- */

if(voiceToggle){
voiceToggle.addEventListener("change", function(){
voiceEnabled = this.checked;
});
}

let iosVoiceUnlocked=false;

document.addEventListener("click",function(){

if(!iosVoiceUnlocked){

const unlock=new SpeechSynthesisUtterance("");
speechSynthesis.speak(unlock);

iosVoiceUnlocked=true;

}

});

/* ---------------- MENU ---------------- */

if(menuBtn){
menuBtn.onclick=()=>menu.classList.add("open");
}

if(closeMenu){
closeMenu.onclick=()=>menu.classList.remove("open");
}

/* ---------------- BUTTONS ---------------- */

if(askBtn){
askBtn.addEventListener("click",sendQuestion);
}

if(voiceBtn){
voiceBtn.addEventListener("click",startVoice);
}

if(driverMinderBtn){
driverMinderBtn.addEventListener("click",toggleDriverMinder);
}

if(towModeBtn){
towModeBtn.addEventListener("click",toggleTowMode);
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
headers:{"Content-Type":"application/json"},
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

/* ---------------- VOICE INPUT ---------------- */

function startVoice(){

const SpeechRecognition=
window.SpeechRecognition||window.webkitSpeechRecognition;

if(!SpeechRecognition){
alert("Voice not supported");
return;
}

const recognition=new SpeechRecognition();

recognition.start();

recognition.onresult=function(e){
questionInput.value=e.results[0][0].transcript;
};

}

/* ---------------- SPEAK ---------------- */

function speakResponse(text){

if(!voiceEnabled) return;

const speech=new SpeechSynthesisUtterance(text);

speech.rate=1;
speech.pitch=1;

speechSynthesis.cancel();
speechSynthesis.speak(speech);

}

/* ---------------- EMERGENCY BUTTON ---------------- */

let holdTimer;

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

if(count>0){

emergencyBtn.innerText=count;

}else{

clearInterval(holdTimer);
triggerEmergency();

}

},1000);

}

function cancelHold(){

clearInterval(holdTimer);

emergencyBtn.innerHTML="🚨<br>HOLD<br>EMERGENCY";

}

/* ---------------- TOW MODE ---------------- */

function toggleTowMode(){

towModeActive=!towModeActive;

if(towModeActive){

questionInput.blur();
questionInput.value="";

toggleDriverMinder(true);

alert("Tow Mode Activated");

}else{

toggleDriverMinder(false);

alert("Tow Mode Disabled");

}

}

/* ---------------- DRIVER MINDER ---------------- */

function toggleDriverMinder(force){

if(force===true) driverMinderActive=true;
else if(force===false) driverMinderActive=false;
else driverMinderActive=!driverMinderActive;

if(driverMinderActive){

questionInput.blur();
questionInput.value="";

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

if(typeof DeviceMotionEvent!=="undefined" &&
typeof DeviceMotionEvent.requestPermission==="function"){

try{

const response=await DeviceMotionEvent.requestPermission();

if(response==="granted"){
startMotionMonitoring();
}

}catch(err){
alert("Motion permission error");
}

}else{

startMotionMonitoring();

}

}

/* ---------------- MOTION MONITOR ---------------- */

function startMotionMonitoring(){

if(motionStarted) return;

motionStarted=true;

window.addEventListener("devicemotion",function(event){

if(!driverMinderActive) return;

const x=event.accelerationIncludingGravity.x||0;
const y=event.accelerationIncludingGravity.y||0;
const z=event.accelerationIncludingGravity.z||0;

const impact=Math.abs(x)+Math.abs(y)+Math.abs(z);

/* IMPACT */

if(impact>IMPACT_LIMIT){

console.log("Impact detected");

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

console.log("No movement detected");

startEmergencyCountdown();

}

},INACTIVITY_LIMIT);

}

/* ---------------- COUNTDOWN ---------------- */

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
cancelBtn.remove();

stopAlarm();

alert("Emergency Cancelled");

};

countdownTimer=setInterval(function(){

count--;

console.log("Emergency in",count);

if(count<=0){

clearInterval(countdownTimer);
cancelBtn.remove();

triggerEmergency();

}

},1000);

}

/* ---------------- ALARM ---------------- */

let alarm;

function playAlarm(){

alarm=new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");
alarm.loop=true;
alarm.play();

}

function stopAlarm(){

if(alarm){
alarm.pause();
alarm=null;
}

}

/* ---------------- SEND EMERGENCY ---------------- */

function triggerEmergency(){

stopAlarm();

navigator.geolocation.getCurrentPosition(async function(pos){

await fetch("/emergency",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({

driver:DRIVER_NAME,
company:COMPANY,
time:new Date().toISOString(),

lat:pos.coords.latitude,
lon:pos.coords.longitude

})
});

alert("Emergency Alert Sent");

});

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
