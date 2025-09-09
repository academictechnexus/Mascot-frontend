// widget.js - Right-side Panel logic (full)
const BACKEND_FALLBACK = "https://mascot.academictechnexus.com/api/chat";
const BACKEND_URL = (function () {
  try {
    const currentScript =
      document.currentScript ||
      Array.from(document.scripts).find((s) => s.src && s.src.indexOf("widget.js") !== -1);
    if (currentScript) {
      const dataBackend = currentScript.getAttribute("data-backend");
      if (dataBackend && dataBackend.trim()) return dataBackend.trim();
    }
  } catch (e) {}
  if (window.MASCOT_CONFIG && window.MASCOT_CONFIG.backend) return window.MASCOT_CONFIG.backend;
  return BACKEND_FALLBACK;
})();

async function callChat(payload, timeoutMs = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Backend ${resp.status}: ${text}`);
    }
    return await resp.json();
  } catch (err) {
    clearTimeout(id);
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
let mascotImg = document.getElementById("mascot-img"); // optional 2D img
let storeId = null;

(function () {
  try {
    const s = Array.from(document.scripts).find((s) => s.src && s.src.indexOf("widget.js") !== -1);
    if (s) storeId = s.getAttribute("data-store-id") || null;
    if (!storeId && window.MASCOT_CONFIG) storeId = window.MASCOT_CONFIG.store_id || null;
  } catch (e) {}
})();

/* conversation + queue */
let pending = false;
let requestQueue = [];
let conversation = [];
try {
  const saved = localStorage.getItem("mascot_conv_v1");
  if (saved) conversation = JSON.parse(saved);
  conversation.forEach(msg => appendMessage(msg.sender, msg.text, msg.meta));
} catch (e) {}

function persistConversation() {
  try { localStorage.setItem("mascot_conv_v1", JSON.stringify(conversation.slice(-200))); } catch(e) {}
}

function appendMessage(sender, text, meta) {
  const el = document.createElement("div");
  el.className = "message " + (sender === "user" ? "user" : "bot");
  el.innerHTML = `<div class="text">${escapeHtml(text)}</div>`;
  if (meta) el.innerHTML += `<div class="time">${escapeHtml(meta)}</div>`;
  chatBody.appendChild(el);
  chatBody.scrollTop = chatBody.scrollHeight;
  if (sender === "bot") {
    el.classList.add("highlight");
    setTimeout(() => el.classList.remove("highlight"), 900);
  }
  conversation.push({ sender, text, meta });
  persistConversation();
}
function escapeHtml(s){ return String(s).replace(/[&<>"'`]/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;","`":"&#96;" }[m])); }

function setPending(v) {
  pending = !!v;
  sendBtn.disabled = pending;
  sendBtn.style.opacity = pending ? 0.6 : 1;
}

/* TTS and animation triggers */
let _speechUtterance = null;
function speakWithAnim(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    _speechUtterance = u;
    u.onstart = () => {
      triggerMascotAction('talk-start');
      triggerAvatarAction('talk-start');
    };
    u.onend = () => {
      triggerMascotAction('talk-end');
      triggerAvatarAction('talk-end');
    };
    window.speechSynthesis.speak(u);
  } catch (e) { console.warn("TTS error", e); }
}

/* mascot 2D */
function triggerMascotAction(action, duration = 1800) {
  if (!mascotImg) return;
  mascotImg.classList.remove('mascot-dance','mascot-walk','mascot-talking');
  if (action === 'dance') {
    mascotImg.classList.add('mascot-dance');
    setTimeout(()=>mascotImg.classList.remove('mascot-dance'), duration);
  } else if (action === 'walk') {
    mascotImg.classList.add('mascot-walk');
    setTimeout(()=>mascotImg.classList.remove('mascot-walk'), duration);
  } else if (action === 'talk-start') {
    mascotImg.classList.add('mascot-talking');
  } else if (action === 'talk-end') {
    mascotImg.classList.remove('mascot-talking');
  }
}

/* avatar 3D simple handling */
let avatarState = { initialized:false, mixer:null, scene:null, avatarObj:null, renderer:null, camera:null };
function triggerAvatarAction(action, duration = 1800) {
  if (!avatarState.initialized) return;
  try {
    if (avatarState.mixer && avatarState.avatarObj) {
      const clips = avatarState.mixer._clips || avatarState.avatarObj.animations || [];
      const clipName = (action === 'dance' ? 'Dance' : action === 'walk' ? 'Walk' : null);
      if (clipName) {
        const clip = THREE.AnimationClip.findByName(clips, clipName);
        if (clip) {
          const actionObj = avatarState.mixer.clipAction(clip);
          actionObj.reset().play();
          setTimeout(()=>actionObj.fadeOut(0.6), duration);
          return;
        }
      }
    }
    if (avatarState.avatarObj) {
      const obj = avatarState.avatarObj;
      const start = performance.now();
      const initialY = obj.rotation.y || 0;
      function pulse(ts) {
        const t = ts - start;
        const p = Math.sin(t/120) * 0.12;
        obj.rotation.y = initialY + p;
        if (t < duration) requestAnimationFrame(pulse);
        else obj.rotation.y = initialY;
      }
      requestAnimationFrame(pulse);
    }
  } catch(e) { console.warn("avatar action error", e); }
}

function initAvatarLazy(glbUrl) {
  if (avatarState.initialized) return;
  avatarState.initialized = true;
  avatarLoader.innerText = "Loading avatar...";
  const script1 = document.createElement("script");
  script1.src = "https://cdn.jsdelivr.net/npm/three@0.156.1/build/three.min.js";
  script1.onload = () => {
    const s2 = document.createElement("script");
    s2.src = "https://cdn.jsdelivr.net/npm/three@0.156.1/examples/js/loaders/GLTFLoader.js";
    s2.onload = () => {
      try {
        const THREE = window.THREE;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 110/140, 0.1, 1000);
        camera.position.z = 2.2;
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias:true });
        renderer.setSize(110, 140);
        avatarContainer.innerHTML = ""; avatarContainer.appendChild(renderer.domElement);
        const light = new THREE.HemisphereLight(0xffffff, 0x444444);
        light.position.set(0,20,0); scene.add(light);
        const loader = new THREE.GLTFLoader();
        loader.load(glbUrl, (gltf) => {
          const avatar = gltf.scene;
          avatar.scale.set(1.2,1.2,1.2);
          scene.add(avatar);
          let mixer = null;
          if (gltf.animations && gltf.animations.length) {
            mixer = new THREE.AnimationMixer(avatar);
            mixer.clipAction(gltf.animations[0]).play();
          }
          avatarState = { initialized:true, mixer, scene, avatarObj:avatar, renderer, camera };
          avatarLoader.style.display = "none";
          const clock = new THREE.Clock();
          (function animate(){
            requestAnimationFrame(animate);
            if (mixer) mixer.update(clock.getDelta());
            renderer.render(scene, camera);
          })();
        }, undefined, (err)=> {
          avatarContainer.innerText = "Avatar failed";
          console.warn("avatar load err", err);
        });
      } catch(e) { console.warn("avatar init exception", e); avatarContainer.innerText = "Avatar err"; }
    };
    document.body.appendChild(s2);
  };
  document.body.appendChild(script1);
}

/* queue & send */
async function enqueueSend(messageText) {
  requestQueue.push({ text: messageText, tries:0 });
  processQueue();
}
async function processQueue() {
  if (pending || requestQueue.length === 0) return;
  const item = requestQueue.shift();
  pending = true;
  setPending(true);

  try {
    const payload = { message: item.text };
    if (storeId) payload.store_id = storeId;
    const res = await callChat(payload);
    let replyText = '';
    let action = null;
    if (typeof res === 'string') replyText = res;
    else if (res.text || res.reply) {
      replyText = res.text || res.reply;
      if (res.action) action = res.action;
      else if (res.actions && res.actions.length) action = res.actions[0];
    } else {
      replyText = JSON.stringify(res).slice(0,300);
    }

    const t = Array.from(document.getElementsByClassName('typing'));
    t.forEach(e => e.remove());

    appendMessage('bot', replyText);
    const inline = replyText.match(/\[(dance|walk|wave|jump)\]/i);
    if (inline && !action) action = inline[1].toLowerCase();

    if (action) {
      triggerMascotAction(action, 2500);
      triggerAvatarAction(action, 2500);
    }
    if (!document.hidden) { speakWithAnim(replyText); }
    else { triggerMascotAction('dance',1200); }
  } catch (err) {
    console.error("send error", err);
    appendMessage('bot', '⚠️ Could not reach backend. Try again.');
  } finally {
    pending = false;
    setPending(false);
    setTimeout(processQueue, 150);
  }
}

/* wire events */
sendBtn && sendBtn.addEventListener('click', () => {
  const text = chatInput.value && chatInput.value.trim();
  if (!text) return;
  appendMessage('user', text);
  chatInput.value = '';
  const t = document.createElement('div'); t.className='message bot typing'; t.innerText='…'; chatBody.appendChild(t);
  chatBody.scrollTop = chatBody.scrollHeight;
  enqueueSend(text);
});
chatInput && chatInput.addEventListener('keypress', (e)=> { if (e.key === 'Enter') sendBtn.click(); });

toggleBtn && toggleBtn.addEventListener('click', () => {
  panel.classList.remove('closed');
  initAvatarLazy("https://models.readyplayer.me/68b5e67fbac430a52ce1260e.glb");
});
minimizeBtn && minimizeBtn.addEventListener('click', () => panel.classList.add('closed'));
closeBtn && closeBtn.addEventListener('click', () => panel.classList.add('closed'));
openStoreBtn && openStoreBtn.addEventListener('click', () => {
  if (storeId) window.open(`https://${storeId}.myshopify.com`, "_blank"); else window.open("/", "_blank");
});

/* upload */
uploadBtn && uploadBtn.addEventListener('click', ()=> uploadInput.click());
uploadInput && uploadInput.addEventListener('change', (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target.result;
    if (!mascotImg) {
      avatarContainer.innerHTML = `<img id="mascot-img" class="mascot-img" src="${data}" alt="Mascot preview">`;
      mascotImg = document.getElementById("mascot-img");
    } else { mascotImg.src = data; }
    triggerMascotAction('walk', 800);
    setTimeout(()=> triggerMascotAction('dance', 2200), 900);
  };
  reader.readAsDataURL(file);
});

/* init */
(function widgetInit() {
  panel.classList.add('closed');
  appendMessage('bot', 'Hi! I can help with products, orders and shipping. Ask me anything!');
})();
