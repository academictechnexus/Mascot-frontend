// widget.js (module)
import { BASE_URL, CALENDLY_LINK } from './config.js';

// Query DOM
const panel = document.getElementById('mascot-panel');
const openBtn = document.getElementById('open-btn');
const panelHandle = document.getElementById('panel-handle');
const panelBody = document.getElementById('panel-body');
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

let audioEl = null;
let sessionId = 's_' + Math.random().toString(36).slice(2,9);
let listening = false;

// Quick buttons - customize if needed
const QUICK = [
  'Get a free quote',
  'Book demo',
  'Show packages & pricing',
  'Talk to sales'
];

// Lottie init
let lottieAnim = null;
function initLottie(){
  const node = document.getElementById('mascot-lottie');
  if(!node || !window.lottie) return;
  // replace path with your Lottie json if you add it to public/mascot/mascot.json
  const path = '/mascot.json';
  try {
    lottieAnim = window.lottie.loadAnimation({
      container: node,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path
    });
  } catch(e) {
    // fallback: show default image
    node.innerHTML = '<img src="default-mascot.png" style="width:100%;height:100%;object-fit:cover" alt="mascot"/>';
  }
}

// add welcome message
function pushBot(text){
  const el = document.createElement('div');
  el.className = 'msg bot';
  el.textContent = text;
  chatEl.appendChild(el);
  chatEl.scrollTop = chatEl.scrollHeight;
}
function pushUser(text){
  const el = document.createElement('div');
  el.className = 'msg user';
  el.textContent = text;
  chatEl.appendChild(el);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// Fill quick buttons
function renderQuick(){
  quickButtonsEl.innerHTML = '';
  QUICK.forEach(q => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = q;
    b.onclick = () => onQuick(q);
    quickButtonsEl.appendChild(b);
  });
}

// Toggle panel open/close
function setOpen(open){
  if(open){
    panel.classList.remove('closed');
    panel.setAttribute('aria-hidden','false');
    panelHandle.setAttribute('aria-pressed','true');
  } else {
    panel.classList.add('closed');
    panel.setAttribute('aria-hidden','true');
    panelHandle.setAttribute('aria-pressed','false');
  }
}
openBtn.addEventListener('click', ()=> setOpen(!panel.classList.contains('closed')));
panelHandle.addEventListener('keydown', (e)=> { if(e.key === 'Enter') setOpen(!panel.classList.contains('closed')); });

// handle quick buttons
function onQuick(label){
  if(label === 'Book demo'){
    window.open(CALENDLY_LINK || CALENDLY_LINK === '' ? '#' : CALENDLY_LINK, '_blank');
    return;
  }
  if(label === 'Get a free quote'){
    showLeadModal();
    return;
  }
  // else send to backend as text
  sendMessageToBackend(label);
}

// Send message (text) to backend and handle reply + tts
async function sendMessageToBackend(text){
  if(!text) return;
  pushUser(text);
  // show typing bot bubble
  pushBot('...');
  try {
    const resp = await fetch(BASE_URL + '/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, text })
    });
    const data = await resp.json();
    // replace last bot '...' with actual text
    const botBubbles = chatEl.querySelectorAll('.msg.bot');
    if(botBubbles.length) botBubbles[botBubbles.length-1].textContent = data.text || '...';
    else pushBot(data.text || '');
    // play tts if available
    if(data.ttsUrl){
      playAudio(data.ttsUrl);
    }
  } catch(err){
    console.error(err);
    const botBubbles = chatEl.querySelectorAll('.msg.bot');
    if(botBubbles.length) botBubbles[botBubbles.length-1].textContent = 'Service error. Try later.';
  }
}

// Play audio given a data URL or external URL
function playAudio(url){
  try {
    if(audioEl){ audioEl.pause(); audioEl = null; }
    audioEl = new Audio(url);
    audioEl.play().catch(e => console.warn('Audio play blocked', e));
    // optional: visual speaking state
    audioEl.onended = ()=> { /* add idle behavior */ };
  } catch(e){
    console.error(e);
  }
}

// Form submit handler
chatForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const txt = chatInput.value.trim();
  if(!txt) return;
  chatInput.value = '';
  sendMessageToBackend(txt);
});

// Voice input via Web Speech API (fallback)
micBtn.addEventListener('click', ()=>{
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognition){
    alert('Speech recognition not supported in this browser.');
    return;
  }
  if(listening) return;
  const recog = new SpeechRecognition();
  recog.lang = 'en-US';
  recog.interimResults = false;
  recog.onstart = ()=> { listening = true; micBtn.textContent = '🔴'; }
  recog.onresult = (ev) => {
    const text = ev.results[0][0].transcript;
    chatInput.value = text;
    sendMessageToBackend(text);
  };
  recog.onend = ()=> { listening = false; micBtn.textContent = '🎙'; }
  recog.onerror = ()=> { listening = false; micBtn.textContent = '🎙'; }
  recog.start();
});

// Book demo / get quote handlers
bookDemoBtn.addEventListener('click', ()=> window.open(CALENDLY_LINK || '#','_blank'));
getQuoteBtn.addEventListener('click', showLeadModal);

// Lead modal
function showLeadModal(){
  leadModal.classList.remove('hidden');
}
function hideLeadModal(){
  leadModal.classList.add('hidden');
}
leadCancel.addEventListener('click', hideLeadModal);
leadSubmit.addEventListener('click', async ()=>{
  const payload = {
    name: leadName.value.trim(),
    email: leadEmail.value.trim(),
    need: leadNeed.value.trim(),
    storeUrl: window.location.href
  };
  if(!payload.name || !payload.email){
    alert('Please provide name and email.');
    return;
  }
  try {
    const resp = await fetch(BASE_URL + '/api/lead', {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload)
    });
    const json = await resp.json();
    hideLeadModal();
    pushBot(`Thanks ${payload.name}! We'll email a short estimate to ${payload.email}.`);
  } catch(err){
    console.error(err);
    alert('Could not submit lead. Try again later.');
  }
});

// File upload helper (if you later add UI to upload mascots or files)
async function uploadFile(file){
  const form = new FormData();
  form.append('file', file);
  const resp = await fetch(BASE_URL + '/upload', { method:'POST', body: form });
  return resp.json();
}

// initial boot
function boot(){
  renderQuick();
  initLottie();
  // initial welcome
  setTimeout(()=> pushBot('Hey — welcome! 👋 I build Shopify apps and integrations. Choose an option or ask me a question.'), 700);
}
boot();
