let audioUnlocked = false;

document.addEventListener("click", () => {

if(!audioUnlocked){

speechSynthesis.speak(
new SpeechSynthesisUtterance(" ")
);

audioUnlocked = true;

}

});
const chatBox = document.getElementById("chat");
const input = document.getElementById("question");
const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const avatar = document.getElementById("avatar");

let recognition = null;
let listening = false;
let speaking = false;

speechSynthesis.onvoiceschanged = () => {};

function addMessage(sender,text){

const msg=document.createElement("div");

msg.style.padding="10px";
msg.style.margin="8px";
msg.style.borderRadius="10px";
msg.style.maxWidth="85%";
msg.style.whiteSpace="pre-wrap";
msg.style.wordBreak="break-word";

if(sender==="user"){
msg.style.background="#1f2a44";
msg.style.marginLeft="auto";
msg.innerText="You: "+text;
}
else{

msg.style.background="#00ffc3";
msg.style.color="black";

typeText(msg,"T.A.R.A: "+text);

}

chatBox.appendChild(msg);

}

function typeText(element,text){

let i=0;

const interval=setInterval(()=>{

element.innerText=text.substring(0,i);

i++;

if(i>text.length){

clearInterval(interval);

}

},15);

}

function speak(text){

if(!audioUnlocked) return;

speechSynthesis.cancel();

const utter=new SpeechSynthesisUtterance(text);

utter.rate=1;
utter.pitch=1;
utter.volume=1;

utter.onstart=()=>{
avatar.classList.add("speaking");
avatar.classList.add("talking");
};

utter.onend=()=>{
avatar.classList.remove("speaking");
avatar.classList.remove("talking");
};

speechSynthesis.speak(utter);

}

async function ask(){

const question = input.value.trim();

if(!question) return;

addMessage("user", question);

input.value = "";

try{

const res = await fetch("/ask",{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({ question })
});

const data = await res.json();

addMessage("tara", data.answer);

speak(data.answer);

}catch{

const fallback =
"Always verify EV tow mode, use approved tow points, and secure the vehicle properly.";

addMessage("tara", fallback);

speak(fallback);

}

}

askBtn.onclick = ask;

input.addEventListener("keydown", function(e){
if(e.key === "Enter") ask();
});


/* VOICE RECOGNITION */

if("webkitSpeechRecognition" in window){

recognition = new webkitSpeechRecognition();

recognition.continuous = false;
recognition.interimResults = false;
recognition.lang = "en-US";

recognition.onresult = function(event){

const text = event.results[0][0].transcript;

input.value = text;

ask();

};

recognition.onend = function(){

listening = false;

voiceBtn.innerText = "🎤 Speak";

};

}

voiceBtn.onclick = function(){

if(!recognition) return;

if(listening){

recognition.stop();

listening = false;

voiceBtn.innerText = "🎤 Speak";

}else{

recognition.start();

listening = true;

voiceBtn.innerText = "🛑 Stop";

}

};
