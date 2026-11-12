import { $, $$, esc, fmt, icons, dayKey, logActivity, toast } from './util.js';
import { api } from './api.js';

export const MOODS = [
  { k: 'very_happy', e: '😄', l: 'Very Happy', s: 5, c: '#7C5CE0' },
  { k: 'happy', e: '🙂', l: 'Happy', s: 4, c: '#8FA2F0' },
  { k: 'neutral', e: '😐', l: 'Neutral', s: 3, c: '#A9B8D8' },
  { k: 'sad', e: '😢', l: 'Sad', s: 2, c: '#7FA6D6' },
  { k: 'stressed', e: '😣', l: 'Stressed', s: 1, c: '#D98A9A' },
];
const byK = k => MOODS.find(m => m.k === k) || MOODS[2];
let picked = null, cache = [], st = { loaded: false, error: '' }, onChange = () => {};
export const getMoods = () => cache;
export const moodLabel = k => byK(k);
export const resetMoodForm = () => { picked = null; };
const row = r => ({ id: r.id, at: Date.parse(r.created_at), mood: r.mood, note: r.note || '' });

export async function loadMoods() {
  try { cache = (await api('/api/mood?limit=300')).map(row); st = { loaded: true, error: '' }; }
  catch (e) { st = { loaded: st.loaded, error: e.message }; }
}
export const setMoodListener = fn => { onChange = fn; };

function stateView(el) {
  if (!st.loaded && !st.error) { el.innerHTML = '<p class="empty">Loading…</p>'; return true; }
  if (!st.loaded && st.error) { el.innerHTML = `<p class="err">${esc(st.error)}</p><button class="link" type="button" data-retry>Try again</button>`; el.querySelector('[data-retry]').onclick = () => { st = { loaded: false, error: '' }; onChange(); loadMoods().then(onChange); }; return true; }
  return false;
}

export function todayMood() { const t = dayKey(); return cache.find(m => dayKey(new Date(m.at)) === t) || null; }

export function renderWeek(el) {
  if (stateView(el)) return;
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const vals = days.map(d => { const k = dayKey(d); const e = cache.filter(m => dayKey(new Date(m.at)) === k); return e.length ? e.reduce((a, m) => a + byK(m.mood).s, 0) / e.length : null; });
  if (vals.every(v => v === null)) { el.innerHTML = '<p class="empty">No entries this week yet. Log a mood to see your chart.</p>'; return; }
  const W = 340, H = 150, bw = 30, gap = (W - bw * 7) / 6;
  const colour = v => v >= 4.5 ? MOODS[0].c : v >= 3.5 ? MOODS[1].c : v >= 2.5 ? MOODS[2].c : v >= 1.5 ? MOODS[3].c : MOODS[4].c;
  const bars = vals.map((v, i) => { const x = i * (bw + gap); const h = v === null ? 4 : (v / 5) * 110; const y = 120 - h;
    return `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="8" fill="${v === null ? 'currentColor' : colour(v)}" opacity="${v === null ? .12 : 1}"><title>${days[i].toLocaleDateString([], { weekday: 'long' })}: ${v === null ? 'no entry' : v.toFixed(1) + ' / 5'}</title></rect><text x="${x + bw / 2}" y="140" text-anchor="middle">${days[i].toLocaleDateString([], { weekday: 'short' }).slice(0, 3)}</text>`; }).join('');
  el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Average mood per day for the last 7 days, higher is better">${bars}</svg><p class="fine">Higher bars mean a more positive day (5 = Very Happy, 1 = Stressed).</p>`;
}

function renderInsights() {
  const week = cache.filter(m => Date.now() - m.at < 7 * 864e5);
  if (!week.length) { $('#moodInsights').innerHTML = ''; return; }
  const counts = {}; week.forEach(m => counts[m.mood] = (counts[m.mood] || 0) + 1);
  const top = byK(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
  const avg = week.reduce((a, m) => a + byK(m.mood).s, 0) / week.length;
  $('#moodInsights').innerHTML = `<li>Most frequent: <b>${top.e} ${top.l}</b></li><li>Average mood: <b>${avg.toFixed(1)} / 5</b></li><li>Entries this week: <b>${week.length}</b></li>`;
}
function renderList() {
  const el = $('#moodList');
  if (!st.loaded) { const box = document.createElement('div'); stateView(box); el.innerHTML = `<li>${box.innerHTML}</li>`; const r = el.querySelector('[data-retry]'); if (r) r.onclick = () => { st = { loaded: false, error: '' }; onChange(); loadMoods().then(onChange); }; return; }
  el.innerHTML = cache.length ? cache.map(m => { const d = byK(m.mood);
    return `<li><span class="em" aria-hidden="true">${d.e}</span><div class="grow"><b>${d.l}</b><small>${fmt(m.at)}</small>${m.note ? `<div>${esc(m.note)}</div>` : ''}</div><button class="icon-btn" data-id="${esc(m.id)}" aria-label="Delete entry"><i data-lucide="trash-2"></i></button></li>`; }).join('')
    : '<li class="empty">No entries yet. Your first check-in will show up here.</li>';
  $$('#moodList .icon-btn').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await api(`/api/mood/${b.dataset.id}`, { method: 'DELETE' }); cache = cache.filter(m => m.id !== b.dataset.id); renderMoodPage(); }
    catch (e) { toast(e.message); b.disabled = false; }
  });
}
export function renderMoodPage() { renderWeek($('#moodWeek')); renderInsights(); renderList(); icons(); }

export function initMood() {
  $('#moodPick').innerHTML = MOODS.map(m => `<button type="button" data-k="${m.k}" aria-pressed="false" aria-label="${m.l}"><span aria-hidden="true">${m.e}</span><small>${m.l}</small></button>`).join('');
  $$('#moodPick button').forEach(b => b.onclick = () => { picked = b.dataset.k; $$('#moodPick button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); $('#moodErr').textContent = ''; });
  $('#moodSave').onclick = async () => {
    if (!picked) { $('#moodErr').textContent = 'Choose how you feel first.'; return; }
    const btn = $('#moodSave'); btn.disabled = true; btn.textContent = 'Saving…'; $('#moodErr').textContent = '';
    try {
      const r = await api('/api/mood', { method: 'POST', body: { mood: picked, note: $('#moodNote').value.trim() } });
      cache.unshift(row(r)); st = { loaded: true, error: '' };
      logActivity(`Logged mood: ${byK(picked).l}`, 'smile-plus');
      picked = null; $('#moodNote').value = ''; $$('#moodPick button').forEach(x => x.setAttribute('aria-pressed', 'false'));
      toast('Mood saved'); renderMoodPage();
    } catch (e) { $('#moodErr').textContent = e.message; }
    finally { btn.disabled = false; btn.textContent = 'Save entry'; }
  };
}
