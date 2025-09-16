// widget.js (replace your existing file with this)
// Expects: export const BASE_URL, export const CALENDLY_LINK in config.js
import { BASE_URL, CALENDLY_LINK } from './config.js';

/**
 * Robust widget script
 * - waits for DOM ready
 * - ensures elements exist (retries)
 * - attaches handlers safely
 * - loads Lottie if needed
 * - interacts with backend /api/message and /api/lead
 */

(function () {
  const MAX_RETRIES = 12;
  const RETRY_DELAY = 300;
  let tries = 0;
  let sessionId = 's_' + Math.random().toString(36).slice(2, 9);
  let audioEl = null;
  let lottieAnim = null;
  let listening = false;

  // Utility: wait for element
  function waitForEl(id) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const t = setInterval(() => {
        const el = document.getElementById(id);
        if (el) {
          clearInterval(t);
          resolve(el);
        } else if (++attempts >= MAX_RETRIES) {
          clearInterval(t);
          reject(new Error(`Element #${id} not found after ${MAX_RETRIES} attempts`));
        }
      }, RETRY_DELAY);
    });
  }

  // Load Lottie CDN if not present
  function ensureLottie() {
    return new Promise((resolve) => {
      if (window.lottie) return resolve(window.lottie);
      const src = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.9.6/lottie.min.js';
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(window.lottie);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }

  // Safe JSON fetch wrapper
  async function postJson(url, payload, timeoutMs = 60000) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      clearTimeout(id);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  // UI helpers
  function pushMessage(container, text, who = 'bot') {
    if (!container) return;
    const el = document.createElement('div');
    el.className = `msg ${who === 'bot' ? 'bot' : 'user'}`;
    el.textContent = text;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  function replaceLastBotText(container, text) {
    const bots = container.querySelectorAll('.msg.bot');
    if (bots.length) bots[bots.length - 1].textContent = text;
    else pushMessage(container, text, 'bot');
    container.scrollTop = container.scrollHeight;
  }

  // Open/close logic
  function setPanelOpen(panel, open) {
    if (!panel) return;
    if (open) {
      panel.classList.remove('closed');
      panel.setAttribute('aria-hidden', 'false');
    } else {
      panel.classList.add('closed');
      panel.setAttribute('aria-hidden', 'true');
    }
  }

  // Play TTS URL (data: or external)
  function playAudio(url, onEnded) {
    try {
      if (audioEl) {
        try { audioEl.pause(); } catch (e) { /*ignore*/ }
        audioEl = null;
      }
      audioEl = new Audio(url);
      audioEl.crossOrigin = 'anonymous';
      audioEl.onended = () => onEnded && onEnded();
      audioEl.play().catch((e) => {
        // Autoplay might be blocked — user interaction required; show small notice
        console.warn('audio play blocked', e);
      });
      return audioEl;
    } catch (e) {
      console.error('playAudio error', e);
      return null;
    }
  }

  // Lottie init - path '/mascot.json' expected by default
  async function initLottie(containerId = 'mascot-lottie', path = '/mascot.json') {
    try {
      const el = document.getElementById(containerId);
      if (!el) return null;
      const lottie = await ensureLottie();
      if (!lottie) {
        // fallback: leave image or text
        if (!el.innerHTML) el.innerHTML = '<div style="font-weight:700;color:#071024">SA</div>';
        return null;
      }
      try {
        lottieAnim = lottie.loadAnimation({
          container: el,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path
        });
        return lottieAnim;
      } catch (e) {
        console.warn('lottie.loadAnimation failed', e);
        el.innerHTML = '<div style="font-weight:700;color:#071024">SA</div>';
        return null;
      }
    } catch (e) {
      console.error('initLottie error', e);
      return null;
    }
  }

  // Simple amplitude-based lip-sync when audio plays
  function attachLipSyncToAudio(audio, lottieContainerId = 'mascot-lottie') {
    if (!audio || !window.AudioContext) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analyser.connect(ctx.destination);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const el = document.getElementById(lottieContainerId);
      let rafId = null;

      function tick() {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length; // 0..255
        // Map avg to scale or translate for a simple mouth movement
        const scale = 1 + (avg / 255) * 0.06; // subtle
        if (el) el.style.transform = `scale(${scale})`;
        rafId = requestAnimationFrame(tick);
      }
      rafId = requestAnimationFrame(tick);

      // cleanup on end
      audio.addEventListener('ended', () => {
        if (rafId) cancelAnimationFrame(rafId);
        try { ctx.close(); } catch (e) { /* ignore */ }
        if (el) el.style.transform = '';
      }, { once: true });
    } catch (e) {
      console.warn('lip-sync init failed', e);
    }
  }

  // Attach event handlers once DOM is ready and elements exist
  async function attachHandlers() {
    try {
      const panel = await waitForEl('mascot-panel').catch(() => null);
      if (!panel) {
        // create a safe fallback panel if missing
        console.warn('#mascot-panel not found — creating fallback panel');
        createFallbackPanel();
      }

      // now re-get the panel and required elements
      const Panel = document.getElementById('mascot-panel');
      const openBtn = document.getElementById('open-btn');
      const panelHandle = document.getElementById('panel-handle');
      const chatEl = document.getElementById('chat');
      const chatForm = document.getElementById('chat-form');
      const chatInput = document.getElementById('chat-input');
      const micBtn = document.getElementById('mic-btn');
      const sendBtn = document.getElementById('send-btn');
      const quickButtonsEl = document.getElementById('quick-buttons');
      const bookDemoBtn = document.getElementById('book-demo');
      const getQuoteBtn = document.getElementById('get-quote');

      const leadModal = document.getElementById('lead-modal');
      const leadName = document.getElementById('lead-name');
      const leadEmail = document.getElementById('lead-email');
      const leadNeed = document.getElementById('lead-need');
      const leadSubmit = document.getElementById('lead-submit');
      const leadCancel = document.getElementById('lead-cancel');

      // safety checks
      if (!chatEl) throw new Error('chat element missing');
      if (!chatForm || !chatInput) throw new Error('chat form/input missing');

      // init Lottie (non-blocking)
      initLottie().then(() => { /* ok */ });

      // Render quick buttons
      const QUICK = ['Get a free quote', 'Book demo', 'Show packages & pricing', 'Talk to sales'];
      quickButtonsEl && (quickButtonsEl.innerHTML = '');
      QUICK.forEach(q => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'quick-btn';
        b.textContent = q;
        b.addEventListener('click', () => handleQuick(q));
        quickButtonsEl && quickButtonsEl.appendChild(b);
      });

      // welcome message
      setTimeout(() => pushMessage(chatEl, 'Hey — welcome! 👋 I build Shopify apps & integrations. Ask me anything or choose an option.', 'bot'), 700);

      // Open/close handlers - robust
      window.setChatPanelOpen = (open) => setPanelOpen(Panel, open);
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          const isClosed = Panel.classList.contains('closed');
          window.setChatPanelOpen(isClosed);
        });
      }
      if (panelHandle) {
        panelHandle.addEventListener('click', (e) => {
          if (e.target && (e.target.tagName === 'BUTTON' || e.target.closest('button'))) return;
          const isClosed = Panel.classList.contains('closed');
          window.setChatPanelOpen(isClosed);
        });
      }

      // fallback floating toggle if openBtn missing or blocked
      if (!openBtn) {
        addFloatingToggle(Panel);
      }

      // chat form submit
      chatForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const txt = chatInput.value && chatInput.value.trim();
        if (!txt) return;
        chatInput.value = '';
        sendMessageFlow(txt, chatEl);
      });

      // send button redundancy
      if (sendBtn) sendBtn.addEventListener('click', () => {
        const txt = chatInput.value && chatInput.value.trim();
        if (!txt) return;
        chatInput.value = '';
        sendMessageFlow(txt, chatEl);
      });

      // mic / voice input (Web Speech API)
      if (micBtn) {
        micBtn.addEventListener('click', () => {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!SpeechRecognition) {
            alert('Speech recognition not supported in this browser.');
            return;
          }
          if (listening) return;
          listening = true;
          micBtn.textContent = '🔴';
          const recog = new SpeechRecognition();
          recog.lang = 'en-US';
          recog.interimResults = false;
          recog.onresult = (ev) => {
            const text = ev.results[0][0].transcript;
            sendMessageFlow(text, chatEl);
          };
          recog.onerror = () => {
            listening = false;
            micBtn.textContent = '🎙';
          };
          recog.onend = () => {
            listening = false;
            micBtn.textContent = '🎙';
          };
          recog.start();
        });
      }

      // quick bottom buttons
      if (bookDemoBtn) bookDemoBtn.addEventListener('click', () => window.open(CALENDLY_LINK || CALENDLY_LINK === '' ? '#' : CALENDLY_LINK, '_blank'));
      if (getQuoteBtn) getQuoteBtn.addEventListener('click', showLeadModal);

      // lead modal handlers
      if (leadCancel) leadCancel.addEventListener('click', hideLeadModal);
      if (leadSubmit) {
        leadSubmit.addEventListener('click', async () => {
          const payload = {
            name: leadName.value.trim(),
            email: leadEmail.value.trim(),
            need: leadNeed.value.trim(),
            storeUrl: window.location.href
          };
          if (!payload.name || !payload.email) return alert('Please provide name & email.');
          try {
            await postJson(`${BASE_URL}/api/lead`, payload);
            hideLeadModal();
            pushMessage(chatEl, `Thanks ${payload.name}! We'll email a short estimate to ${payload.email}.`, 'bot');
          } catch (e) {
            console.error('lead submit failed', e);
            alert('Could not submit lead. Try later.');
          }
        });
      }

      // ensure panel initial state (closed by default)
      if (!Panel.classList.contains('closed')) {
        // make sure closed is used if panel too big for small screens
        setPanelOpen(Panel, false);
      }

      // all attached successfully
      console.log('Chat widget attached successfully');
    } catch (err) {
      console.error('attachHandlers error:', err);
      // fallback creation if something critical missing
      if (++tries < MAX_RETRIES) {
        setTimeout(attachHandlers, RETRY_DELAY);
      } else {
        console.error('Giving up attaching handlers after retries.');
      }
    }
  }

  // Fallback panel creator if original markup missing
  function createFallbackPanel() {
    if (document.getElementById('mascot-panel')) return;
    const wrapper = document.createElement('div');
    wrapper.id = 'mascot-panel';
    wrapper.className = 'mascot-panel closed';
    wrapper.innerHTML = `
      <div class="panel-handle" id="panel-handle">
        <div class="brand">
          <div class="logo">SA</div>
          <div class="meta"><div class="title">Shop Assistant</div></div>
        </div>
        <div class="toggle"><button id="open-btn">💬</button></div>
      </div>
      <div class="panel-body" id="panel-body">
        <div class="header">
          <div id="mascot-lottie" class="mascot-lottie"></div>
          <div class="h-title">Hi — I'm ShopBot</div>
        </div>
        <div id="chat" class="chat"></div>
        <div id="quick-buttons" class="quick-buttons"></div>
        <form id="chat-form" class="chat-form">
          <button type="button" id="mic-btn">🎙</button>
          <input id="chat-input" type="text" placeholder="Ask about apps..." />
          <button id="send-btn" type="submit">Send</button>
        </form>
        <div class="bottom-actions">
          <button id="book-demo" class="secondary">Book a demo</button>
          <button id="get-quote" class="primary">Get a quote</button>
        </div>
      </div>
      <div id="lead-modal" class="modal hidden">
        <div class="modal-panel">
          <h3 id="lead-title">Request a free quote</h3>
          <label>Name <input id="lead-name" /></label>
          <label>Email <input id="lead-email" /></label>
          <label>Need <textarea id="lead-need"></textarea></label>
          <div class="modal-actions">
            <button id="lead-submit" class="primary">Send</button>
            <button id="lead-cancel" class="secondary">Cancel</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper);
  }

  // floating toggle button (fallback)
  function addFloatingToggle(panel) {
    if (document.getElementById('global-mascot-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'global-mascot-toggle';
    btn.innerText = 'Chat';
    Object.assign(btn.style, {
      position: 'fixed',
      right: '18px',
      bottom: '18px',
      zIndex: 2147483647,
      background: '#0f172a',
      color: '#fff',
      padding: '10px 14px',
      borderRadius: '10px',
      border: 'none',
      cursor: 'pointer',
      boxShadow: '0 8px 24px rgba(2,6,23,0.2)'
    });
    btn.addEventListener('click', () => {
      const panelEl = panel || document.getElementById('mascot-panel');
      if (!panelEl) return;
      const isClosed = panelEl.classList.contains('closed');
      setPanelOpen(panelEl, isClosed);
    });
    document.body.appendChild(btn);
  }

  // Quick handler
  function handleQuick(label) {
    if (label === 'Book demo') {
      window.open(CALENDLY_LINK || '#', '_blank');
      return;
    }
    if (label === 'Get a free quote') {
      showLeadModal();
      return;
    }
    sendMessageFlow(label, document.getElementById('chat'));
  }

  // show/hide lead modal
  function showLeadModal() {
    const modal = document.getElementById('lead-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
  }
  function hideLeadModal() {
    const modal = document.getElementById('lead-modal');
    if (!modal) return;
    modal.classList.add('hidden');
  }

  // send flow: send to backend, display result, play tts
  async function sendMessageFlow(text, chatEl) {
    if (!chatEl) chatEl = document.getElementById('chat');
    try {
      pushMessage(chatEl, text, 'user');
      pushMessage(chatEl, '...', 'bot'); // typing placeholder
      const resp = await postJson(`${BASE_URL}/api/message`, { sessionId, text });
      const replyText = (resp && resp.text) ? resp.text : 'Sorry — I could not process that right now.';
      replaceLastBotText(chatEl, replyText);

      if (resp && resp.ttsUrl) {
        // play and attach lip sync
        try {
          const audio = playAudio(resp.ttsUrl, () => { /* ended */ });
          attachLipSyncToAudio(audio);
        } catch (e) {
          console.warn('tts playback failed', e);
        }
      }
    } catch (err) {
      console.error('sendMessageFlow error', err);
      replaceLastBotText(chatEl, 'Service error. Try again later.');
    }
  }

  // File upload helper (optional)
  async function uploadFile(file) {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${BASE_URL}/upload`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error('upload failed');
      return await r.json();
    } catch (e) {
      console.error('uploadFile error', e);
      throw e;
    }
  }

  // start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachHandlers);
  } else {
    attachHandlers();
  }

  // expose debug helper
  window.__chatWidget = {
    open: () => {
      const panel = document.getElementById('mascot-panel');
      setPanelOpen(panel, true);
    },
    close: () => {
      const panel = document.getElementById('mascot-panel');
      setPanelOpen(panel, false);
    },
    send: (txt) => sendMessageFlow(txt, document.getElementById('chat'))
  };
})();
