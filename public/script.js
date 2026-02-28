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

let recognizing = false;
let recognition;



/* ---------- CHAT DISPLAY ---------- */

function addMessage(sender, text)
{

const msg =
document.createElement("div");

msg.style.marginBottom = "10px";


if(sender === "user")
{
msg.innerHTML =
"<b>You:</b> " + text;
msg.style.color = "#4fc3f7";
}
else
{
msg.innerHTML =
"<b>T.A.R.A:</b> " + text;
msg.style.color = "#00ffaa";
}


chatBox.appendChild(msg);

chatBox.scrollTop =
chatBox.scrollHeight;

}



/* ---------- MOUTH ANIMATION ---------- */

function mouthTalk()
{

mouth.style.opacity = "1";

mouth.style.animation =
"talk 0.18s infinite";

}

function mouthStop()
{

mouth.style.animation = "none";

mouth.style.opacity = "0.3";

}



/* ---------- THINKING ---------- */

function showThinking()
{

thinking.style.display = "block";

}

function hideThinking()
{

thinking.style.display = "none";

}



/* ---------- TEXT TO SPEECH ---------- */

function speak(text)
{

if(!window.speechSynthesis)
return;


const speech =
new SpeechSynthesisUtterance(text);


speech.rate = 1;

speech.pitch = 1;


speech.onstart =
mouthTalk;

speech.onend =
mouthStop;


speechSynthesis.speak(speech);

}



/* ---------- ASK SERVER ---------- */

async function ask()
{

const question =
input.value.trim();

if(!question)
return;


addMessage("user", question);

input.value = "";


showThinking();


try
{

const response =
await fetch("/ask",
{
method:"POST",
headers:
{
"Content-Type":"application/json"
},
body:
JSON.stringify({question})
});


const data =
await response.json();


hideThinking();


addMessage("tara", data.answer);


speak(data.answer);

}
catch
{

hideThinking();

addMessage(
"tara",
"Connection error."
);

}

}



/* ---------- BUTTON ---------- */

askBtn.onclick =
ask;



/* ---------- ENTER KEY ---------- */

input.addEventListener(
"keydown",
function(e)
{
if(e.key === "Enter"
&& !e.shiftKey)
{
e.preventDefault();
ask();
}
}
);



/* ---------- VOICE INPUT ---------- */

if(
"webkitSpeechRecognition"
in window
)
{

recognition =
new webkitSpeechRecognition();

recognition.continuous = false;

recognition.interimResults = false;

recognition.lang = "en-US";


voiceBtn.onclick =
function()
{

if(recognizing)
{
recognition.stop();
recognizing = false;
voiceBtn.innerText =
"🎤 Speak";
return;
}


recognition.start();

recognizing = true;

voiceBtn.innerText =
"■ Stop";

};



recognition.onresult =
function(event)
{

const text =
event.results[0][0].transcript;

input.value =
text;

ask();

};



recognition.onend =
function()
{

recognizing = false;

voiceBtn.innerText =
"🎤 Speak";

};

}
