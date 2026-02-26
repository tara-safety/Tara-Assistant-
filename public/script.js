const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const input = document.getElementById("question");
const chatBox = document.getElementById("answer");
const avatar = document.getElementById("avatar");


function addMessage(text, sender){

    const msg = document.createElement("div");

    msg.style.margin="8px";
    msg.style.padding="10px";
    msg.style.borderRadius="8px";

    if(sender==="user"){
        msg.style.background="#1f2a44";
        msg.innerText="You: "+text;
    }else{
        msg.style.background="#00ffc3";
        msg.style.color="black";
        msg.innerText="T.A.R.A: "+text;
    }

    chatBox.appendChild(msg);

    chatBox.scrollTop = chatBox.scrollHeight;

}


async function ask(){

    const question = input.value.trim();

    if(!question) return;

    addMessage(question,"user");

    input.value="";

    avatar.classList.add("talking");

    try{

        const res = await fetch("/chat",{

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({
                message:question
            })

        });

        const data = await res.json();

        avatar.classList.remove("talking");

        addMessage(data.reply,"tara");

        speak(data.reply);

    }
    catch(err){

        avatar.classList.remove("talking");

        addMessage("Server connection error","tara");

        console.log(err);

    }

}


/* SEND BUTTON */
askBtn.addEventListener("click", ask);


/* ENTER KEY */
input.addEventListener("keydown", function(e){

    if(e.key==="Enter"){
        ask();
    }

});


/* VOICE INPUT */
const SpeechRecognition =
window.SpeechRecognition ||
window.webkitSpeechRecognition;

if(SpeechRecognition){

    const recognition = new SpeechRecognition();

    recognition.lang="en-US";

    voiceBtn.addEventListener("click", ()=>{

        recognition.start();

        voiceBtn.innerText="Listening...";

    });

    recognition.onresult=(event)=>{

        const text = event.results[0][0].transcript;

        input.value=text;

        voiceBtn.innerText="🎤 Speak";

        ask();

    };

}


/* VOICE OUTPUT */
function speak(text){

    const speech = new SpeechSynthesisUtterance(text);

    speech.rate=1;

    speech.pitch=1;

    speechSynthesis.speak(speech);

}
