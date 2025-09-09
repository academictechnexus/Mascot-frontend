// widget.js — demo with placeholder 3D avatar
const BACKEND_URL = window.MASCOT_CONFIG.backend;
const UPLOAD_URL = window.MASCOT_CONFIG.upload;

// DOM refs
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
const mascotPreview = document.getElementById("mascot-preview");

let isMuted = false;
let pending = false;
let queue = [];
let avatarScene = null; // three.js scene
let avatarMixer = null;

// ---- three.js setup ----
async function loadThreeAvatar(glbUrl) {
  if (avatarScene) return; // already loaded
  avatarLoader.innerText = "Loading 3D Avatar...";
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
  script.onload = async () => {
    const { Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, DirectionalLight, Clock } = THREE;
    avatarScene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 1.4, 2);
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(avatarContainer.clientWidth, avatarContainer.clientHeight);
    avatarContainer.innerHTML = "";
    avatarContainer.appendChild(renderer.domElement);
    avatarScene.add(new AmbientLight(0xffffff, 1));
    const dl = new DirectionalLight(0xffffff, 0.6);
    dl.position.set(0, 2, 2);
    avatarScene.add(dl);

    // load GLTF loader
    const loaderScript = document.createElement("script");
    loaderScript.src = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/loaders/GLTFLoader.js";
    loaderScript.onload = () => {
      const loader = new THREE.GLTFLoader();
      loader.load(glbUrl, (gltf) => {
        avatarScene.add(gltf.scene);
        avatarMixer = new THREE.AnimationMixer(gltf.scene);
      });
    };
    document.body.appendChild(loaderScript);

    const clock = new Clock();
    function animate() {
      requestAnimationFrame(animate);
      if (avatarMixer) avatarMixer.update(clock.getDelta());
      renderer.render(avatarScene, camera);
    }
    animate();
  };
  document.body.appendChild(script);
}

// ---- Chat helpers ----
function appendMessage(sender, text) {
  const el = document.createElement("div");
  el.className = "message " + (sender === "user" ? "user" : "bot");
  el.innerText = text;
  chatBody.appendChild(el);
  chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
}

function speak(text) {
  if (isMuted) return;
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(u);
}

// ---- Queue ----
function enqueue(text) {
  queue.push(text);
  processQueue();
}
async function processQueue() {
  if (pending || queue.length === 0) return;
  pending = true;
  const text = queue.shift();
  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const j = await res.json();
    appendMessage("bot", j.reply);
    speak(j.reply);
    // TODO: trigger avatar animation based on j.action
  } catch (e) {
    appendMessage("bot", "⚠️ Error contacting server");
  } finally {
    pending = false;
    processQueue();
  }
}

// ---- Events ----
toggleBtn.addEventListener("click", () => panel.classList.toggle("closed"));
minimizeBtn.addEventListener("click", () => panel.classList.add("closed"));
closeBtn.addEventListener("click", () => panel.classList.add("closed"));
sendBtn.addEventListener("click", () => {
  const txt = chatInput.value.trim();
  if (!txt) return;
  appendMessage("user", txt);
  chatInput.value = "";
  enqueue(txt);
});
chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendBtn.click(); });

muteBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  muteBtn.innerText = isMuted ? "🔇" : "🔊";
  if (isMuted && window.speechSynthesis) window.speechSynthesis.cancel();
});

uploadBtn.addEventListener("click", () => uploadInput.click());
uploadInput.addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const form = new FormData();
  form.append("mascot", file);
  const res = await fetch(UPLOAD_URL, { method: "POST", body: form });
  const j = await res.json();
  if (j.uploaded_image_url) {
    mascotPreview.src = j.uploaded_image_url;
    mascotPreview.classList.remove("hidden");
  }
  if (j.glb_url) {
    loadThreeAvatar(j.glb_url);
  }
});

// Chips
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    chatInput.value = chip.dataset.q;
    sendBtn.click();
  });
});

// Welcome
appendMessage("bot", "Welcome! Upload a mascot to see your 3D avatar.");
