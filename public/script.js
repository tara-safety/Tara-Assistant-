window.onload = () => {

const mouth = document.getElementById("mouth");
const sendBtn = document.getElementById("sendBtn");

let talking = false;

// animate mouth safely
function animate(){

if(mouth){

if(talking)
mouth.style.opacity = Math.random() > 0.5 ? "1" : "0.2";
else
mouth.style.opacity = "0";

}

requestAnimationFrame(animate);

}

animate();

async function sendMessage(){

const input = document.getElementById("question");

if(!input) return;

const text = input.value;

if(!text) return;

talking = true;

const res = await fetch("/ask",{
method:"POST",
headers:{ "Content-Type":"application/json"},
body:JSON.stringify({question:text})
});

const data = await res.json();

talking = false;

document.getElementById("chat").innerText = data.answer;

}

if(sendBtn)
sendBtn.onclick = sendMessage;

};
