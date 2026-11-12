import { $, $$, icons, logActivity } from './util.js';
import { CONFIG } from './config.js';
import { getToken } from './auth.js';

const PROMPTS = ['I’m feeling overwhelmed', 'Help me calm down', 'I’m stressed about exams', 'I can’t sleep', 'I feel lonely', 'Work is burning me out'];
let history = [];      // [{role:'user'|'assistant', content}] for this session only
let busy = false;
let ctx = () => ({});

const intro = () => `<div class="intro"><span class="ico"><i data-lucide="message-circle-heart"></i></span><p><b>Hi, I’m MindMate.</b><br>Tell me what’s on your mind, or pick a prompt below. I’m a wellness companion, not a therapist.</p></div>`;
const log = () => $('#chatLog');
const down = () => { log().scrollTop = log().scrollHeight; };

function add(text, cls) { const d = document.createElement('div'); d.className = 'msg ' + cls; d.textContent = text; log().append(d); down(); return d; }
function typing(on) {
  $('#typing')?.remove();
  if (on) { const t = document.createElement('div'); t.id = 'typing'; t.className = 'msg bot typing'; t.setAttribute('aria-label', 'MindMate is typing'); t.innerHTML = '<i></i><i></i><i></i>'; log().append(t); down(); }
}
function setBusy(b) { busy = b; $('#chatSend').disabled = b; $('#chatInput').disabled = b; if (!b) $('#chatInput').focus(); }

const URGENT = ' If you need urgent help, call your local emergency number, Tele-MANAS 14416 (India) or 988 (US).';
function errorText(status) {
  const base = errorBase(status);
  return [429, 400, 422].includes(status) ? base : base + URGENT;
}
function errorBase(status) {
  if (status === 0) return 'I can’t reach the server right now. Check your connection and that the backend is running, then try again.';
  if (status === 404) return 'The chat service wasn’t found. Check that the backend is deployed and API_BASE_URL in js/config.js is correct.';
  if (status === 503) return 'Chat isn’t set up on the server yet. Please try again later.';
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 422 || status === 400) return 'That message couldn’t be processed. Try rephrasing it.';
  if (status === 429) return 'You’re sending messages quickly. Please wait a moment and try again.';
  return 'Something went wrong on our side. Please try again in a moment.';
}

async function send(text) {
  text = text.trim(); if (!text || busy) return;
  if ($('.intro', log())) log().innerHTML = '';
  add(text, 'me'); history.push({ role: 'user', content: text }); $('#chatInput').value = ''; autosize();
  setBusy(true); typing(true);
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 30000);
  try {
    const token = await getToken();
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/chat`, {
      method: 'POST', signal: ac.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ messages: history.slice(-20), profile: ctx() }),
    });
    typing(false);
    if (!res.ok) {
      history.pop(); $('#chatInput').value = text; autosize(); let d = ''; try { const j = await res.json(); if (typeof j.detail === 'string' && [429, 502, 504].includes(res.status)) d = j.detail; } catch { /* ignore */ }
      add(d || errorText(res.status), 'error'); return;
    }
    const data = await res.json();
    const reply = String(data.reply || '').trim();
    if (!reply) { history.pop(); $('#chatInput').value = text; add(errorText(500), 'error'); return; }
    history.push({ role: 'assistant', content: reply }); add(reply, `bot${data.crisis ? ' crisis' : ''}`);
    if (history.length === 2) logActivity('Started a chat with MindMate', 'message-circle-heart');
  } catch (e) {
    typing(false); history.pop(); $('#chatInput').value = text; autosize(); add(e.name === 'AbortError' ? 'That took too long. Please try again.' : errorText(0), 'error');
  } finally { clearTimeout(to); setBusy(false); }
}

function autosize() { const t = $('#chatInput'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }
export function clearChat() { history = []; log().innerHTML = intro(); icons(); }

export function initChat(getContext) {
  ctx = getContext; clearChat();
  $('#chatChips').innerHTML = PROMPTS.map(p => `<button type="button" class="chip">${p}</button>`).join('');
  $$('#chatChips .chip').forEach(b => b.onclick = () => send(b.textContent));
  $('#chatForm').onsubmit = e => { e.preventDefault(); send($('#chatInput').value); };
  $('#chatInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send($('#chatInput').value); } });
  $('#chatInput').addEventListener('input', autosize);
  $('#chatClear').onclick = clearChat;
}
