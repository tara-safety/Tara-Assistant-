const input =
document.getElementById("question");

const askBtn =
document.getElementById("askBtn");

const voiceBtn =
document.getElementById("voiceBtn");

const response =
document.getElementById("response");

const thinking =
document.getElementById("thinking");

const emergencyBtn =
document.getElementById("emergencyBtn");

const gps =
document.getElementById("gps");



/* CHAT */

askBtn.onclick =
async function(){

const question =
input.value.trim();

if(!question) return;

thinking.classList.remove("hidden");

response.innerHTML="";

try{

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

}
catch{

response.innerHTML =
"Server connection error";

}

thinking.classList.add("hidden");

};



/* ENTER KEY */

input.addEventListener(
"keypress",
function(e){

if(e.key==="Enter")
askBtn.click();

}
);



/* VOICE */

let recognition;

if("webkitSpeechRecognition" in window){

recognition =
new webkitSpeechRecognition();

recognition.lang="en-US";

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

function startHold(){

gps.innerHTML="Hold...";

holdTimer =
setTimeout(triggerEmergency,2000);

}

function cancelHold(){

clearTimeout(holdTimer);

gps.innerHTML="";

}


emergencyBtn.addEventListener(
"mousedown",
startHold);

emergencyBtn.addEventListener(
"mouseup",
cancelHold);

emergencyBtn.addEventListener(
"touchstart",
startHold);

emergencyBtn.addEventListener(
"touchend",
cancelHold);



function triggerEmergency(){

gps.innerHTML=
"Getting GPS...";

navigator.geolocation.getCurrentPosition(

function(pos){

const lat=
pos.coords.latitude.toFixed(5);

const lon=
pos.coords.longitude.toFixed(5);

gps.innerHTML=
"GPS: "+lat+", "+lon;


/* CHANGE NUMBER HERE */

window.location.href =
"tel:15066887812";

},

function(){

gps.innerHTML=
"GPS failed";

}

);

}
