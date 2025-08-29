(function () {
  // ===== Config from script tag =====
  const scriptEl = document.currentScript;
  const API_BASE =
    scriptEl.getAttribute("data-api") || "https://mascot.academictechnexus.com";

  const CHAT_URL = `${API_BASE}/chat`;
  const UPLOAD_URL = `${API_BASE}/mascot/upload`;

  // ===== UI skeleton =====
  const root = document.createElement("div");
  root.id = "mascot-assistant-root";
  root.innerHTML = `
    <div class="ma-launcher" id="ma-launcher" aria-label="Open chat">
      <div class="ma-mascot" id="ma-mascot"></div>
    </div>
    <div class="ma-panel" id="ma-panel" aria-live="polite" style="display:none">
      <div class="ma-header">
        <div class="ma-title">Assistant</div>
        <button class="ma-close" id="ma-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="ma-messages" id="ma-messages"></div>
      <div class="ma-input">
        <label for="ma-upload" title="Upload mascot" class="icon-btn">🖼️</label>
        <input id="ma-upload" type="file" accept="image/*" style="display:none" />
        <button id="ma-voice" type="button" class="icon-btn" title="Voice">🎤</button>
        <input id="ma-text" type="text" placeholder="Ask me anything..." />
        <button id="ma-send" type="button" class="send-btn">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // ===== Elements =====
  const launcher = document.getElementById("ma-launcher");
  const panel = document.getElementById("ma-panel");
  const mascot = document.getElementById("ma-mascot");
  const closeBtn = document.getElementById("ma-close");
  const messages = document.getElementById("ma-messages");
  const input = document.getElementById("ma-text");
  const sendBtn = document.getElementById("ma-send");
  const voiceBtn = document.getElementById("ma-voice");
  const uploadInput = document.getElementById("ma-upload");

  // ===== Helpers =====
  function setOpen(v) {
    panel.style.display = v ? "flex" : "none";
    launcher.style.display = v ? "none" : "flex";
  }
  function addUser(t) {
    const el = document.createElement("div");
    el.className = "ma-msg ma-user";
    el.textContent = t;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }
  function addBot(t) {
    const el = document.createElement("div");
    el.className = "ma-msg ma-bot";
    el.innerHTML = (t || "").replace(/\n/g, "<br>");
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;

    // Speak + animate
    if (window.speechSynthesis) {
      const utt = new SpeechSynthesisUtterance(el.textContent);
      utt.lang = "en-US";
      speechSynthesis.speak(utt);
    }
    mascot.classList.add("talk");
    setTimeout(
      () => mascot.classList.remove("talk"),
      Math.min(2000, Math.max(800, (el.textContent || "").length * 20))
    );
  }
  function showTyping() {
    const el = document.createElement("div");
    el.className = "ma-msg ma-bot ma-typing";
    el.innerHTML = `<span class="dots"></span>`;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  // ===== Voice input =====
  let recognizing = false, recognition;
  if (window.SpeechRecognition || window.webkitSpeechRecognition) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join(" ");
      input.value = t;
    };
    recognition.onend = () => (recognizing = false);
  }
  voiceBtn.addEventListener("click", () => {
    if (!recognition) return alert("Voice not supported on this browser.");
    if (!recognizing) { recognizing = true; recognition.start(); } else { recognition.stop(); recognizing = false; }
  });

  // ===== Send to backend (FORCE POST to CHAT_URL) =====
  async function send() {
    const t = input.value.trim();
    if (!t) return;
    addUser(t);
    input.value = "";

    const typingEl = showTyping();
    try {
      console.log("➡️ POST", CHAT_URL, "{ message:", t, "}");
      const r = await fetch(CHAT_URL, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: t })
      });

      let data = null;
      try { data = await r.json(); } catch (e) { console.error("JSON parse error:", e); }

      typingEl.remove();
      if (!r.ok) {
        const msg = data?.reply || data?.error || "⚠️ Something went wrong. Please try again.";
        addBot(msg);
        return;
      }
      addBot(data?.reply || "⚠️ No reply");
    } catch (e) {
      typingEl.remove();
      console.error("❌ Fetch error:", e);
      addBot("⚠️ Network error. Please try again.");
    }
  }

  // ===== Mascot Upload (POST to /mascot/upload) =====
  uploadInput.addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("mascot", file);
    addBot("Uploading mascot…");
    try {
      const up = await fetch(UPLOAD_URL, { method: "POST", body: form });
      const out = await up.json();
      if (out?.success && out?.url) {
        mascot.style.backgroundImage = `url(${out.url})`;
        addBot("Mascot updated!");
      } else {
        addBot("Mascot upload failed.");
      }
    } catch (e) {
      addBot("Mascot upload error.");
    } finally {
      uploadInput.value = "";
    }
  });

  // ===== Wire events =====
  launcher.addEventListener("click", () => setOpen(true));
  closeBtn.addEventListener("click", () => setOpen(false));
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); send(); } });

  // Start closed
  setOpen(false);
})();
