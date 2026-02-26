const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const input = document.getElementById("question");

askBtn.onclick = async () => {

    const message = input.value.trim();

    if (!message) return;

    console.log("Sending:", message);

    try {

        const res = await fetch("/chat", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message: message
            })

        });

        const data = await res.json();

        speak(data.reply);

    } catch (err) {

        console.error(err);

    }

};


voiceBtn.onclick = () => {

    const recognition =
        new (window.SpeechRecognition || window.webkitSpeechRecognition)();

    recognition.onresult = (event) => {

        const text = event.results[0][0].transcript;

        input.value = text;

        askBtn.click();
    };

    recognition.start();
};


function speak(text) {

    const speech = new SpeechSynthesisUtterance(text);

    speech.rate = 1;
    speech.pitch = 1;

    speechSynthesis.speak(speech);

}
