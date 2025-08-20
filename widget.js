const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const voiceBtn = document.getElementById("voice-btn");

function addMessage(sender, text) {
  const p = document.createElement("p");
  p.className = sender;
  p.textContent = text;
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Speech output
  if (sender === "bot") {
    const speech = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(speech);
  }
}

async function sendMessage() {
  const text = input.value;
  if (!text) return;
  addMessage("user", text);
  input.value = "";

  // Call backend (Railway)
  try {
    const res = await fetch("https://your-railway-app.up.railway.app/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    addMessage("bot", data.reply || "Sorry, no reply.");
  } catch (e) {
    addMessage("bot", "Error connecting to backend.");
  }
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});

// Voice input
const recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (recognition) {
  const recog = new recognition();
  recog.lang = "en-US";
  voiceBtn.addEventListener("click", () => {
    recog.start();
  });
  recog.onresult = e => {
    const transcript = e.results[0][0].transcript;
    input.value = transcript;
    sendMessage();
  };
} else {
  voiceBtn.disabled = true;
}
