const chatBox = document.getElementById("answer");
const input = document.getElementById("question");
const button = document.getElementById("askBtn");
const avatar = document.getElementById("avatar");

function addMessage(text, type){

const msg = document.createElement("div");

msg.className = type === "user" ? "msgUser" : "msgBot";

msg.innerText = text;

chatBox.appendChild(msg);

chatBox.scrollTop = chatBox.scrollHeight;

}

function showTyping(){

const typing = document.createElement("div");

typing.className = "typing";

typing.id = "typing";

typing.innerText = "T.A.R.A. is analyzing safety data...";

chatBox.appendChild(typing);

avatar.classList.add("glow");

chatBox.scrollTop = chatBox.scrollHeight;

}

function removeTyping(){

const typing = document.getElementById("typing");

if(typing) typing.remove();

avatar.classList.remove("glow");

}

async function ask(){

const question = input.value.trim();

if(!question) return;

addMessage("You: " + question, "user");

input.value = "";

showTyping();

try{

const response = await fetch("/ask",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({ question })
});

const data = await response.json();

setTimeout(()=>{
removeTyping();
addMessage("T.A.R.A: " + data.answer, "bot");
},800);

}
catch{

setTimeout(()=>{
removeTyping();
addMessage(
"T.A.R.A: Always verify tow points and secure the vehicle.",
"bot"
);
},800);

}

}

button.addEventListener("click", ask);

input.addEventListener("keypress", function(e){
if(e.key === "Enter") ask();
});
