/* widget.js - Improved UI + Mascot choreography + optional 3D
   - Keep backend endpoints unchanged
   - Exposes window._mascot.queueActions([...]) and .triggerAction()
   - Lazy-loads model-viewer only if using GLB (config.placeholderGLB)
*/

(function () {
  const cfg = window.MASCOT_CONFIG || {};
  const BACKEND = cfg.backend ? cfg.backend.replace(/\/$/, '') : '';
  const UPLOAD = cfg.upload || (BACKEND ? BACKEND + '/mascot/upload' : '');
  const PLACEHOLDER_GLB = cfg.placeholderGLB || (window.PLACEHOLDER_GLB || null);

  // elements
  const panel = document.getElementById('mascot-panel');
  const toggleBtn = document.getElementById('mascot-toggle');
  const minimizeBtn = document.getElementById('minimize-btn');
  const closeBtn = document.getElementById('close-btn');
  const chatBody = document.getElementById('chat-body');
  const sendBtn = document.getElementById('send-btn');
  const chatInput = document.getElementById('chat-input');
  const muteBtn = document.getElementById('mute-btn');
  const uploadInput = document.getElementById('mascot-upload');
  const avatarSvg = document.getElementById('avatar-svg');
  const avatarImg = document.getElementById('avatar-img');
  const floating = document.getElementById('floating-mascot');
  const floatingImg = document.getElementById('floating-img');
  const modelContainer = document.getElementById('model-container');
  const floatingModel = document.getElementById('floating-model');
  const toggleAvatar = document.getElementById('toggle-avatar');
  const statusEl = document.getElementById('status');

  const useEndpoint = BACKEND ? BACKEND + '/api/message' : '/api/message';
  const fallbackEndpoint = BACKEND ? BACKEND + '/api/chat' : '/api/chat';

  // internal state
  let muted = false;
  let pending = false;
  let actionQueue = [];
  let currentAction = null;
  let modelViewerLoaded = false;
  let usingGLB = false;

  // helpers
  function log(...a){ console.log('[mascot-widget]', ...a); }
  function setStatus(t){ statusEl.textContent = t || 'Ready'; }

  // messaging UI
  function appendMessage(from, text) {
    const wrap = document.createElement('div');
    wrap.className = 'message';
    const box = document.createElement('div');
    box.className = from === 'user' ? 'msg-user' : 'msg-bot';
    box.textContent = text;
    wrap.appendChild(box);
    chatBody.appendChild(wrap);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // typing indicator (small)
  function showTyping() {
    const el = document.createElement('div');
    el.className = 'message typing';
    el.dataset.typing = '1';
    el.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
    return el;
  }
  function removeTyping(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

  // Floating mascot control (image or model)
  function showFloating(url) {
    // if GLB mode, ensure floatingModel visible
    if (usingGLB) {
      floatingModel.classList.remove('hidden');
      floatingImg.classList.add('hidden');
    } else {
      floatingImg.src = url || avatarImg.src || '';
      floatingImg.classList.remove('hidden');
      floatingModel.classList.add('hidden');
    }
    floating.classList.remove('hidden');
    requestAnimationFrame(() => floating.classList.add('show'));
  }
  function hideFloating() {
    floating.classList.remove('show');
    setTimeout(() => floating.classList.add('hidden'), 360);
  }

  // choreography / action queue
  function queueActions(actions = []) {
    if (!Array.isArray(actions)) actions = [actions];
    actionQueue.push(...actions.map(a => String(a)));
    // start runner if idle
    if (!currentAction) runNextAction();
  }

  function runNextAction() {
    if (currentAction) return;
    const next = actionQueue.shift();
    if (!next) return;
    currentAction = next;
    runAction(next).finally(() => {
      currentAction = null;
      // slight delay before next to avoid immediate jank
      setTimeout(runNextAction, 240);
    });
  }

  // runAction plays the animation and resolves once finished
  function runAction(action) {
    return new Promise((resolve) => {
      const a = String(action || '').toLowerCase();
      // show floating mascot (choose image or model)
      showFloating(avatarImg.src || '');
      // clear any leftover classes
      floating.classList.remove('dance', 'sing', 'walk', 'wave', 'pop');
      // animate based on action
      if (a.includes('dance')) {
        floating.classList.add('dance');
        // if GLB model supports animations we'd trigger it here (best-effort)
        if (usingGLB && modelViewerLoaded && window.__modelViewer) {
          try { window.__modelViewer.play(); } catch(e) { /* ignore */ }
        }
        setTimeout(() => {
          hideFloating();
          resolve();
        }, 3800);
      } else if (a.includes('sing') || a.includes('tts') || a.includes('speak')) {
        floating.classList.add('sing');
        setTimeout(() => {
          hideFloating();
          resolve();
        }, 3000);
      } else if (a.includes('walk')) {
        floating.classList.add('walk');
        setTimeout(() => {
          hideFloating();
          resolve();
        }, 2400);
      } else if (a.includes('wave') || a.includes('hello')) {
        floating.classList.add('wave');
        setTimeout(() => {
          hideFloating();
          resolve();
        }, 2200);
      } else {
        // default brief pop
        floating.classList.add('pop');
        setTimeout(() => {
          hideFloating();
          resolve();
        }, 1500);
      }
    });
  }

  // attempt to lazy load model-viewer if needed
  async function ensureModelViewer() {
    if (modelViewerLoaded) return;
    if (!PLACEHOLDER_GLB) return;
    try {
      // load script
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
      // create model-viewer element
      const mv = document.createElement('model-viewer');
      mv.setAttribute('src', PLACEHOLDER_GLB);
      mv.setAttribute('alt', 'mascot 3d');
      mv.setAttribute('auto-rotate', '');
      mv.setAttribute('camera-controls', '');
      mv.setAttribute('style', 'width:120px;height:120px;border-radius:12px;');
      mv.setAttribute('exposure', '1');
      // append to floating-model and modelContainer
      modelContainer.innerHTML = '';
      modelContainer.appendChild(mv);
      floatingModel.innerHTML = '';
      floatingModel.appendChild(mv.cloneNode(true)); // floating copy
      // store global ref if needed
      window.__modelViewer = mv;
      modelViewerLoaded = true;
      usingGLB = true;
      log('model-viewer loaded (placeholder GLB used)');
    } catch (e) {
      console.warn('model-viewer failed to load', e);
      modelViewerLoaded = false;
      usingGLB = false;
    }
  }

  // TTS playback helper
  async function speak(textOrUrl) {
    if (muted) return;
    try {
      if (!textOrUrl) return;
      if (String(textOrUrl).startsWith('data:') || String(textOrUrl).startsWith('http')) {
        const a = new Audio(textOrUrl);
        await a.play().catch(()=>{/*ignore*/});
      } else if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(String(textOrUrl));
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    } catch (e) { console.warn('speak error', e); }
  }

  // network call (POST to /api/message)
  async function sendMessageText(text) {
    if (!text || pending) return;
    pending = true;
    setStatus('Thinking...');
    const typing = showTyping();
    appendMessage('user', text);

    // micro pop
    showFloating(avatarImg.src || '');
    floating.classList.add('sing');
    setTimeout(()=> floating.classList.remove('sing'), 600);

    try {
      const resp = await fetch(useEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!resp.ok) {
        // try fallback
        if (fallbackEndpoint) {
          const resp2 = await fetch(fallbackEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
          });
          if (resp2.ok) {
            const j2 = await resp2.json();
            removeTyping(typing);
            handleBackendReply(j2);
            return;
          } else {
            throw new Error('fallback failed ' + resp2.status);
          }
        }
        throw new Error('server error ' + resp.status);
      }

      const j = await resp.json();
      removeTyping(typing);
      handleBackendReply(j);
    } catch (err) {
      removeTyping(typing);
      console.error('sendMessage error', err);
      appendMessage('bot', '⚠️ Error contacting server');
      setStatus('Error');
      runAction('wave');
    } finally {
      pending = false;
      setStatus('Ready');
    }
  }

  // handle backend reply; supports text, ttsUrl, action, actions[], uploaded_image_url
  async function handleBackendReply(j) {
    const reply = j.text || j.reply || (j.choices && j.choices[0] && (j.choices[0].message?.content || j.choices[0].text)) || 'No reply';
    appendMessage('bot', reply);

    const tts = j.ttsUrl || j.audio || j.tts || null;
    if (tts) speak(tts);
    else if (reply) speak(reply);

    // queue actions if provided
    if (Array.isArray(j.actions) && j.actions.length) {
      queueActions(j.actions);
    } else if (j.action) {
      queueActions([j.action]);
    }

    // update avatar image if provided
    if (j.uploaded_image_url) {
      avatarImg.src = j.uploaded_image_url;
      avatarImg.classList.remove('hidden');
      avatarSvg.classList.add('hidden');
      floatingImg.src = j.uploaded_image_url;
      toggleAvatar.src = j.uploaded_image_url;
      // celebrate a little
      queueActions(['dance']);
    }
  }

  // UI events wiring
  toggleBtn.addEventListener('click', () => {
    const closed = panel.classList.toggle('closed');
    toggleBtn.setAttribute('aria-expanded', (!closed).toString());
    if (!closed) chatInput.focus();
  });
  minimizeBtn.addEventListener('click', () => panel.classList.add('closed'));
  closeBtn.addEventListener('click', () => panel.classList.add('closed'));

  // debounced send (avoid duplicates)
  let lastSend = 0;
  sendBtn.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastSend < 400) return; // quick guard
    lastSend = now;
    const txt = (chatInput.value || '').trim();
    if (!txt) return;
    chatInput.value = '';
    sendMessageText(txt);
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
  });

  document.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => {
      chatInput.value = c.dataset.q || '';
      sendBtn.click();
    });
  });

  // upload handling (preview + POST)
  uploadInput.addEventListener('change', async (ev) => {
    const file = ev.target.files && ev.target.files[0]; if (!file) return;
    appendMessage('bot', 'Uploading mascot...');
    // show preview immediately
    const preview = URL.createObjectURL(file);
    showFloating(preview);

    try {
      const form = new FormData(); form.append('mascot', file);
      const r = await fetch(UPLOAD || '/mascot/upload', { method: 'POST', body: form });
      if (!r.ok) { appendMessage('bot', 'Upload failed'); queueActions(['wave']); return; }
      const j = await r.json();
      if (j.uploaded_image_url) {
        avatarImg.src = j.uploaded_image_url;
        avatarImg.classList.remove('hidden');
        avatarSvg.classList.add('hidden');
        floatingImg.src = j.uploaded_image_url;
        toggleAvatar.src = j.uploaded_image_url;
        appendMessage('bot', 'Mascot uploaded ✅');
        queueActions(['dance']);
      } else {
        appendMessage('bot', 'Uploaded (no preview returned)');
      }
    } catch (e) {
      console.error('upload error', e);
      appendMessage('bot', 'Upload failed ⚠️');
      queueActions(['wave']);
    }
  });

  // initial message
  appendMessage('bot', 'Hi — I am your mascot assistant. Try "dance", "wave", or upload your mascot.');

  // public API
  window._mascot = {
    queueActions,
    triggerAction: (a) => queueActions([a]),
    setAvatar: (url) => {
      avatarImg.src = url;
      avatarImg.classList.remove('hidden');
      avatarSvg.classList.add('hidden');
      floatingImg.src = url;
      toggleAvatar.src = url;
    },
    // optional: enable GLB support (lazy loads model-viewer and switches to 3D)
    enableGLB: async () => {
      await ensureModelViewer();
    }
  };

  // If user configured placeholder GLB and wants 3D, load it in background
  if (PLACEHOLDER_GLB) {
    // do not block UI; load on idle
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => ensureModelViewer());
    } else {
      setTimeout(() => ensureModelViewer(), 2000);
    }
  }

})();
