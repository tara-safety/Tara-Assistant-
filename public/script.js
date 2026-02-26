const chat = document.getElementById("chat");

function send(){

const input = document.getElementById("input");

const msg = input.value;

if(!msg) return;

chat.innerHTML += "<div>You: "+msg+"</div>";

let reply = getMockReply(msg);

chat.innerHTML += "<div>T.A.R.A: "+reply+"</div>";

input.value="";
}

function getMockReply(msg){

msg = msg.toLowerCase();

if(msg.includes("tow"))
return "Ensure vehicle is stable before attaching.";

if(msg.includes("battery"))
return "Verify high voltage system is isolated.";

if(msg.includes("hello"))
return "Hello Troy. T.A.R.A online.";

return "Safety first. Confirm surroundings.";
}
