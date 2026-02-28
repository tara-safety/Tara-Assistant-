const input =
document.getElementById("question");

const askBtn =
document.getElementById("askBtn");

const voiceBtn =
document.getElementById("voiceBtn");

const mouth =
document.getElementById("mouth");

const thinking =
document.getElementById("thinking");


/* SPEAK FUNCTION */
function speak(text){

const speech =
new SpeechSynthesisUtterance(text);

speech.rate = 1;
speech.pitch = 1;

speech.onstart = ()=>{

mouth.classList.add("talking");

};

speech.onend = ()=>{

mouth.classList.remove("talking");

};

speechSynthesis.cancel();

speechSynthesis.speak(speech);

}


/* ASK SERVER */
async function ask(){

const question =
input.value.trim();

if(!question)return;

thinking.classList.add("thinkingActive");

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

thinking.classList.remove("thinkingActive");

speak(data.answer);

}
catch{

thinking.classList.remove("thinkingActive");

speak(
"Safety reminder. Always use approved tow points."
);

}

}


askBtn.onclick = ask;


/* ENTER KEY */
input.addEventListener(
"keypress",
function(e){

if(e.key==="Enter"){

e.preventDefault();

ask();

}

});


/* VOICE INPUT */
let recognition;

if(
"webkitSpeechRecognition"
in window
){

recognition =
new webkitSpeechRecognition();

recognition.continuous=false;

recognition.onresult=
function(e){

input.value =
e.results[0][0].transcript;

ask();

};

}


voiceBtn.onclick =
function(){

if(recognition){

recognition.start();

}

};
