const mascotBubble = document.getElementById("mascot-bubble");
const mascotImg = document.getElementById("mascot-img");
const chatWindow = document.getElementById("chat-window");
const chatBody = document.getElementById("chat-body");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const chatInput = document.getElementById("chat-input");
const closeBtn = document.getElementById("close-btn");
const muteBtn = document.getElementById("mute-btn");
const toggleModeBtn = document.getElementById("toggle-mode");
const avatarContainer = document.getElementById("avatar-container");

let isMuted = false;
let currentMode = "mascot"; // default mode

// Toggle chat window
mascotBubble.onclick = () => {
  chatWindow.classList.toggle("hidden");
};

// Close chat
closeBtn.onclick = () => chatWindow.classList.add("hidden");

// ✅ Press Enter to send
chatInput.addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    sendBtn.click();
  }
});

// Mute/unmute
muteBtn.onclick = () => {
  isMuted = !isMuted;
  muteBtn.innerText = isMuted ? "🔇" : "🔊";
};

// Switch Mascot ↔ Avatar with fade
toggleModeBtn.onclick = () => {
  if (currentMode === "mascot") {
    currentMode = "avatar";
    toggleModeBtn.innerText = "Switch to Mascot";

    mascotBubble.classList.add("hidden");
    setTimeout(() => {
      mascotBubble.style.display = "none";
      avatarContainer.style.display = "block";
      setTimeout(() => avatarContainer.classList.remove("hidden"), 50);
    }, 500);

  } else {
    currentMode = "mascot";
    toggleModeBtn.innerText = "Switch to Avatar";

    avatarContainer.classList.add("hidden");
    setTimeout(() => {
      avatarContainer.style.display = "none";
      mascotBubble.style.display = "flex";
      setTimeout(() => mascotBubble.classList.remove("hidden"), 50);
    }, 500);
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
    const res = await fetch("https://mascot.academictechnexus.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();
    removeTyping();

    if (data.text) {
      appendMessage("bot", data.text);
      if (currentMode === "mascot") startMascotSpeaking(data.text);
      else startAvatarSpeaking(data.text);
    }

    if (data.products && Array.isArray(data.products)) {
      data.products.forEach(p => showProduct(p.name, p.price));
    }

  } catch (error) {
    console.error("Chat error:", error);
    removeTyping();
    appendMessage("bot", "⚠️ Backend not reachable.");
    if (currentMode === "mascot") startMascotSpeaking("Backend not reachable.");
    else startAvatarSpeaking("Backend not reachable.");
  }
};

// Append message
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

function showProduct(name, price) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.innerHTML = `
    <div class="product-title">${name}</div>
    <div class="product-price">⭐️⭐️⭐️⭐️☆ ${price}</div>
    <div class="product-actions">
      <button class="add-cart">Add to Cart</button>
      <button class="view-btn">View</button>
    </div>
  `;
  chatBody.appendChild(card);
  chatBody.scrollTop = chatBody.scrollHeight;
}

//
// 🔹 Mascot Speaking
//
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

//
// 🔹 Avatar Speaking (ReadyPlayerMe)
//
let scene, camera, renderer, avatar, mixer, clock;
clock = new THREE.Clock();

function initAvatar(url) {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    45,
    avatarContainer.clientWidth / avatarContainer.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 2;

  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(avatarContainer.clientWidth, avatarContainer.clientHeight);
  avatarContainer.appendChild(renderer.domElement);

  const light = new THREE.HemisphereLight(0xffffff, 0x444444);
  light.position.set(0, 20, 0);
  scene.add(light);

  const loader = new THREE.GLTFLoader();
  loader.load(url, function (gltf) {
    avatar = gltf.scene;
    avatar.scale.set(1.5, 1.5, 1.5);
    scene.add(avatar);

    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(avatar);
      mixer.clipAction(gltf.animations[0]).play();
    }
  });

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  if (renderer) renderer.render(scene, camera);
}

// 👇 Load your avatar
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
