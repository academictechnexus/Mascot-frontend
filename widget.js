/* widget.js - updated UI & mascot animation integration
   - Reads backend from window.MASCOT_CONFIG.backend
   - Uses POST /api/message (fallback to /api/chat)
   - Triggers CSS classes on .avatar for 'dance', 'sing', 'wave' actions
   - Preserves original upload behavior: POST to window.MASCOT_CONFIG.upload
*/

(function(){
  // config (must be set by host page or index.html)
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
  const avatarMouth = document.getElementById("avatar-mouth");
  const statusEl = document.getElementById("status");
  const toggleAvatar = document.getElementById("toggle-avatar");

  // state
  let muted = false;
  let pending = false;
  let useEndpoint = BACKEND ? (BACKEND + '/api/message') : '/api/message';

  // fallback: if /api/message fails and backend provides /api/chat, we can try that
  const fallbackEndpoint = BACKEND ? (BACKEND + '/api/chat') : '/api/chat';

  // helpers
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

  function triggerMascotAction(action) {
    avatarEl.classList.remove('dance','sing','wave');
    if (!action) return;
    // map a few common tokens
    const a = String(action).toLowerCase();
    if (a.includes('dance')) {
      avatarEl.classList.add('dance');
      setTimeout(()=> avatarEl.classList.remove('dance'), 4000);
    } else if (a.includes('sing') || a.includes('tts') || a.includes('speak')) {
      avatarEl.classList.add('sing');
      setTimeout(()=> avatarEl.classList.remove('sing'), 5000);
    } else if (a.includes('wave') || a.includes('hello')) {
      avatarEl.classList.add('wave');
      setTimeout(()=> avatarEl.classList.remove('wave'), 3000);
    }
  }

  // speech (play audio base64 or url)
  async function speak(textOrUrl) {
    if (muted) return;
    try {
      if (!textOrUrl) {
        // simple speech synthesis fallback
        if ('speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(String(textOrUrl || ''));
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
        }
        return;
      }
      // if it's a data: or http url, play via audio element
      if (String(textOrUrl).startsWith('data:') || String(textOrUrl).startsWith('http')) {
        const a = new Audio(textOrUrl);
        a.play().catch(e => console.warn('TTS play failed', e));
      } else {
        // otherwise use speechSynthesis to speak plain text
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

  // send message to backend
  async function sendMessageText(text) {
    if (!text || pending) return;
    pending = true;
    setStatus('Thinking...');
    appendMessage('user', text);
    // optimistic avatar nod / small micro-interaction
    avatarEl.classList.add('sing');
    setTimeout(()=> avatarEl.classList.remove('sing'), 800);

    try {
      const resp = await fetch(useEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!resp.ok) {
        // try fallback if available
        if (useEndpoint !== fallbackEndpoint && fallbackEndpoint) {
          console.warn('primary endpoint failed, trying fallback', resp.status);
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
    } finally {
      pending = false;
      setStatus('Ready');
    }
  }

  function handleBackendReply(j) {
    // expected shapes: { text, ttsUrl } or { reply, action } etc.
    const replyText = j.text || j.reply || j?.choices?.[0]?.message?.content || (j?.choices?.[0]?.text) || 'No reply';
    appendMessage('bot', replyText);

    // if TTS url provided either as ttsUrl or audio or data
    const tts = j.ttsUrl || j.tts || j.audio || null;
    if (tts) speak(tts);
    else {
      // if backend didn't provide tts but provided 'action' or short replies, try speechSynthesis
      if (replyText && !muted) speak(replyText);
    }

    // trigger animation based on backend action field (if returned)
    const action = j.action || j.intent || null;
    if (action) triggerMascotAction(action);

    // if backend returned a new GLB or avatar image url, update avatar
    if (j.uploaded_image_url) {
      avatarImg.src = j.uploaded_image_url;
      toggleAvatar.src = j.uploaded_image_url;
    }
  }

  // attach events
  toggleBtn.addEventListener('click', ()=>{
    const closed = panel.classList.toggle('closed');
    toggleBtn.setAttribute('aria-expanded', (!closed).toString());
  });

  minimizeBtn.addEventListener('click', ()=> {
    panel.classList.add('closed');
  });
  closeBtn.addEventListener('click', ()=> {
    panel.classList.add('closed');
  });

  sendBtn.addEventListener('click', ()=> {
    const text = (chatInput.value || '').trim();
    if (!text) return;
    chatInput.value = '';
    sendMessageText(text);
  });

  chatInput.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  muteBtn.addEventListener('click', ()=>{
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
  });

  // chips
  document.querySelectorAll('.chip').forEach(c=>{
    c.addEventListener('click', ()=> {
      const q = c.dataset.q;
      if (!q) return;
      chatInput.value = q;
      sendBtn.click();
    });
  });

  // upload
  uploadInput.addEventListener('change', async (ev)=>{
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    appendMessage('bot', 'Uploading mascot...');
    try {
      const form = new FormData();
      form.append('mascot', file);
      const r = await fetch(UPLOAD || '/mascot/upload', { method: 'POST', body: form });
      if (!r.ok) {
        appendMessage('bot', 'Upload failed');
        return;
      }
      const j = await r.json();
      if (j.uploaded_image_url) {
        avatarImg.src = j.uploaded_image_url;
        toggleAvatar.src = j.uploaded_image_url;
        appendMessage('bot', 'Mascot uploaded ✅');
      } else {
        appendMessage('bot', 'Upload done (no preview returned)');
      }
    } catch (e) {
      console.error('upload error', e);
      appendMessage('bot', 'Upload failed ⚠️');
    }
  });

  // simple welcome
  appendMessage('bot', 'Hello! I am your mascot assistant — try "dance" or "wave".');

  // small accessibility: focus textarea on open
  panel.addEventListener('transitionend', ()=>{
    if (!panel.classList.contains('closed')) {
      chatInput.focus();
    }
  });

  // expose for debugging
  window._mascot = {
    sendMessage: sendMessageText,
    triggerAction: triggerMascotAction,
    setAvatar: function(url){ avatarImg.src=url; toggleAvatar.src=url; }
  };

})();
