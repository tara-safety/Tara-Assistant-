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



/* CHAT DISPLAY */

function addUser(text){

response.innerHTML +=
"<div style='color:#4fc3f7'>YOU: "+text+"</div>";

response.scrollTop =
response.scrollHeight;

}


function addBot(text){

response.innerHTML +=
"<div>TARA: "+text+"</div>";

response.scrollTop =
response.scrollHeight;

}



/* SEND */

askBtn.onclick =
async function(){

const q =
input.value.trim();

if(!q) return;

addUser(q);

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
question:q
})

});

const data =
await res.json();

addBot(data.answer);

}
catch{

addBot("Connection error");

}

thinking.classList.add("hidden");

};



/* ENTER KEY */

input.addEventListener(
"keypress",
e=>{
if(e.key==="Enter")
askBtn.click();
}
);



/* VOICE INPUT */

let recognition;

if(
"webkitSpeechRecognition" in window ||
"SpeechRecognition" in window
){

const SpeechRecognition =
window.SpeechRecognition ||
window.webkitSpeechRecognition;

recognition =
new SpeechRecognition();

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



/* EMERGENCY BUTTON */

emergencyBtn.onclick =
function(){

if(
confirm(
"Trigger emergency call?"
)
){

window.location.href =
"tel:15066887812";

}

};
