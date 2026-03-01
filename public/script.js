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

const menuBtn =
document.getElementById("menuBtn");

const menuOverlay =
document.getElementById("menuOverlay");

const closeMenu =
document.getElementById("closeMenu");

/* CHAT DISPLAY */

function addUser(text){

response.innerHTML +=
`
<div style="
margin-top:15px;
color:#4fc3f7;
font-weight:bold;
">
YOU:
</div>

<div style="
margin-bottom:10px;
">
${text}
</div>
`;

response.scrollTop =
response.scrollHeight;

}



function addBot(text){

response.innerHTML +=
`
<div style="
margin-top:15px;
color:#00ff9c;
font-weight:bold;
">
TARA:
</div>

<div style="
margin-bottom:15px;
line-height:1.4;
">
${text}
</div>
`;

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

const emergencyBtn =
document.getElementById("emergencyBtn");

emergencyBtn.addEventListener("click", function(e){

e.preventDefault();

window.location.href =
"tel:15061234567"; // your number

});

menuBtn.onclick =
function(){

menuOverlay.classList.remove("hidden");

};


closeMenu.onclick =
function(){

menuOverlay.classList.add("hidden");

};
