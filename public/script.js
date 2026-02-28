window.onload = () => {

const mouth = document.getElementById("mouth");
const sendBtn = document.getElementById("sendBtn");

let talking = false;

// animate mouth safely
const mouth = document.getElementById("mouth");

function speak(text) {

  const speech = new SpeechSynthesisUtterance(text);

  speech.onstart = () => {
    mouth.classList.add("talking");
  };

  speech.onend = () => {
    mouth.classList.remove("talking");
  };

  speechSynthesis.speak(speech);
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

sendBtn.onclick = async () => {

  const question = input.value;

  const res = await fetch("/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ question })
  });

  const data = await res.json();

  responseBox.innerText = data.answer;

  speak(data.answer);
};

