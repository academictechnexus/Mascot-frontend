// widget.js - Right-side Panel logic
// ---------------------------
// Dynamic BACKEND_URL detection
const BACKEND_FALLBACK = "https://mascot.academictechnexus.com/api/chat"; // fallback
const BACKEND_URL = (function () {
  try {
    const currentScript =
      document.currentScript ||
      (function () {
        const scripts = document.getElementsByTagName("script");
        for (let s of scripts) {
          if (s.src && s.src.indexOf("widget.js") !== -1) return s;
        }
        return null;
      })();
    if (currentScript) {
      const dataBackend = currentScript.getAttribute("data-backend");
      if (dataBackend && dataBackend.trim().length) return dataBackend.trim();
    }
  } catch (e) {}
  if (window.MASCOT_CONFIG && window.MASCOT_CONFIG.backend) return window.MASCOT_CONFIG.backend;
  return BACKEND_FALLBACK;
})();

// callChat helper: ensures consistent POST to backend
async function callChat(payload) {
  try {
    const resp = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Backend ${resp.status}: ${text}`);
    }
    return await resp.json();
  } catch (err) {
    console.error("callChat error:", err);
    throw err;
  }
}

/* ---------- DOM elements ---------- */
const panel = document.getElementById("mascot-panel");
const toggleBtn = document.getElementById("mascot-toggle");
const minimizeBtn = document.getElementById("minimize-btn");
const closeBtn = document.getElementById("close-btn");
const chatBody = document.getElementById("chat-body");
const sendBtn = document.getElementById("send-btn");
const chatInput = document.getElementById("chat-input");
const muteBtn = document.getElementById("mute-btn");
const uploadBtn = document.getElementById("upload-btn");
const uploadInput = document.getElementById("mascot-upload");
const avatarContainer = document.getElementById("avatar-container");
const avatarLoader = document.getElementById("avatar-loader");
const openStoreBtn = document.getElementById("open-store-btn");

/* state */
let isMuted = false;
let avatarInitialized = false;
let storeId = null;

// attempt to populate store id from script attr
(function setStoreId() {
  try {
    const currentScript =
      document.currentScript ||
      Array.from(document.scripts).find((s) => s.src && s.src.indexOf("widget.js") !== -1);
    if (currentScript) storeId = currentScript.getAttribute("data-store-id") || null;
    if (!storeId && window.MASCOT_CONFIG && window.MASCOT_CONFIG.store_id) storeId = window.MASCOT_CONFIG.store_id;
  } catch (e) {}
})();

/* utility: add message */
function appendMessage(sender, text, meta) {
  const el = document.createElement("div");
  el.className = "message " + (sender === "user" ? "user" : "bot");
  el.innerHTML = `<div class="text">${escapeHtml(text)}</div>` + (meta ? `<div class="time">${escapeHtml(meta)}</div>` : "");
  chatBody.appendChild(el);
  chatBody.scrollTop = chatBody.scrollHeight;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"'`]/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;","`":"&#96;" }[m]));
}

/* INITIAL UI wiring */
function openPanel() {
  panel.classList.remove("closed");
  panel.setAttribute("aria-hidden", "false");
  toggleBtn.setAttribute("aria-expanded", "true");
}
function closePanel() {
  panel.classList.add("closed");
  panel.setAttribute("aria-hidden", "true");
  toggleBtn.setAttribute("aria-expanded", "false");
}
toggleBtn.addEventListener("click", () => {
  if (panel.classList.contains("closed")) openPanel();
  else closePanel();
});
minimizeBtn.addEventListener("click", () => {
  closePanel();
});
closeBtn.addEventListener("click", () => {
  closePanel();
});
openStoreBtn && openStoreBtn.addEventListener("click", () => {
  // open the storefront in a new tab; if store_id present we try to build a URL
  if (storeId) {
    // merchant-specific: you can change to proper shop domain mapping
    window.open(`https://${storeId}.myshopify.com`, "_blank");
  } else {
    window.open("/", "_blank");
  }
});

/* mute */
muteBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  muteBtn.innerText = isMuted ? "🔇" : "🔊";
});

