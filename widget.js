const mascotBubble = document.getElementById("mascot-bubble");
const mascotImg = document.getElementById("mascot-img");
const chatWindow = document.getElementById("chat-window");
const chatBody = document.getElementById("chat-body");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const chatInput = document.getElementById("chat-input");
const closeBtn = document.getElementById("close-btn");
const muteBtn = document.getElementById("mute-btn");
const uploadBtn = document.getElementById("upload-btn");
const uploadInput = document.getElementById("mascot-upload");

let isMuted = false;

// Load mascot from localStorage if available
const savedMascot = localStorage.getItem("mascotImg");
if (savedMascot) mascotImg.src = savedMascot;

// Toggle chat window
mascotBubble.onclick = () => {
  chatWindow.classList.toggle("hidden");
};

// Close chat
closeBtn.onclick = () => chatWindow.classList.add("hidden");

// Mute/unmute
muteBtn.onclick = () => {
  isMuted = !isMuted;
  muteBtn.innerText = isMuted ? "🔇" : "🔊";
};

// Upload mascot button
uploadBtn.onclick = () => uploadInput.click();

// When file is chosen
uploadInput.onchange = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(ev) {
      mascotImg.src = ev.target.result;
      localStorage.setItem("mascotImg", ev.target.result); // Save
    };
    reader.readAsDataURL(file);
  }
};

// Send message
sendBtn.onclick = async () => {
  const text = chatInput.value.trim();
  if (!text) return;

  appendMessage("user", text);
  chatInput.value = "";

  // Show typing
  appendMessage("bot", "...", true);

  try {
    // ✅ Call your backend with custom domain
    const res = await fetch("https://mascot.academictechnexus.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();
    removeTyping();

    // Handle bot reply
    if (data.text) {
      appendMessage("bot", data.text);
      startMascotSpeaking(data.text);
    }

    // Handle product suggestions (if backend includes them)
    if (data.products && Array.isArray(data.products)) {
      data.products.forEach(p => {
        showProduct(p.name, p.price);
      });
    }

  } catch (error) {
    console.error("Chat error:", error);
    removeTyping();
    appendMessage("bot", "⚠️ Backend not reachable. Please try again later.");
    startMascotSpeaking("Backend not reachable right now.");
  }
};

// Append message to chat
function appendMessage(sender, text, isTyping = false) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  if (isTyping) msg.id = "typing";
  msg.innerText = text;
  chatBody.appendChild(msg);
  chatBody.scrollTop = chatBody.scrollHeight;
}

// Remove typing indicator
function removeTyping() {
  const typing = document.getElementById("typing");
  if (typing) typing.remove();
}

// Show product card
function showProduct(name, price) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.innerHTML = `
    <div class="product-title">${name}</div>
    <div class="product-price">⭐️⭐️⭐️⭐️☆  ${price}</div>
    <div class="product-actions">
      <button class="add-cart">Add to Cart</button>
      <button class="view-btn">View</button>
    </div>
  `;
  chatBody.appendChild(card);
  chatBody.scrollTop = chatBody.scrollHeight;
}

// Mascot speaking animation + voice
function startMascotSpeaking(text) {
  mascotBubble.classList.add("speaking");

  if (!isMuted) {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
    utterance.onend = () => {
      mascotBubble.classList.remove("speaking");
    };
  } else {
    setTimeout(() => mascotBubble.classList.remove("speaking"), 2000);
  }
}

// 🎤 Voice input (Speech-to-Text)
if ("webkitSpeechRecognition" in window) {
  const recognition = new webkitSpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
  };

  recognition.onerror = function() {
    alert("Voice recognition failed. Try again.");
  };

  micBtn.onclick = () => {
    recognition.start();
    micBtn.innerText = "🎙️"; // recording mode
    recognition.onend = () => {
      micBtn.innerText = "🎤"; // reset icon
    };
  };
} else {
  micBtn.onclick = () => alert("Your browser does not support voice input.");
}
