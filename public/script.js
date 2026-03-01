const chatBox = document.getElementById("chatBox");
const input = document.getElementById("question");
const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");


/* MENU */

const menu = document.getElementById("menu");

menuBtn.onclick = () =>
menu.classList.add("open");

closeMenu.onclick = () =>
menu.classList.remove("open");



/* CHAT */

function addUser(text){

chatBox.innerHTML +=
`<div class="user">YOU: ${text}</div>`;

chatBox.scrollTop = chatBox.scrollHeight;

}


function addBot(text){

chatBox.innerHTML +=
`<div class="bot">TARA: ${text}</div>`;

chatBox.scrollTop = chatBox.scrollHeight;

}


askBtn.onclick = send;


async function send(){

const text = input.value;

if(!text) return;

addUser(text);

input.value="";


const res = await fetch("/ask",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
question:text
})

});


const data = await res.json();

addBot(data.answer);

}



/* VOICE */

voiceBtn.onclick = () => {

const rec =
new webkitSpeechRecognition();

rec.lang="en-US";

rec.onresult =
e=>{

input.value =
e.results[0][0].transcript;

send();

};

rec.start();

};



/* WAKE WORD */

const wakeRec =
new webkitSpeechRecognition();

wakeRec.continuous=true;

wakeRec.onresult =
e=>{

const t =
e.results[e.results.length-1][0]
.transcript
.toLowerCase();

if(t.includes("hey tara")){

alert("TARA listening");

}

};

wakeRec.start();



/* EMERGENCY */

const emergencyBtn =
document.getElementById("emergencyBtn");

const progress =
document.getElementById("progressCircle");

let holdTimer;


emergencyBtn.onmousedown = startHold;
emergencyBtn.ontouchstart = startHold;

emergencyBtn.onmouseup = cancelHold;
emergencyBtn.ontouchend = cancelHold;


function startHold(){

progress.style.width="100%";

holdTimer = setTimeout(sendEmergency,3000);

}


function cancelHold(){

progress.style.width="0%";

clearTimeout(holdTimer);

}


function sendEmergency(){

navigator.geolocation.getCurrentPosition(pos=>{

const lat=pos.coords.latitude;
const lon=pos.coords.longitude;

const msg=
`Driver sent emergency alert. Location:
https://maps.google.com/?q=${lat},${lon}`;


/* TEST NUMBER */

window.location.href=
`sms:+15066887812?body=${encodeURIComponent(msg)}`;


});

}
