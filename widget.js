const API_BASE_URL = "https://mascot.academictechnexus.com"; // backend API

// --- Elements ---
const chatToggle = document.getElementById("chat-toggle");
const chatWidget = document.getElementById("chat-widget");
const closeChat = document.getElementById("close-chat");
const chatBody = document.getElementById("chat-body");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const voiceBtn = document.getElementById("voice-btn");

const mascot = document.getElementById("mascot");
const uploadInput = document.getElementById("uploadMascot");

// --- Toggle widget ---
chatToggle.addEventListener("click", () => {
  chatWidget.style.display = "block";
  chatToggle.style.display = "none";
});
closeChat.addEventListener("click", () => {
  chatWidget.style.display = "none";
  chatToggle.style.display = "block";
});

// --- Display messages ---
function displayMessage(message, type) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", type === "user" ? "user-message" : "bot-message");
  msgDiv.innerText = message;
  chatBody.appendChild(msgDiv);
  chatBody.scrollTop = chatBody.scrollHeight;
}

// --- Typing indicator ---
function showTyping() {
  const typingDiv = document.createElement("div");
  typingDiv.classList.add("message", "bot-message");
  typingDiv.innerText = "🤖 Typing...";
  typingDiv.id = "typing-indicator";
  chatBody.appendChild(typingDiv);
  chatBody.scrollTop = chatBody.scrollHeight;
}
function hideTyping() {
  const typingDiv = document.getElementById("typing-indicator");
  if (typingDiv) typingDiv.remove();
}

// --- Bot speaks (with mascot animation) ---
function speak(text) {
  if (!text) return;
  mascot.classList.add("talking");

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";

  utterance.onend = () => {
    mascot.classList.remove("talking");
  };

  speechSynthesis.speak(utterance);
}

// --- Send message to backend ---
async function sendMessage(userMessage) {
  if (!userMessage.trim()) return;
  displayMessage(userMessage, "user");
  chatInput.value = "";

  showTyping();

  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage })
    });

    const data = await response.json();
    hideTyping();

    const botReply = data.reply || "⚠️ No response";
    displayMessage(botReply, "bot");
    speak(botReply);
  } catch (error) {
    console.error("Error:", error);
    hideTyping();
    displayMessage("⚠️ Server not responding.", "bot");
  }
}

// --- Event listeners ---
sendBtn.addEventListener("click", () => sendMessage(chatInput.value));
chatInput.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage(chatInput.value);
});

// --- Voice input (speech-to-text) ---
if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "en-US";

  voiceBtn.addEventListener("click", () => {
    recognition.start();
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    sendMessage(transcript);
  };

  recognition.onerror = (event) => {
    console.error("Voice error:", event.error);
  };
} else {
  voiceBtn.disabled = true;
  console.warn("Speech recognition not supported in this browser.");
}

// --- Upload Mascot Image ---
uploadInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    mascot.src = URL.createObjectURL(file);
  }
});
