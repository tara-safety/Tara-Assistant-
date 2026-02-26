// script.js
const chat = document.getElementById("chat");
const questionInput = document.getElementById("question");

async function ask() {
  const question = questionInput.value.trim();
  if (!question) return;

  // Add user message
  addMessage(question, "user");
  questionInput.value = "";

  // Add typing animation
  const thinkingDiv = addMessage("T.A.R.A. is typing...", "tara");

  try {
    const response = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });

    const data = await response.json();

    // Simulate typing effect for the answer
    await typeAnswer(thinkingDiv, data.answer);

  } catch (err) {
    updateMessage(thinkingDiv, "Error contacting T.A.R.A.");
    console.error(err);
  }

  chat.scrollTop = chat.scrollHeight;
}

// Add message to chat
function addMessage(text, sender) {
  const div = document.createElement("div");
  div.className = `chat-message ${sender}`;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

// Update message text immediately
function updateMessage(div, text) {
  div.innerText = text;
}

// Type out the answer one character at a time
async function typeAnswer(div, text) {
  div.innerText = "";
  for (let i = 0; i < text.length; i++) {
    div.innerText += text[i];
    await sleep(20); // 20ms per character
  }
}

// Simple sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Optional: Press Enter to send
questionInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") ask();
});
