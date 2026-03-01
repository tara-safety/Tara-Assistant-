const input =
document.getElementById("question");

const askBtn =
document.getElementById("askBtn");

const voiceBtn =
document.getElementById("voiceBtn");

const response =
document.getElementById("response");

const emergencyBtn =
document.getElementById("emergencyBtn");

const gpsText =
document.getElementById("gps");


/* CHAT */

askBtn.onclick =
async function(){

const question =
input.value;

if(!question) return;

response.innerHTML =
"Thinking...";

const res =
await fetch("/ask",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
question
})

});

const data =
await res.json();

response.innerHTML =
data.answer;

};



/* VOICE */

let recognition;

if("webkitSpeechRecognition" in window){

recognition =
new webkitSpeechRecognition();

recognition.continuous=false;

recognition.onresult =
function(e){

input.value =
e.results[0][0].transcript;

askBtn.click();

};

}


voiceBtn.onclick =
function(){

if(recognition)
recognition.start();

};



/* EMERGENCY HOLD */

let holdTimer;

emergencyBtn.onmousedown =
startHold;

emergencyBtn.ontouchstart =
startHold;

emergencyBtn.onmouseup =
cancelHold;

emergencyBtn.ontouchend =
cancelHold;


function startHold(){

holdTimer =
setTimeout(triggerEmergency,3000);

}


function cancelHold(){

clearTimeout(holdTimer);

}


function triggerEmergency(){

gpsText.innerHTML =
"Getting location...";

navigator.geolocation.getCurrentPosition(

function(pos){

const lat =
pos.coords.latitude;

const lon =
pos.coords.longitude;

gpsText.innerHTML =
lat + ", " + lon;


/* CALL YOUR TEST NUMBER */

window.location.href =
"tel:15066887812" "sms:15066887812";


},

function(){

gpsText.innerHTML =
"GPS unavailable";

}

);

}
