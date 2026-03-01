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

const closeMenu =
document.getElementById("closeMenu");

const menuOverlay =
document.getElementById("menuOverlay");

const emergencyBtn =
document.getElementById("emergencyBtn");



/* MENU */

menuBtn.onclick =
()=> menuOverlay.classList.remove("hidden");

closeMenu.onclick =
()=> menuOverlay.classList.add("hidden");



/* CHAT */

function addUser(text){

response.innerHTML +=
"<div style='color:#4fc3f7'>YOU: "+text+"</div>";

}


function addBot(text){

response.innerHTML +=
"<div>TARA: "+text+"</div>";

response.scrollTop =
response.scrollHeight;

}



askBtn.onclick =
async function(){

const q =
input.value.trim();

if(!q) return;

addUser(q);

input.value="";

thinking.classList.remove("hidden");

try{

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

addBot(data.answer);

}
catch{

addBot(
"Offline safety mode active"
);

}

thinking.classList.add("hidden");

};



input.addEventListener(
"keypress",
e=>{
if(e.key==="Enter")
askBtn.click();
}
);



/* EMERGENCY HOLD */

let holdTimer;

emergencyBtn.onmousedown =
()=>{

holdTimer =
setTimeout(()=>{

alert(
"Emergency triggered (test mode)"
);

},2000);

};

emergencyBtn.onmouseup =
()=> clearTimeout(holdTimer);

emergencyBtn.ontouchstart =
emergencyBtn.onmousedown;

emergencyBtn.ontouchend =
emergencyBtn.onmouseup;
