const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const voiceBtn = document.getElementById("voice-btn");
const mascotUpload = document.getElementById("mascot-upload");

const BASE_URL = "https://mascot-mvp-production.up.railway.app";

// Add chat messages to UI
function addMessage(sender, text) {
  const p = document.createElement("p");
  p.className = sender;
  p.textContent = text;
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Speech output for bot
  if (sender === "bot") {
    const speech = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(speech);
  }
}

// Send message to backend
async function sendMessage() {
  const text = input.value;
  if (!text) return;
  addMessage("user", text);
  input.value = "";

  try {
    const res = await fetch(`${BASE_URL}/chat`, {
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

// Mascot image upload
if (mascotUpload) {
  mascotUpload.addEventListener("change", async () => {
    const file = mascotUpload.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("mascot", file);

    try {
      const res = await fetch(`${BASE_URL}/mascot/upload`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        addMessage("bot", "Mascot image uploaded successfully!");
        document.getElementById("mascot-img").src = data.url || "default-mascot.png";
      } else {
        addMessage("bot", "Mascot upload failed.");
      }
    } catch (e) {
      addMessage("bot", "Error uploading mascot.");
    }
  });
}
