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

const chatBox =
document.getElementById("chatBox");



function addMessage(sender,text){

const div =
document.createElement("div");

div.innerHTML =
"<b>"+sender+":</b> "+text;

chatBox.appendChild(div);

chatBox.scrollTop =
chatBox.scrollHeight;

}

const avatar =
document.getElementById("avatar");

function startTalking(){

mouth.classList.add("talking");

avatar.classList.add("avatarTalking");

}

function stopTalking(){

mouth.classList.remove("talking");

avatar.classList.remove("avatarTalking");

}

function startTalking(){

mouth.classList.add("talking");

mouth.style.opacity = "1";

}

function stopTalking(){

mouth.classList.remove("talking");

mouth.style.opacity = "0";

}



async function ask(){

const question =
input.value.trim();

if(!question) return;


addMessage(
"You",
question
);


input.value = "";


thinking.style.display =
"block";


try{

const response =
await fetch("/ask",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
question:question
})

});


const data =
await response.json();


thinking.style.display =
"none";


addMessage(
"T.A.R.A",
data.answer
);


const speech =
new SpeechSynthesisUtterance(
data.answer
);


speech.onstart =
startTalking;


speech.onend =
stopTalking;


speechSynthesis.speak(
speech
);

}
catch{

thinking.style.display =
"none";


addMessage(
"T.A.R.A",
"Connection error."
);

}

}



askBtn.onclick = ask;



input.addEventListener(
"keypress",
function(e){

if(e.key==="Enter")
ask();

}
);



voiceBtn.onclick =
function(){

const rec =
new webkitSpeechRecognition();

rec.lang="en-US";


rec.onresult =
function(e){

input.value =
e.results[0][0].transcript;

ask();

};


rec.start();

};
