document.addEventListener("DOMContentLoaded", function(){

console.log("TARA script active");

const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const question = document.getElementById("question");
const chatBox = document.getElementById("chatBox");

const menuBtn = document.getElementById("menuBtn");
const closeMenu = document.getElementById("closeMenu");
const menu = document.getElementById("menu");

const emergencyBtn = document.getElementById("emergencyBtn");

/* MENU /

menuBtn.onclick = () => {
menu.style.left = "0px";
};

closeMenu.onclick = () => {
menu.style.left = "-260px";
};


/ SEND MESSAGE /

askBtn.onclick = () => {

const text = question.value.trim();

if(!text) return;

chatBox.innerHTML += "<div><b>You:</b> " + text + "</div>";

question.value = "";

};


/ VOICE INPUT /

voiceBtn.onclick = () => {

const SpeechRecognition =
window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = new SpeechRecognition();

recognition.start();

recognition.onresult = function(event){

question.value = event.results[0][0].transcript;

};

};


/ EMERGENCY BUTTON */

emergencyBtn.onclick = () => {

alert("Emergency Triggered");

};

});
