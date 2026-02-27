const chat = document.getElementById("chat");
const input = document.getElementById("question");
const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const avatar = document.getElementById("avatar");

let recognizing = false;
let recognition;

/* add message */
function addMessage(sender,text){

const div=document.createElement("div");

if(sender==="user"){
div.className="user";
div.innerText="You: "+text;
}
else{
div.className="tara";
div.innerText="TARA: "+text;
}

chat.appendChild(div);

chat.scrollTop=chat.scrollHeight;
}

/* avatar talk animation */
function startTalking(){
avatar.classList.add("talking");
}

function stopTalking(){
avatar.classList.remove("talking");
}

/* voice speak */
function speak(text){

if(!("speechSynthesis" in window)) return;

const utter=new SpeechSynthesisUtterance(text);

utter.rate=1;
utter.pitch=1;

utter.onstart=startTalking;
utter.onend=stopTalking;

speechSynthesis.speak(utter);
}

/* ask tara */
async function ask(){

const question=input.value.trim();

if(!question) return;

addMessage("user",question);

input.value="";

startTalking();

try{

const res=await fetch("/ask",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({question})
});

const data=await res.json();

const answer=data.answer || "No response";

addMessage("tara",answer);

speak(answer);

}
catch{

const fallback="Ensure vehicle is secure, use manufacturer tow points, and follow proper towing procedures.";

addMessage("tara",fallback);

speak(fallback);

}

stopTalking();

}

/* send button */
askBtn.onclick=ask;

/* enter key */
input.addEventListener("keydown",(e)=>{
if(e.key==="Enter") ask();
});


/* voice recognition */
if("webkitSpeechRecognition" in window){

recognition=new webkitSpeechRecognition();

recognition.continuous=false;
recognition.interimResults=false;
recognition.lang="en-US";

recognition.onresult=(e)=>{

const text=e.results[0][0].transcript;

input.value=text;

ask();

};

recognition.onend=()=>{
recognizing=false;
voiceBtn.innerText="🎤 Speak";
};

}

voiceBtn.onclick=()=>{

if(!recognition) return;

if(recognizing){

recognition.stop();
recognizing=false;
voiceBtn.innerText="🎤 Speak";

}else{

recognition.start();
recognizing=true;
voiceBtn.innerText="■ Stop";

}

};
