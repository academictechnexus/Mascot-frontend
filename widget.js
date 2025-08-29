// widget.js

document.addEventListener("DOMContentLoaded", () => {
  const widget = document.querySelector(".chat-widget");
  const toggleButton = document.querySelector(".chat-toggle");
  const mascot = document.querySelector(".mascot");
  const chatBox = document.querySelector(".chat-box");
  const input = document.querySelector(".chat-input input");
  const sendButton = document.querySelector(".chat-input button");

  // Open/close widget
  toggleButton.addEventListener("click", () => {
    widget.classList.toggle("open");

    if (widget.classList.contains("open")) {
      mascot.classList.add("mascot-wave"); // mascot waves when widget opens
      setTimeout(() => mascot.classList.remove("mascot-wave"), 1500);
    } else {
      mascot.classList.add("mascot-bounce"); // mascot bounces when closing
      setTimeout(() => mascot.classList.remove("mascot-bounce"), 1500);
    }
  });

  // Handle sending message
  function sendMessage() {
    const text = input.value.trim();
    if (text === "") return;

    addMessage("You", text);
    input.value = "";

    // Fake bot response
    setTimeout(() => {
      addMessage("Mascot", getBotResponse(text));
      mascot.classList.add("mascot-happy");
      setTimeout(() => mascot.classList.remove("mascot-happy"), 1200);
    }, 1000);
  }

  // Add message to chat box
  function addMessage(sender, text) {
    const msg = document.createElement("div");
    msg.className = "message";
    msg.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // Dummy bot response logic
  function getBotResponse(userText) {
    const lower = userText.toLowerCase();
    if (lower.includes("hello") || lower.includes("hi")) {
      return "Hi there! 👋 How can I help you today?";
    } else if (lower.includes("help")) {
      return "Sure! Tell me what you’re looking for, and I’ll guide you.";
    } else if (lower.includes("bye")) {
      return "Goodbye! 👋 Come back anytime.";
    } else {
      return "I’m still learning 🤖, but I’ll try my best to help!";
    }
  }

  // Send on button click
  sendButton.addEventListener("click", sendMessage);

  // Send on Enter key
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Mascot hover interaction
  mascot.addEventListener("mouseenter", () => {
    mascot.classList.add("mascot-wave");
    setTimeout(() => mascot.classList.remove("mascot-wave"), 1500);
  });
});
