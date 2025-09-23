/* widget.js - improved UI + mascot pop-out
   - Keep backend endpoints unchanged
   - Reads window.MASCOT_CONFIG.backend and .upload
   - Triggers floating mascot animation on upload or on backend `action`
*/

(function(){
  const BACKEND = (window.MASCOT_CONFIG && window.MASCOT_CONFIG.backend) ? window.MASCOT_CONFIG.backend.replace(/\/$/, '') : '';
  const UPLOAD = (window.MASCOT_CONFIG && window.MASCOT_CONFIG.upload) ? window.MASCOT_CONFIG.upload : (BACKEND ? BACKEND + '/mascot/upload' : '');

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
  const toggleAvatar = document.getElementById('toggle-avatar');
  const statusEl = document.getElementById('status');

  let muted = false, pending = false;
  const useEndpoint = BACKEND ? BACKEND + '/api/message' : '/api/message';
  const fallbackEndpoint = BACKEND ? BACKEND + '/api/chat' : '/api/chat';

  function setStatus(s){ statusEl.textContent = s || 'Ready'; }

  function appendMessage(who, content){
    const el = document.createElement('div');
    el.className = 'message';
    const b = document.createElement('div');
    b.className = who === 'user' ? 'msg-user' : 'msg-bot';
    b.textContent = content;
    el.appendChild(b);
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // Floating mascot helpers
  function showFloating(url){
    if(!floating) return;
    floatingImg.src = url || avatarImg.src || '';
    floating.classList.remove('hidden');
    requestAnimationFrame(()=> floating.classList.add('show'));
  }
  function hideFloating(){ if(!floating) return; floating.classList.remove('show'); setTimeout(()=> floating.classList.add('hidden'), 340); }

  function runFloatingAction(action){
    if(!floating) return;
    const a = String(action||'').toLowerCase();
    floating.classList.remove('dance','sing','wave','walk');
    showFloating(avatarImg.src || '');
    if(a.includes('dance')){ floating.classList.add('dance'); setTimeout(hideFloating, 3600); }
    else if(a.includes('sing')||a.includes('tts')||a.includes('speak')){ floating.classList.add('sing'); setTimeout(hideFloating,3200); }
    else if(a.includes('walk')){ floating.classList.add('walk'); setTimeout(hideFloating,2600); }
    else if(a.includes('wave')||a.includes('hello')){ floating.classList.add('wave'); setTimeout(hideFloating,2600); }
    else { floating.classList.add('sing'); setTimeout(hideFloating,1800); }
  }

  // TTS playback
  async function speak(urlOrText){
    if(muted) return;
    try{
      if(!urlOrText){
        return;
      }
      if(String(urlOrText).startsWith('data:') || String(urlOrText).startsWith('http')){
        const a = new Audio(urlOrText);
        await a.play().catch(()=>{/*ignore*/});
      } else if('speechSynthesis' in window){
        const u = new SpeechSynthesisUtterance(String(urlOrText));
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    }catch(e){ console.warn('speak error', e); }
  }

  // send message
  async function sendMessageText(text){
    if(!text || pending) return;
    pending = true;
    setStatus('Thinking...');
    appendMessage('user', text);
    // tiny pop
    showFloating('');
    floating.classList.add('sing');
    setTimeout(()=> floating.classList.remove('sing'), 700);

    try{
      const r = await fetch(useEndpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
      if(!r.ok){
        // fallback
        if(fallbackEndpoint){
          const r2 = await fetch(fallbackEndpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message: text }) });
          if(r2.ok){ const j2 = await r2.json(); handleBackendReply(j2); return; }
          else throw new Error('fallback failed: '+r2.status);
        }
        throw new Error('server error: '+r.status);
      }
      const j = await r.json();
      handleBackendReply(j);
    }catch(err){
      console.error(err);
      appendMessage('bot', '⚠️ Error contacting server');
      runFloatingAction('wave');
      setStatus('Error');
    }finally{ pending = false; setStatus('Ready'); }
  }

  function handleBackendReply(j){
    const reply = j.text || j.reply || (j.choices && j.choices[0] && (j.choices[0].message?.content || j.choices[0].text)) || 'No reply';
    appendMessage('bot', reply);

    const tts = j.ttsUrl || j.audio || j.tts || null;
    if(tts) speak(tts); else speak(reply);

    const action = j.action || j.intent || null;
    if(action) runFloatingAction(action);

    if(j.uploaded_image_url){
      // show uploaded image
      avatarImg.src = j.uploaded_image_url;
      avatarImg.classList.remove('hidden');
      avatarSvg.classList.add('hidden');
      floatingImg.src = j.uploaded_image_url;
      toggleAvatar.src = j.uploaded_image_url;
      // small celebration
      runFloatingAction('dance');
    }
  }

  // events
  toggleBtn.addEventListener('click', ()=>{
    const closed = panel.classList.toggle('closed');
    toggleBtn.setAttribute('aria-expanded', (!closed).toString());
    if(!closed) chatInput.focus();
  });
  minimizeBtn.addEventListener('click', ()=> panel.classList.add('closed'));
  closeBtn.addEventListener('click', ()=> panel.classList.add('closed'));

  sendBtn.addEventListener('click', ()=> { const txt=(chatInput.value||'').trim(); if(!txt) return; chatInput.value=''; sendMessageText(txt); });
  chatInput.addEventListener('keydown', (e)=> { if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendBtn.click(); } });

  muteBtn.addEventListener('click', ()=> { muted = !muted; muteBtn.textContent = muted ? '🔇' : '🔊'; });

  document.querySelectorAll('.chip').forEach(c=> c.addEventListener('click', ()=> { const q=c.dataset.q; if(!q) return; chatInput.value=q; sendBtn.click(); }));

  // upload
  uploadInput.addEventListener('change', async (ev)=>{
    const file = ev.target.files && ev.target.files[0]; if(!file) return;
    appendMessage('bot', 'Uploading mascot...');
    // show local preview then upload
    const url = URL.createObjectURL(file);
    showFloating(url);
    try{
      const fm = new FormData(); fm.append('mascot', file);
      const r = await fetch(UPLOAD || '/mascot/upload', { method:'POST', body: fm });
      if(!r.ok){ appendMessage('bot', 'Upload failed'); runFloatingAction('wave'); return; }
      const j = await r.json();
      if(j.uploaded_image_url){
        avatarImg.src = j.uploaded_image_url; avatarImg.classList.remove('hidden'); avatarSvg.classList.add('hidden');
        floatingImg.src = j.uploaded_image_url; toggleAvatar.src = j.uploaded_image_url;
        appendMessage('bot', 'Mascot uploaded ✅');
        runFloatingAction('dance');
      } else { appendMessage('bot','Upload done (no preview returned)'); }
    }catch(e){ console.error(e); appendMessage('bot','Upload failed ⚠️'); runFloatingAction('wave'); }
  });

  // initial greeting
  appendMessage('bot', 'Hi — I am your mascot assistant. Try "dance", "wave", or upload your mascot.');

  // expose debug API
  window._mascot = { sendMessage: sendMessageText, triggerAction: runFloatingAction, setAvatar: (url)=>{ avatarImg.src=url; avatarImg.classList.remove('hidden'); avatarSvg.classList.add('hidden'); floatingImg.src=url; toggleAvatar.src=url; } };

})();
