const input =
document.getElementById("question");

const askBtn =
document.getElementById("askBtn");

const voiceBtn =
document.getElementById("voiceBtn");

const response =
document.getElementById("response");

const thinking =
document.getElementById("thinking");

const menuBtn =
document.getElementById("menuBtn");

const menuOverlay =
document.getElementById("menuOverlay");

const closeMenu =
document.getElementById("closeMenu");

const emergencyBtn =
document.getElementById("emergencyBtn");

const holdBar =
document.getElementById("holdBar");



/* CHAT */

function addUser(text){

response.innerHTML +=
"<div style='margin-top:15px;color:#4fc3f7'>YOU:</div>"+text;

response.scrollTop =
response.scrollHeight;

}


function addBot(text){

response.innerHTML +=
"<div style='margin-top:15px;color:#00ff9c'>TARA:</div>"+text;

response.scrollTop =
response.scrollHeight;

}



/* SEND */

askBtn.onclick =
async function(){

const q =
input.value.trim();

if(!q) return;

addUser(q);

input.value="";

thinking.classList.remove("hidden");

const res =
await fetch("/ask",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
question:q
})

});

const data =
await res.json();

thinking.classList.add("hidden");

addBot(data.answer);

};



input.addEventListener(
"keypress",
e=>{
if(e.key==="Enter")
askBtn.click();
}
);



/* VOICE */

let recognition;

if(
"webkitSpeechRecognition" in window
){

recognition =
new webkitSpeechRecognition();

recognition.onresult =
e=>{

input.value =
e.results[0][0].transcript;

askBtn.click();

};

}

voiceBtn.onclick =
()=> recognition?.start();



/* MENU */

menuBtn.addEventListener("click", ()=>{

menuOverlay.classList.remove("hidden");

});


closeMenu.addEventListener("click", ()=>{

menuOverlay.classList.add("hidden");

});


/* also close if background tapped */

menuOverlay.addEventListener("click",(e)=>{

if(e.target === menuOverlay){

menuOverlay.classList.add("hidden");

}

});

/* HOLD EMERGENCY */

let holdTimer;

emergencyBtn.onmousedown =
emergencyBtn.ontouchstart =
()=>{

let width=0;

holdTimer =
setInterval(()=>{

width+=3;

holdBar.style.width=
width+"%";

if(width>=100){

clearInterval(holdTimer);

window.location.href=
"tel:15066887812";

}

},100);

};


emergencyBtn.onmouseup =
emergencyBtn.ontouchend =
()=>{

clearInterval(holdTimer);

holdBar.style.width="0%";

};
