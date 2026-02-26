const chatBox = document.getElementById("answer");
const input = document.getElementById("question");
const button = document.getElementById("askBtn");

let memory = [];

function addMessage(sender, text){

const msg = document.createElement("div");

msg.style.margin = "10px";
msg.style.padding = "10px";
msg.style.borderRadius = "8px";

if(sender === "user"){
msg.style.background = "#333";
msg.style.color = "white";
msg.innerText = "You: " + text;
}else{
msg.style.background = "orange";
msg.style.color = "black";
msg.innerText = "T.A.R.A.: " + text;
}

chatBox.appendChild(msg);

}

async function ask(){

const question = input.value.trim();

if(!question) return;

addMessage("user", question);

input.value = "";

try{

const response = await fetch("/ask",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({ question })
});

const data = await response.json();

addMessage("tara", data.answer);

}
catch{

addMessage(
"tara",
"Safety reminder: Always verify tow points and secure the vehicle properly."
);

}

}

button.addEventListener("click", ask);

input.addEventListener("keypress", function(e){

if(e.key === "Enter"){
ask();
}

});
