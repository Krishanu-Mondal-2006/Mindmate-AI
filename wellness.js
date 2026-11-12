import { $, $$, esc, store, dayKey, fmt, icons, logActivity, mmss, toast } from './util.js';
import { api } from './api.js';

const QUOTES = [
  ['You don’t have to control your thoughts. You just have to stop letting them control you.', 'Dan Millman'],
  ['Feelings come and go like clouds in a windy sky. Conscious breathing is my anchor.', 'Thich Nhat Hanh'],
  ['Almost everything will work again if you unplug it for a few minutes, including you.', 'Anne Lamott'],
  ['It’s okay to not be okay, as long as you’re not giving up.', 'Karen Salmansohn'],
  ['You are allowed to be both a masterpiece and a work in progress.', 'Sophia Bush'],
  ['Within you, there is a stillness and a sanctuary to which you can retreat at any time.', 'Hermann Hesse'],
  ['Small steps every day add up to a different life.', 'MindMate'],
  ['Rest is not idleness. It is part of how growth happens.', 'MindMate'],
  ['Be gentle with yourself. You are doing the best you can with what you have today.', 'MindMate'],
  ['The only way out is through, and you can go through one breath at a time.', 'MindMate'],
  ['Courage doesn’t always roar. Sometimes it is the quiet voice saying, “I’ll try again tomorrow.”', 'Mary Anne Radmacher'],
  ['Nothing can bring you peace but yourself.', 'Ralph Waldo Emerson'],
  ['What you do today can improve all your tomorrows.', 'Ralph Marston'],
  ['Talking to someone you trust is a strength, not a weakness.', 'MindMate'],
];
const TIPS = [
  'Drink a glass of water and stretch your shoulders. Your body and mind are connected.',
  'Name the feeling out loud: “I notice I’m feeling anxious.” Naming it can soften it.',
  'Try the 5-4-3-2-1 grounding trick: 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste.',
  'Put your phone in another room for 20 minutes and do one thing at a time.',
  'Break a big worry into the smallest next action, then do just that one.',
  'Step outside for five minutes. Daylight helps regulate your body clock and mood.',
  'Write down tomorrow’s top three tasks tonight so your mind can let go of them.',
  'Compare today with yesterday, not with someone else’s highlight reel.',
  'Take a slow breath out that is longer than the breath in. It signals your body to settle.',
  'Reach out to one person today, even with a simple “thinking of you.”',
  'Aim for a steady sleep and wake time this week. Consistency matters more than perfection.',
  'Schedule a real break between tasks. Short pauses protect your focus.',
  'Notice one thing that went okay today, however small.',
  'If you are stuck in a loop, change your setting. Walk, wash your face, or open a window.',
];
const CARE = [
  'Eat one proper meal sitting down', 'Take a 10-minute walk', 'Message a friend or family member', 'Tidy one small corner of your space',
  'Listen to a song you love', 'Stretch for 5 minutes', 'Spend 15 minutes on something you enjoy', 'Switch off screens 30 minutes before bed',
  'Drink water regularly today', 'Write three lines in a journal', 'Step outside for fresh air', 'Do one thing you have been putting off, just for 10 minutes',
];
const MINDFUL = {
  'Body scan': ['Sit or lie comfortably and close your eyes if you like.', 'Bring attention to your feet. Notice any sensation, without trying to change it.', 'Slowly move up through your legs, stomach, chest, arms and face.', 'Wherever you find tension, breathe toward it and let it soften.', 'Finish with three slow breaths.'],
  '5-4-3-2-1 grounding': ['Look around and name 5 things you can see.', 'Notice 4 things you can touch or feel.', 'Listen for 3 sounds.', 'Find 2 things you can smell.', 'Notice 1 thing you can taste. Take a slow breath.'],
  'Mindful minute': ['Set a one-minute timer.', 'Focus on the feeling of breath at your nostrils or belly.', 'When your mind wanders, gently say “thinking” and return to the breath.', 'No judgement. Returning is the practice.'],
  'Mindful walking': ['Walk slightly slower than usual.', 'Feel each footstep: heel, arch, toes.', 'Notice sounds and colours around you without labelling them good or bad.', 'When your mind drifts, come back to your feet.'],
};
const MEDITATION = ['Settle into a comfortable position. Let your shoulders drop.', 'Breathe in slowly through your nose, and out through your mouth.', 'Let your breath find its own natural rhythm. Simply follow it.', 'If thoughts appear, notice them like passing clouds and return to the breath.', 'Soften your jaw, your forehead, your hands.', 'Take one deeper breath. When you are ready, gently open your eyes.'];

const doy = () => { const n = new Date(); return Math.floor((n - new Date(n.getFullYear(), 0, 0)) / 864e5); };
export const dailyTip = () => TIPS[doy() % TIPS.length];

