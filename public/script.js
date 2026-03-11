:::writing{variant=“standard” id=“tara_clean_script”}
document.addEventListener(“DOMContentLoaded”, function(){

console.log(“TARA controls active”);

/* ELEMENTS */

const askBtn = document.getElementById(“askBtn”);
const voiceBtn = document.getElementById(“voiceBtn”);
const menuBtn = document.getElementById(“menuBtn”);
const closeMenu = document.getElementById(“closeMenu”);
const menu = document.getElementById(“menu”);
const emergencyBtn = document.getElementById(“emergencyBtn”);
const chatBox = document.getElementById(“chatBox”);
const questionInput = document.getElementById(“question”);

/* –––––––– MENU –––––––– */

menuBtn.onclick = () => {

menu.style.left = “0”;

};

closeMenu.onclick = () => {

menu.style.left = “-260px”;

};

/* –––––––– SEND BUTTON –––––––– */

askBtn.onclick = () => {

const text = questionInput.value.trim();

if(!text) return;

chatBox.innerHTML += <div><b>You:</b> ${text}</div>;

questionInput.value = “”;

};

/* –––––––– TALK BUTTON –––––––– */

voiceBtn.onclick = () => {

const SpeechRecognition =
window.SpeechRecognition || window.webkitSpeechRecognition;

if(!SpeechRecognition){
alert(“Voice not supported on this device”);
return;
}

const recognition = new SpeechRecognition();

recognition.start();

recognition.onresult = function(event){

questionInput.value = event.results[0][0].transcript;

};

};

/* –––––––– EMERGENCY BUTTON –––––––– */

let holdTimer;

emergencyBtn.addEventListener(“mousedown”, startHold);
emergencyBtn.addEventListener(“touchstart”, startHold);

emergencyBtn.addEventListener(“mouseup”, cancelHold);
emergencyBtn.addEventListener(“touchend”, cancelHold);

function startHold(){

emergencyBtn.innerText = “3”;

let count = 3;

holdTimer = setInterval(()=>{

count–;

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

emergencyBtn.innerHTML = “🚨HOLDEMERGENCY”;

}

function sendEmergency(){

navigator.geolocation.getCurrentPosition(async pos => {

await fetch(”/emergency”,{
method:“POST”,
headers:{
“Content-Type”:“application/json”
},
body:JSON.stringify({
lat: pos.coords.latitude,
lon: pos.coords.longitude,
driver:“Driver”
})
});

alert(“Emergency Alert Sent”);

});

}

});
:::
