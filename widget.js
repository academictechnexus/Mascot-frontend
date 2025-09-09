// --- BEGIN PATCH: dynamic BACKEND_URL + helper callChat() ---
// Determines backend endpoint in this order:
// 1) data-backend attribute on the <script> tag that loads widget.js
// 2) window.MASCOT_CONFIG.backend (if you set config.js)
// 3) fallback hardcoded URL (your repo default)
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
  if (window.MASCOT_CONFIG && window.MASCOT_CONFIG.backend)
    return window.MASCOT_CONFIG.backend;
  return BACKEND_FALLBACK;
})();

// Helper wrapper to call chat API consistently
async function callChat(payload) {
  try {
    const resp = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Backend returned ${resp.status}: ${text}`);
    }
    const data = await resp.json();
    return data;
  } catch (err) {
    console.error("callChat error:", err);
    throw err;
  }
}
// --- END PATCH ---

const mascotBubble = document.getElementById("mascot-bubble");
const mascotImg = document.getElementById("mascot-img");
const chatWindow = document.getElementById("chat-window");
const chatHeader = document.getElementById("chat-header");
const chatBody = document.getElementById("chat-body");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const chatInput = document.getElementById("chat-input");
const minimizeBtn = document.getElementById("minimize-btn");
const muteBtn = document.getElementById("mute-btn");
const toggleModeBtn = document.getElementById("toggle-mode");
const avatarContainer = document.getElementById("avatar-container");
const avatarLoader = document.getElementById("avatar-loader");
const uploadBtn = document.getElementById("upload-btn");
const uploadInput = document.getElementById("mascot-upload");

let isMuted = false;
let currentMode = "mascot";

// Show chat
mascotBubble.onclick = () => {
  chatWindow.classList.remove("hidden");
  chatWindow.classList.remove("minimized");
  if (currentMode === "avatar") avatarContainer.classList.add("show");
};

// Minimize chat
minimizeBtn.onclick = () => {
  chatWindow.classList.toggle("minimized");
};
// Restore on header click
chatHeader.onclick = (e) => {
  if (chatWindow.classList.contains("minimized") && e.target.id !== "minimize-btn") {
    chatWindow.classList.remove("minimized");
  }
};

// Enter to send
chatInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendBtn.click();
  }
});

// Mute
muteBtn.onclick = () => {
  isMuted = !isMuted;
  muteBtn.innerText = isMuted ? "🔇" : "🔊";
};

// Upload mascot
uploadBtn.onclick = () => uploadInput.click();
uploadInput.onchange = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      mascotImg.src = ev.target.result;
      localStorage.setItem("mascotImg", ev.target.result);
    };
    reader.readAsDataURL(file);
  }
};

// Toggle Mascot ↔ Avatar
toggleModeBtn.onclick = () => {
  if (currentMode === "mascot") {
    currentMode = "avatar";
    toggleModeBtn.innerText = "Mascot";
    mascotBubble.classList.add("hidden");
    avatarContainer.classList.remove("hidden");
    avatarContainer.classList.add("show");
    uploadBtn.disabled = true;
    resizeRenderer();
  } else {
    currentMode = "mascot";
    toggleModeBtn.innerText = "Avatar";
    avatarContainer.classList.remove("show");
    mascotBubble.classList.remove("hidden");
    uploadBtn.disabled = false;
  }
};

// Send message
sendBtn.onclick = async () => {
  const text = chatInput.value.trim();
  if (!text) return;

  appendMessage("user", text);
  chatInput.value = "";
  appendMessage("bot", "...", true);

  try {
    const data = await callChat({ message: text });
    removeTyping();

    if (data.text || data.reply) {
      const replyText = data.text || data.reply;
      appendMessage("bot", replyText);
      if (currentMode === "mascot") startMascotSpeaking(replyText);
      else startAvatarSpeaking(replyText);
    } else {
      appendMessage("bot", "⚠️ No response from backend.");
    }
  } catch (err) {
    console.error("Chat error:", err);
    removeTyping();
    appendMessage("bot", "⚠️ Backend not reachable.");
  }
};

// Helpers
function appendMessage(sender, text, isTyping = false) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  if (isTyping) msg.id = "typing";
  msg.innerText = text;
  chatBody.appendChild(msg);
  chatBody.scrollTop = chatBody.scrollHeight;
}
function removeTyping() {
  const typing = document.getElementById("typing");
  if (typing) typing.remove();
}

// Mascot speaking
function startMascotSpeaking(text) {
  mascotBubble.classList.add("speaking");
  if (!isMuted) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => mascotBubble.classList.remove("speaking");
    speechSynthesis.speak(utterance);
  } else {
    setTimeout(() => mascotBubble.classList.remove("speaking"), 2000);
  }
}

// Avatar (Three.js)
let scene, camera, renderer, avatar, mixer, clock;
clock = new THREE.Clock();

function initAvatar(url) {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 300 / 400, 0.1, 1000);
  camera.position.z = 2;

  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(300, 400);
  avatarContainer.appendChild(renderer.domElement);

  const light = new THREE.HemisphereLight(0xffffff, 0x444444);
  light.position.set(0, 20, 0);
  scene.add(light);

  const loader = new THREE.GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      avatar = gltf.scene;
      avatar.scale.set(1.5, 1.5, 1.5);
      scene.add(avatar);

      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(avatar);
        mixer.clipAction(gltf.animations[0]).play();
      }

      avatarLoader.style.display = "none"; // hide loader
    },
    undefined,
    (error) => {
      avatarLoader.innerText = "⚠️ Avatar failed to load";
      console.error("Avatar load error:", error);
    }
  );

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  if (renderer) renderer.render(scene, camera);
}

function resizeRenderer() {
  if (renderer) {
    renderer.setSize(300, 400);
    camera.aspect = 300 / 400;
    camera.updateProjectionMatrix();
  }
}

// ✅ Preload half-body avatar
initAvatar("https://models.readyplayer.me/68b5e67fbac430a52ce1260e.glb");

function startAvatarSpeaking(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onboundary = () => {
    if (avatar) avatar.rotation.y = Math.sin(Date.now() * 0.01) * 0.3;
  };
  utterance.onend = () => {
    if (avatar) avatar.rotation.y = 0;
  };
  speechSynthesis.speak(utterance);
}
