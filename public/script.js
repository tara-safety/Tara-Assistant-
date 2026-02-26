const chatBox = document.getElementById("answer");

// full memory for session
let memory = [];

function addMessage(sender, text) {

const msg = document.createElement("div");

msg.style.margin = "10px";
msg.style.padding = "10px";
msg.style.borderRadius = "8px";

if(sender === "user"){
msg.style.background = "#333";
msg.innerText = "You: " + text;
}else{
msg.style.background = "#ff9900";
msg.style.color = "black";
msg.innerText = "T.A.R.A.: " + text;
}

chatBox.appendChild(msg);

chatBox.scrollTop = chatBox.scrollHeight;

}

async function ask(){

const input = document.getElementById("question");

const question = input.value.trim();

if(!question) return;

addMessage("user", question);

input.value = "";

memory.push({ role:"user", content:question });

try{

const response = await fetch("/ask",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
question,
memory
})
});

const data = await response.json();

const answer = data.answer;

addMessage("tara", answer);

memory.push({ role:"assistant", content:answer });

}
catch{

const fallback =
"Safety reminder: Always verify tow points, secure vehicle, and maintain scene awareness.";

addMessage("tara", fallback);

memory.push({ role:"assistant", content:fallback });

}

}
