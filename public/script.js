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



function startTalking(){

mouth.style.opacity="1";
mouth.classList.add("talking");

}


function stopTalking(){

mouth.style.opacity="0";
mouth.classList.remove("talking");

}



async function ask(){

const question =
input.value.trim();

if(!question) return;


addMessage("You",question);

input.value="";

thinking.style.display="block";


setTimeout(()=>{

thinking.style.display="none";

const answer =
"Safety reminder: Always use manufacturer-approved tow points.";

addMessage("T.A.R.A",answer);


const speech =
new SpeechSynthesisUtterance(answer);

speech.onstart=startTalking;
speech.onend=stopTalking;

speechSynthesis.speak(speech);

},1000);

}



askBtn.onclick=ask;



input.addEventListener("keypress",

function(e){

if(e.key==="Enter") ask();

});



voiceBtn.onclick=function(){

const rec=
new webkitSpeechRecognition();

rec.onresult=function(e){

input.value=
e.results[0][0].transcript;

ask();

};

rec.start();

};