let medT = null;
function stopMed(reset = true) { clearInterval(medT); medT = null; $('#medStart').innerHTML = '<i data-lucide="play"></i> Start'; if (reset) { $('#medBox').textContent = 'Press start when you’re comfortable.'; $('#medTimer').textContent = '02:00'; } icons(); }

function renderCare() {
  const d = doy(); const picks = [0, 1, 2, 3, 4].map(i => CARE[(d + i * 3) % CARE.length]);
  const done = store.get('care:' + dayKey(), []);
  $('#welCare').innerHTML = picks.map((c, i) => `<li><label><input type="checkbox" data-i="${i}" ${done.includes(i) ? 'checked' : ''}> <span>${esc(c)}</span></label></li>`).join('');
  $$('#welCare input').forEach(cb => cb.onchange = () => { const s = $$('#welCare input:checked').map(x => +x.dataset.i); store.set('care:' + dayKey(), s); if (cb.checked) logActivity('Completed a self-care step', 'heart'); });
}
function renderMindful(name) {
  $('#mfTabs').innerHTML = Object.keys(MINDFUL).map(k => `<button type="button" aria-pressed="${k === name}" data-k="${esc(k)}">${esc(k)}</button>`).join('');
  $('#mfBody').innerHTML = `<ol>${MINDFUL[name].map(s => `<li>${esc(s)}</li>`).join('')}</ol>`;
  $$('#mfTabs button').forEach(b => b.onclick = () => renderMindful(b.dataset.k));
}
let gr = [], grSt = { loaded: false, error: '' };
const grRow = r => ({ id: r.id, text: r.content, at: Date.parse(r.created_at) });
async function loadGratitude() {
  try { gr = (await api('/api/journal?kind=gratitude&limit=200')).map(grRow); grSt = { loaded: true, error: '' }; }
  catch (e) { grSt = { loaded: grSt.loaded, error: e.message }; }
}
function renderGratitude() {
  const el = $('#grList');
  if (!grSt.loaded) {
    el.innerHTML = grSt.error ? `<li><div class="grow"><span class="err">${esc(grSt.error)}</span> <button class="link" type="button" id="grRetry">Try again</button></div></li>` : '<li class="empty">Loading…</li>';
    $('#grRetry')?.addEventListener('click', () => { grSt = { loaded: false, error: '' }; renderGratitude(); loadGratitude().then(renderGratitude); });
    return;
  }
  el.innerHTML = gr.length ? gr.map(e => `<li><i data-lucide="heart"></i><div class="grow">${esc(e.text)}<small>${fmt(e.at)}</small></div><button class="icon-btn" data-id="${esc(e.id)}" aria-label="Delete entry"><i data-lucide="x"></i></button></li>`).join('') : '<li class="empty">No entries yet. Start with one small thing.</li>';
  $$('#grList .icon-btn').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await api(`/api/journal/${b.dataset.id}`, { method: 'DELETE' }); gr = gr.filter(e => e.id !== b.dataset.id); renderGratitude(); }
    catch (e) { toast(e.message); b.disabled = false; }
  });
  icons();
}

export function renderWellness() {
  const d = doy();
  $('#welDate').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const [q, a] = QUOTES[d % QUOTES.length]; $('#welQuote').textContent = '“' + q + '”'; $('#welAuthor').textContent = '— ' + a;
  $('#welTip').textContent = dailyTip();
  renderCare(); renderMindful(Object.keys(MINDFUL)[d % 4]); renderGratitude(); loadGratitude().then(renderGratitude); stopMed();
}

export function initWellness() {
  $('#grForm').onsubmit = async e => {
    e.preventDefault(); const v = $('#grInput').value.trim(); if (!v) return toast('Write something first.');
    const btn = $('#grForm button'); btn.disabled = true;
    try {
      const r = await api('/api/journal', { method: 'POST', body: { kind: 'gratitude', content: v } });
      gr.unshift(grRow(r)); grSt = { loaded: true, error: '' }; $('#grInput').value = '';
      logActivity('Added a gratitude entry', 'notebook-pen'); renderGratitude(); toast('Saved');
    } catch (err) { toast(err.message); } finally { btn.disabled = false; }
  };
  $('#medStart').onclick = () => {
    if (medT) return stopMed();
    const total = 120000; let t = 0; $('#medStart').innerHTML = '<i data-lucide="square"></i> Stop'; icons();
    const tick = () => {
      $('#medBox').textContent = MEDITATION[Math.min(MEDITATION.length - 1, Math.floor(t / (total / MEDITATION.length)))];
      $('#medTimer').textContent = mmss(total - t);
      if (t >= total) { stopMed(false); $('#medBox').textContent = 'Well done. Notice how you feel now.'; $('#medTimer').textContent = '00:00'; logActivity('Finished a 2-minute meditation', 'flower-2'); return; }
      t += 1000;
    };
    tick(); medT = setInterval(tick, 1000);
  };
}
export const stopMeditation = () => stopMed();
