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
const micBtn = document.getElementById("micBtn");

let listening = false;

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = new SpeechRecognition();

recognition.continuous = false;
recognition.interimResults = false;
recognition.lang = "en-US";

micBtn.onclick = () => {

  if (!listening) {

    recognition.start();
    listening = true;
    micBtn.innerText = "🛑";

  } else {

    recognition.stop();
    listening = false;
    micBtn.innerText = "🎤";

  }

};

recognition.onresult = async (event) => {

  const text = event.results[0][0].transcript;

  document.getElementById("question").value = text;

  sendQuestion();

};

recognition.onend = () => {

  listening = false;
  micBtn.innerText = "🎤";

};
