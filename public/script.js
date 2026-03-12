document.addEventListener("DOMContentLoaded", function(){

console.log("TARA AI Safety System Active");

/* ---------------- ELEMENTS ---------------- */

const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const menuBtn = document.getElementById("menuBtn");
const closeMenu = document.getElementById("closeMenu");
const menu = document.getElementById("menu");

const emergencyBtn = document.getElementById("emergencyBtn");

const chatBox = document.getElementById("chatBox");
const questionInput = document.getElementById("question");

const voiceToggle = document.getElementById("voiceToggle");
const driverMinderBtn = document.getElementById("driverMinderBtn");

/* ---------------- VOICE SETTINGS ---------------- */

let voiceEnabled = true;

if(voiceToggle){
voiceToggle.addEventListener("change", function(){
voiceEnabled = this.checked;
});
}

/* Unlock speech for iOS */

let iosVoiceUnlocked = false;

document.addEventListener("click", function(){

if(!iosVoiceUnlocked){

const unlock = new SpeechSynthesisUtterance("");
speechSynthesis.speak(unlock);

iosVoiceUnlocked = true;

}

});

/* ---------------- MENU ---------------- */

if(menuBtn){
menuBtn.addEventListener("click", ()=> menu.classList.add("open"));
}

if(closeMenu){
closeMenu.addEventListener("click", ()=> menu.classList.remove("open"));
}

/* ---------------- BUTTON EVENTS ---------------- */

if(askBtn){
askBtn.addEventListener("click", sendQuestion);
}

if(voiceBtn){
voiceBtn.addEventListener("click", startVoice);
}

/* ---------------- SEND QUESTION ---------------- */

async function sendQuestion(){

const text = questionInput.value.trim();
if(!text) return;

chatBox.innerHTML += `<div class="user"><b>You:</b> ${text}</div>`;
questionInput.value="";

try{

const res = await fetch("/ask",{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({question:text})
});

const data = await res.json();

chatBox.innerHTML += `<div class="bot"><b>TARA:</b> ${data.answer}</div>`;

chatBox.scrollTop = chatBox.scrollHeight;

speakResponse(data.answer);

}catch(err){

chatBox.innerHTML += `<div class="bot">Connection error</div>`;

}

}

/* ---------------- VOICE INPUT ---------------- */

function startVoice(){

const SpeechRecognition =
window.SpeechRecognition || window.webkitSpeechRecognition;

if(!SpeechRecognition){
alert("Voice not supported");
return;
}

const recognition = new SpeechRecognition();

recognition.start();

recognition.onresult = function(event){
questionInput.value = event.results[0][0].transcript;
};

}

/* ---------------- SPEAK RESPONSE ---------------- */

function speakResponse(text){

if(!voiceEnabled) return;

const speech = new SpeechSynthesisUtterance(text);

speech.rate = 1;
speech.pitch = 1;
speech.lang = "en-US";

speechSynthesis.cancel();
speechSynthesis.speak(speech);

}

/* ---------------- EMERGENCY BUTTON ---------------- */

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

emergencyBtn.innerHTML = "🚨<br>HOLD<br>EMERGENCY";

}

/* ---------------- EMERGENCY SEND ---------------- */

function sendEmergency(){

navigator.geolocation.getCurrentPosition(async function(pos){

await fetch("/emergency",{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({
lat:pos.coords.latitude,
lon:pos.coords.longitude,
driver:"Driver"
})
});

alert("Emergency Alert Sent");

});

}

/* ---------------- DRIVER MINDER ---------------- */

let driverMinderActive = false;
let inactivityTimer;
let motionStarted = false;

let alertCountdown = null;

const INACTIVITY_LIMIT = 8 * 60 * 1000; // 8 minutes
const IMPACT_LIMIT = 35; // testing threshold

if(driverMinderBtn){
driverMinderBtn.addEventListener("click", toggleDriverMinder);
}

function toggleDriverMinder(){

driverMinderActive = !driverMinderActive;

if(driverMinderActive){

questionInput.value="";
questionInput.blur();

driverMinderBtn.innerText = "DRIVER MINDER ON";

resetInactivityTimer();

requestMotionPermission();

}else{

driverMinderBtn.innerText = "DRIVER MINDER OFF";

clearTimeout(inactivityTimer);

}

}

/* ---------------- MOTION PERMISSION ---------------- */

async function requestMotionPermission(){

if(typeof DeviceMotionEvent !== "undefined" &&
typeof DeviceMotionEvent.requestPermission === "function"){

try{

const response = await DeviceMotionEvent.requestPermission();

if(response === "granted"){
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

motionStarted = true;

window.addEventListener("devicemotion", function(event){

if(!driverMinderActive) return;

const x = event.accelerationIncludingGravity.x || 0;
const y = event.accelerationIncludingGravity.y || 0;
const z = event.accelerationIncludingGravity.z || 0;

const impact = Math.abs(x)+Math.abs(y)+Math.abs(z);

/* IMPACT DETECTED */

if(impact > IMPACT_LIMIT){

console.log("Impact detected");

startDriverDownCountdown();

}

resetInactivityTimer();

/* SHAKE CANCEL */

if(alertCountdown){

clearInterval(alertCountdown);

alertCountdown = null;

console.log("Driver confirmed OK");

}

});

}

/* ---------------- INACTIVITY ---------------- */

function resetInactivityTimer(){

clearTimeout(inactivityTimer);

inactivityTimer = setTimeout(function(){

if(driverMinderActive){

console.log("No movement detected");

startDriverDownCountdown();

}

}, INACTIVITY_LIMIT);

}

/* ---------------- DRIVER DOWN COUNTDOWN ---------------- */

function startDriverDownCountdown(){

driverMinderActive = false;

let count = 30;

alert("Driver Down Detected - Move phone to cancel");

alertCountdown = setInterval(function(){

count--;

if(count <= 0){

clearInterval(alertCountdown);

playAlarm();

sendEmergency();

}

},1000);

}

/* ---------------- ALARM ---------------- */

function playAlarm(){

const alarm = new Audio(
"https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg"
);

alarm.loop = true;

alarm.play();

}

/* ---------------- FOOTER BRANDING ---------------- */

const footer = document.createElement("div");

footer.style.textAlign="center";
footer.style.fontSize="11px";
footer.style.opacity="0.7";
footer.style.marginTop="10px";

footer.innerHTML =
"Powered by AI Intelligence • Safety Buzz Alerts • © TARA Safety Systems";

document.body.appendChild(footer);

});
