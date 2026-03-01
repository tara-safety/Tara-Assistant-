const TEST_MODE = true; // true = safe testing, false = real emergency
const input = document.getElementById("question");
const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const chat = document.getElementById("chat");

const emergencyBtn = document.getElementById("emergencyBtn");
const status = document.getElementById("status");

let holdTimer;

/* ---------------- CHAT ---------------- */

function addMessage(text, cls)
{
    const div = document.createElement("div");
    div.className = cls;
    div.innerText = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

async function ask()
{
    const q = input.value;
    if(!q) return;

    addMessage(q,"messageUser");
    input.value="";

    const res = await fetch("/ask",
    {
        method:"POST",
        headers:{ "Content-Type":"application/json"},
        body:JSON.stringify({question:q})
    });

    const data = await res.text();

    addMessage(data,"messageBot");

    speak(data);
}

askBtn.onclick = ask;

/* ENTER KEY */

input.addEventListener("keypress", e=>{
if(e.key==="Enter") ask();
});


/* ---------------- VOICE ---------------- */

const SpeechRecognition =
window.SpeechRecognition ||
window.webkitSpeechRecognition;

if(SpeechRecognition)
{
    const rec = new SpeechRecognition();

    rec.onresult = e=>{
        input.value = e.results[0][0].transcript;
        ask();
    };

    voiceBtn.onclick = ()=>{
        rec.start();
    };
}


/* ---------------- SPEAK ---------------- */

function speak(text)
{
    const utter = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utter);
}


/* ---------------- EMERGENCY ---------------- */

emergencyBtn.onmousedown = startHold;
emergencyBtn.ontouchstart = startHold;

emergencyBtn.onmouseup = cancelHold;
emergencyBtn.ontouchend = cancelHold;

function startHold()
{
    status.innerText="Hold...";
    holdTimer = setTimeout(triggerEmergency,2000);
}

function cancelHold()
{
    clearTimeout(holdTimer);
    status.innerText="";
}


function triggerEmergency()
{
    status.innerText="Getting GPS...";

    navigator.geolocation.getCurrentPosition(

    pos=>{

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        status.innerText =
        "Location captured";

        /* SEND TO SERVER */

        fetch("/emergency",
        {
            method:"POST",
            headers:{
            "Content-Type":"application/json"
            },
            body:JSON.stringify({
            lat,
            lon,
            time:new Date()
            })
        });

        /* CALL troy cell not 911 test mode */

        window.location.href="tel:15066887812";

    },

    err=>{
        status.innerText="GPS failed";
    });

}
