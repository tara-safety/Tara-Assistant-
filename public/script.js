// EXISTING elements
const input = document.getElementById("question");
const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const response = document.getElementById("response");
const thinking = document.getElementById("thinking");


// ADD THESE (menu elements)
const menuBtn = document.getElementById("menuBtn");
const closeMenu = document.getElementById("closeMenu");
const menuOverlay = document.getElementById("menuOverlay");


// MENU FUNCTIONS
menuBtn.onclick = function(){
menuOverlay.classList.remove("hidden");
};

closeMenu.onclick = function(){
menuOverlay.classList.add("hidden");
};
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



/* ADD MESSAGE TO CHAT */

function addUserMessage(text){

response.innerHTML +=
"<div class='user'>YOU: "+text+"</div>";

response.scrollTop =
response.scrollHeight;

}


function addBotMessage(text){

response.innerHTML +=
"<div class='bot'>TARA: "+text+"</div>";

response.scrollTop =
response.scrollHeight;

}



/* SEND */

askBtn.onclick =
async function(){

const question =
input.value.trim();

if(!question) return;


addUserMessage(question);

input.value="";


thinking.classList.remove("hidden");


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


addBotMessage(data.answer);


}
catch{

addBotMessage(
"Server error"
);

}


thinking.classList.add("hidden");

};



/* ENTER */

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

gps.innerHTML=
"Hold...";

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
lat+", "+lon;


/* CHANGE THIS NUMBER */

window.location.href =
"tel:15066887812";

},

function(){

gps.innerHTML=
"GPS failed";

}

);

}
