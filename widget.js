// ... previous code unchanged up to sendBtn.onclick

sendBtn.onclick = async () => {
  const text = chatInput.value.trim();
  if (!text) return;

  appendMessage("user", text);
  chatInput.value = "";

  // Show typing
  appendMessage("bot", "...", true);

  try {
    const res = await fetch("https://mascot.academictechnexus.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();
    removeTyping();

    if (data.text) {
      appendMessage("bot", data.text);
      startMascotSpeaking(data.text);
    }

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

// ✅ Allow pressing Enter to send message
chatInput.addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    sendBtn.click();
  }
});

// Mascot speaking animation + voice
function startMascotSpeaking(text) {
  mascotBubble.classList.add("speaking");

  if (!isMuted) {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
    utterance.onend = () => {
      mascotBubble.classList.remove("speaking"); // back to corner
    };
  } else {
    setTimeout(() => mascotBubble.classList.remove("speaking"), 2000);
  }
}