/* upload mascot image (client-side preview then send to backend if you want) */
uploadBtn.addEventListener("click", () => uploadInput.click());
uploadInput.addEventListener("change", async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  // preview to avatar container as img
  const reader = new FileReader();
  reader.onload = (e) => {
    avatarContainer.style.backgroundImage = `url(${e.target.result})`;
    avatarContainer.style.backgroundSize = "cover";
    avatarContainer.innerText = "";
  };
  reader.readAsDataURL(file);

  // optionally: upload to backend if you have an upload endpoint
  try {
    const form = new FormData();
    form.append("mascot", file);
    // if you have /mascot/upload endpoint, uncomment and use:
    // const upResp = await fetch(BACKEND_URL.replace(/\/api\/chat\/?$/,'') + '/mascot/upload', { method:'POST', body: form});
    // console.log('upload resp', upResp.status);
  } catch (err) {
    console.warn("upload failed", err);
  }
});

/* lazy avatar load when panel opens first time */
toggleBtn.addEventListener("click", initAvatarOnce);
function initAvatarOnce() {
  if (avatarInitialized) return;
  avatarInitialized = true;
  // lazy load three.js and GLTFLoader (CDN)
  const script1 = document.createElement("script");
  script1.src = "https://cdn.jsdelivr.net/npm/three@0.156.1/build/three.min.js";
  script1.onload = () => {
    const s2 = document.createElement("script");
    s2.src = "https://cdn.jsdelivr.net/npm/three@0.156.1/examples/js/loaders/GLTFLoader.js";
    s2.onload = () => {
      loadAvatarModel();
    };
    document.body.appendChild(s2);
  };
  document.body.appendChild(script1);
}

/* load avatar model - simple face rotation animation */
function loadAvatarModel() {
  try {
    avatarLoader.innerText = "Loading avatar...";
    // try load a sample GLB if you want (fallback to static)
    if (window.THREE && window.THREE.GLTFLoader) {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 110/140, 0.1, 1000);
      camera.position.z = 2.2;
      const renderer = new THREE.WebGLRenderer({ alpha: true });
      renderer.setSize(110, 140);
      // replace avatarContainer contents with renderer canvas
      avatarContainer.innerHTML = "";
      avatarContainer.appendChild(renderer.domElement);

      const light = new THREE.HemisphereLight(0xffffff, 0x444444);
      light.position.set(0, 20, 0);
      scene.add(light);

      // GLTF loader - you can change the GLB url to your model.
      const loader = new THREE.GLTFLoader();
      const sampleGlb = "https://models.readyplayer.me/68b5e67fbac430a52ce1260e.glb";
      loader.load(sampleGlb, (gltf) => {
        const avatar = gltf.scene;
        avatar.scale.set(1.2,1.2,1.2);
        scene.add(avatar);
        // simple rotate animation
        function animate() {
          requestAnimationFrame(animate);
          avatar.rotation.y += 0.005;
          renderer.render(scene, camera);
        }
        animate();
        avatarLoader.style.display = "none";
      }, undefined, (err) => {
        console.warn("avatar load error", err);
        avatarContainer.innerText = "Avatar failed";
      });
    } else {
      avatarContainer.innerText = "Avatar ready";
    }
  } catch (e) {
    console.warn("avatar init exception", e);
    avatarContainer.innerText = "Avatar error";
  }
}

/* send message flow */
async function sendMessage() {
  const text = chatInput.value && chatInput.value.trim();
  if (!text) return;
  appendMessage("user", text, null);
  chatInput.value = "";
  // show typing placeholder
  const typingEl = document.createElement("div");
  typingEl.className = "message bot typing";
  typingEl.innerText = "…";
  chatBody.appendChild(typingEl);
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    const payload = { message: text };
    if (storeId) payload.store_id = storeId;
    const res = await callChat(payload);
    // remove typing
    typingEl.remove();
    // backend may return data.text or data.reply
    const replyText = res?.text || res?.reply || (typeof res === "string" ? res : "No response");
    appendMessage("bot", replyText, null);
    if (!isMuted) speak(replyText);
  } catch (err) {
    typingEl.remove();
    appendMessage("bot", "⚠️ Could not reach backend. Please try again.");
  }
}

/* simple TTS */
function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) { console.warn("TTS error", e); }
}

/* wire send */
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });

/* simple init - ensure panel hidden/visible states */
(function initWidget() {
  // hide panel at start
  panel.classList.add("closed");
  // ensure minimal content
  appendMessage("bot", "Hi! Ask me about products, shipping, or returns.");
})();
