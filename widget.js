const API_BASE_URL = "https://mascot.academictechnexus.com"; // your backend

// Elements
const chatToggle = document.getElementById("chat-toggle");
const chatWidget = document.getElementById("chat-widget");
const closeChat = document.getElementById("close-chat");
const chatBody = document.getElementById("chat-body");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const voiceBtn = document.getElementById("voice-btn");

// Toggle widget
chatToggle.addEventListener("click", () => {
  chatWidget.style.display = "block";
  chatToggle.style.display = "none";
});
closeChat.addEventListener("click", () => {
  chatWidget.style.display = "none";
  chatToggle.style.display = "block";
});

// Add messages
function displayMessage(message, type) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", type === "user" ? "user-message" : "bot-message");
  msgDiv.innerText = message;
  chatBody.appendChild(msgDiv);
  chatBody.scrollTop = chatBody.scrollHeight;
}

// Speak bot reply
function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  speechSynthesis.speak(utterance);
}

// Send message
async function sendMessage(userMessage) {
  if (!userMessage.trim()) return;
  displayMessage(userMessage, "user");
  chatInput.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage })
    });
    const data = await response.json();
    const botReply = data.reply || "⚠️ No response";
    displayMessage(botReply, "bot");
    speak(botReply);
  } catch (error) {
    console.error("Error:", error);
    displayMessage("⚠️ Server not responding.", "bot");
  }
}

// Event listeners
sendBtn.addEventListener("click", () => sendMessage(chatInput.value));
chatInput.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage(chatInput.value);
});

// Voice input
voiceBtn.addEventListener("click", () => {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "en-US";
  recognition.start();

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    sendMessage(transcript);
  };

  recognition.onerror = (event) => {
    console.error("Voice error:", event.error);
  };
});
