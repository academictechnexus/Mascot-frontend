/* widget.js - Visily-like UI + mascot pop-out + actions
   - Replace existing widget.js with this file
   - Uses window.MASCOT_CONFIG.backend & .upload if provided
   - Triggers floating mascot actions based on backend 'action' value
*/

(function () {
  const BACKEND = (window.MASCOT_CONFIG && window.MASCOT_CONFIG.backend) ? window.MASCOT_CONFIG.backend.replace(/\/$/, '') : '';
  const UPLOAD = (window.MASCOT_CONFIG && window.MASCOT_CONFIG.upload) ? window.MASCOT_CONFIG.upload : (BACKEND ? BACKEND + '/mascot/upload' : '');

  // elements
  const panel = document.getElementById("mascot-panel");
  const toggleBtn = document.getElementById("mascot-toggle");
  const minimizeBtn = document.getElementById("minimize-btn");
  const closeBtn = document.getElementById("close-btn");
  const chatBody = document.getElementById("chat-body");
  const sendBtn = document.getElementById("send-btn");
  const chatInput = document.getElementById("chat-input");
  const muteBtn = document.getElementById("mute-btn");
  const uploadInput = document.getElementById("mascot-upload");
  const avatarEl = document.getElementById("avatar");
  const avatarImg = document.getElementById("avatar-img");
  const floating = document.getElementById("floating-mascot");
  const floatingImg = document.getElementById("floating-img");
  const statusEl = document.getElementById("status");
  const toggleAvatar = document.getElementById("toggle-avatar");

  let muted = false;
  let pending = false;
  let useEndpoint = BACKEND ? (BACKEND + '/api/message') : '/api/message';
  const fallbackEndpoint = BACKEND ? (BACKEND + '/api/chat') : '/api/chat';

  /* utility: append message */
  function appendMessage(cls, text) {
    const wrap = document.createElement('div');
    wrap.className = 'message';
    const box = document.createElement('div');
    box.className = cls === 'user' ? 'msg-user' : 'msg-bot';
    box.textContent = text;
    wrap.appendChild(box);
    chatBody.appendChild(wrap);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function setStatus(t) {
    statusEl.textContent = t || 'Ready';
  }

  /* Floating mascot helpers */
  function showFloating(url) {
    if (!floating) return;
    floatingImg.src = url || avatarImg.src || 'default-mascot.png';
    floating.classList.remove('hidden');
    // small delay to allow CSS transitions
    requestAnimationFrame(()=> floating.classList.add('show'));
  }

  function hideFloating() {
    if (!floating) return;
    floating.classList.remove('show');
    // after transition hide to remove from layout
    setTimeout(()=> floating.classList.add('hidden'), 320);
  }

  function runFloatingAction(action) {
    if (!floating) return;
    const a = String(action || '').toLowerCase();
    floating.classList.remove('dance','sing','wave','walk','active');
    // ensure floating visible
    showFloating();
    if (a.includes('dance')) {
      floating.classList.add('dance','active');
      setTimeout(hideFloating, 3600);
    } else if (a.includes('sing') || a.includes('tts') || a.includes('speak')) {
      floating.classList.add('sing','active');
      setTimeout(hideFloating, 3200);
    } else if (a.includes('wave') || a.includes('hello')) {
      floating.classList.add('wave','active');
      setTimeout(hideFloating, 2600);
    } else if (a.includes('walk')) {
      floating.classList.add('walk','active');
      setTimeout(hideFloating, 2600);
    } else {
      // default tiny pop & return
      floating.classList.add('sing','active');
      setTimeout(hideFloating, 1800);
    }
  }

  /* speech / TTS */
  async function speak(textOrUrl) {
    if (muted) return;
    try {
      if (!textOrUrl) {
        if ('speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(String(textOrUrl || ''));
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
        }
        return;
      }
      if (String(textOrUrl).startsWith('data:') || String(textOrUrl).startsWith('http')) {
        const a = new Audio(textOrUrl);
        a.play().catch(e => console.warn('TTS play failed', e));
      } else {
        if ('speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(String(textOrUrl));
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
        }
      }
    } catch (e) {
      console.warn('speak error', e);
    }
  }

  /* Send message to backend (keeps same shapes) */
  async function sendMessageText(text) {
    if (!text || pending) return;
    pending = true;
    setStatus('Thinking...');
    appendMessage('user', text);

    // micro-interaction
    showFloating(avatarImg.src);
    floating.classList.add('sing');
    setTimeout(()=> floating.classList.remove('sing'), 700);

    try {
      const resp = await fetch(useEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!resp.ok) {
        if (useEndpoint !== fallbackEndpoint && fallbackEndpoint) {
          console.warn('primary failed, trying fallback', resp.status);
          const resp2 = await fetch(fallbackEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
          });
          if (resp2.ok) {
            const j2 = await resp2.json();
            handleBackendReply(j2);
            return;
          } else {
            throw new Error('fallback failed: ' + resp2.status);
          }
        }
        throw new Error('Server error: ' + resp.status);
      }

      const j = await resp.json();
      handleBackendReply(j);
    } catch (err) {
      console.error('sendMessageText error', err);
      appendMessage('bot', '⚠️ Error contacting server');
      setStatus('Error');
      // small sad reaction
      runFloatingAction('wave');
    } finally {
      pending = false;
      setStatus('Ready');
    }
  }

  function handleBackendReply(j) {
    const replyText = j.text || j.reply || j?.choices?.[0]?.message?.content || j?.choices?.[0]?.text || 'No reply';
    appendMessage('bot', replyText);

    // TTS if provided or fallback to speech synthesis
    const tts = j.ttsUrl || j.tts || j.audio || null;
    if (tts) speak(tts);
    else if (replyText) speak(replyText);

    // handle action -> animate floating mascot
    const action = j.action || j.intent || null;
    if (action) {
      runFloatingAction(action);
    }

    // update avatar if backend returned uploaded_image_url
    if (j.uploaded_image_url) {
      avatarImg.src = j.uploaded_image_url;
      floatingImg.src = j.uploaded_image_url;
      toggleAvatar.src = j.uploaded_image_url;
    }
  }

  /* UI events */
  toggleBtn.addEventListener('click', () => {
    const closed = panel.classList.toggle('closed');
    toggleBtn.setAttribute('aria-expanded', (!closed).toString());
    if (!closed) {
      chatInput.focus();
    }
  });

  minimizeBtn.addEventListener('click', () => panel.classList.add('closed'));
  closeBtn.addEventListener('click', () => panel.classList.add('closed'));

  sendBtn.addEventListener('click', () => {
    const text = (chatInput.value || '').trim();
    if (!text) return;
    chatInput.value = '';
    sendMessageText(text);
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
      const q = c.dataset.q;
      if (!q) return;
      chatInput.value = q;
      sendBtn.click();
    });
  });

  /* Upload handler -> POST to backend upload endpoint (unchanged) */
  uploadInput.addEventListener('change', async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    appendMessage('bot', 'Uploading mascot...');
    showFloating(URL.createObjectURL(file));
    try {
      const form = new FormData();
      form.append('mascot', file);
      const r = await fetch(UPLOAD || '/mascot/upload', { method: 'POST', body: form });
      if (!r.ok) {
        appendMessage('bot', 'Upload failed');
        runFloatingAction('wave');
        return;
      }
      const j = await r.json();
      if (j.uploaded_image_url) {
        avatarImg.src = j.uploaded_image_url;
        floatingImg.src = j.uploaded_image_url;
        toggleAvatar.src = j.uploaded_image_url;
        appendMessage('bot', 'Mascot uploaded ✅');
        // do a celebratory dance when upload succeeds
        runFloatingAction('dance');
      } else {
        appendMessage('bot', 'Upload done (no preview returned)');
      }
    } catch (e) {
      console.error('upload error', e);
      appendMessage('bot', 'Upload failed ⚠️');
      runFloatingAction('wave');
    }
  });

  /* initial welcome */
  appendMessage('bot', 'Hi — I am your mascot assistant. Try typing "dance", "wave" or upload your mascot.');

  /* expose debugging API */
  window._mascot = {
    sendMessage: sendMessageText,
    triggerAction: runFloatingAction,
    setAvatar: function (url) { avatarImg.src = url; floatingImg.src = url; toggleAvatar.src = url; }
  };
})();
