import { $, $$, esc, fmt, icons, setUid, store, toast } from './util.js';
import { CONFIG } from './config.js';
import { initAuth, getUser, signIn, signUp, signOut } from './auth.js';
import { api } from './api.js';
import { initChat } from './chatbot.js';
import { initBreathing, stopBreathing } from './breathing.js';
import { initMood, renderMoodPage, renderWeek, todayMood, moodLabel, resetMoodForm, loadMoods, setMoodListener } from './mood-tracker.js';
import { initWellness, renderWellness, dailyTip, stopMeditation } from './wellness.js';

const AGES = ['13–17', '18–24', '25–34', '35–49', '50+'];
const ROLES = [['Student', 'School or college'], ['Job seeker', 'Looking for work'], ['Working professional', 'Employed or self-employed'], ['Life transition', 'Moving, relationships, other']];
const CONCERNS = ['Exam stress', 'Career anxiety', 'Work burnout', 'Loneliness', 'Relationships', 'Sleep', 'General stress'];
const PAGES = ['dashboard', 'chat', 'breathe', 'mood', 'wellness'];

let user = null, mode = 'login', pendingScroll = null, ob = { age: '', role: '', concerns: [] };
let prof = null, profFor = null, currentPage = '';
const profile = () => prof || store.get('profile', null);

/* ---------- profile (stored in Supabase via the API, cached locally for offline starts) ---------- */
async function ensureProfile() {
  if (!user || profFor === user.id) return;
  try { prof = await api('/api/profile'); profFor = user.id; prof ? store.set('profile', prof) : store.del('profile'); }
  catch { prof = store.get('profile', null); }
}

/* ---------- routing ---------- */
function showView(id) { $$('.view').forEach(v => v.classList.toggle('on', v.id === id)); window.scrollTo(0, 0); }
async function route() {
  user = getUser(); setUid(user?.id);
  const [path, query = ''] = (location.hash.slice(1) || '/').split('?');
  const goto = h => { location.hash = h; };
  if (path.startsWith('/app')) {
    if (!user) return goto('#/auth?mode=login');
    await ensureProfile(); if (!profile()) return goto('#/onboard');
    return showApp(PAGES.includes(path.split('/')[2]) ? path.split('/')[2] : 'dashboard');
  }
  currentPage = ''; stopBreathing(); stopMeditation();
  if (path === '/auth') { if (user) return goto('#/app/dashboard'); setMode(new URLSearchParams(query).get('mode') === 'signup' ? 'signup' : 'login'); return showView('v-auth'); }
  if (path === '/onboard') { if (!user) return goto('#/auth?mode=signup'); await ensureProfile(); if (profile()) return goto('#/app/dashboard'); renderOnboard(); return showView('v-onboard'); }
  if (path === '/privacy') return showView('v-privacy');
  renderLandingCta(); showView('v-landing');
  if (pendingScroll) { const t = document.getElementById(pendingScroll); pendingScroll = null; t?.scrollIntoView({ behavior: 'smooth' }); }
}

function showApp(page) {
  currentPage = page; showView('v-app');
  $$('.page').forEach(p => p.classList.toggle('on', p.id === 'p-' + page));
  $$('#appNav a,#tabBar a').forEach(a => { const on = a.dataset.page === page; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  if (page !== 'breathe') stopBreathing(); if (page !== 'wellness') stopMeditation();
  if (page === 'dashboard') { renderDashboard(); loadMoods().then(rerender); }
  if (page === 'mood') { renderMoodPage(); loadMoods().then(rerender); }
  if (page === 'wellness') renderWellness();
  icons();
}
function rerender() { if (currentPage === 'dashboard') { renderDashboard(); icons(); } else if (currentPage === 'mood') renderMoodPage(); }

function renderLandingCta() {
  $('.nav-cta').innerHTML = user ? '<a class="btn sm" href="#/app/dashboard">Open dashboard</a>' : '<a class="btn ghost sm" href="#/auth?mode=login">Log in</a><a class="btn sm" href="#/auth?mode=signup">Get started</a>';
}

/* ---------- auth ---------- */
function setMode(m) {
  mode = m; const su = m === 'signup';
  $('#authTitle').textContent = su ? 'Create your account' : 'Welcome back';
  $('#authSub').textContent = su ? 'A calm space, just for you.' : 'Log in to continue your journey.';
  $('#nameWrap').hidden = !su; $('#authBtn').textContent = su ? 'Create account' : 'Log in';
  $('#authToggle').textContent = su ? 'Already have an account? Log in' : 'New here? Create an account';
  $('#aPw').autocomplete = su ? 'new-password' : 'current-password'; $('#authErr').textContent = ''; $('#authNote').textContent = '';
}
function initAuthUi() {
  $('#authToggle').onclick = () => { location.hash = `#/auth?mode=${mode === 'login' ? 'signup' : 'login'}`; };
  $('#authForm').onsubmit = async e => {
    e.preventDefault(); const btn = $('#authBtn'); const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Please wait…'; $('#authErr').textContent = ''; $('#authNote').textContent = '';
    try {
      const r = mode === 'signup' ? await signUp($('#aName').value, $('#aEmail').value, $('#aPw').value) : await signIn($('#aEmail').value, $('#aPw').value);
      if (!r.ok) { $('#authErr').textContent = r.error; return; }
      if (r.confirm) { $('#authNote').textContent = 'Account created. Check your email and click the confirmation link, then log in.'; return; }
      $('#aPw').value = ''; location.hash = '#/app/dashboard';
    } catch { $('#authErr').textContent = 'Something went wrong. Please try again.'; }
    finally { btn.disabled = false; btn.textContent = label; }
  };
  $$('[data-logout]').forEach(b => b.onclick = async () => { await signOut(); location.hash = '#/'; location.reload(); });
  $('#deleteData').onclick = async () => {
    if (!confirm('Delete all your saved mood entries, journal entries and profile? This cannot be undone.')) return;
    try {
      await api('/api/data', { method: 'DELETE' });
      Object.keys(localStorage).filter(k => k.startsWith(`mm:${user.id}:`)).forEach(k => localStorage.removeItem(k));
      toast('Your saved data was deleted'); location.hash = '#/app/dashboard'; setTimeout(() => location.reload(), 600);
    } catch (e) { toast(e.message); }
  };
}

/* ---------- onboarding ---------- */
function opts(el, items, selected, onPick) {
  el.innerHTML = items.map(i => { const [v, s] = Array.isArray(i) ? i : [i, '']; return `<button type="button" class="opt" data-v="${esc(v)}" aria-pressed="${selected.includes(v)}">${esc(v)}${s ? `<small>${esc(s)}</small>` : ''}</button>`; }).join('');
  $$('.opt', el).forEach(b => b.onclick = () => onPick(b.dataset.v));
}
function renderOnboard() {
  ob = { age: '', role: '', concerns: [] }; $('#obErr').textContent = ''; $('#obConcernSet').hidden = false;
  const draw = () => {
    opts($('#obAge'), AGES, [ob.age], v => { ob.age = v; draw(); });
    opts($('#obRole'), ROLES, [ob.role], v => { ob.role = v; draw(); });
    opts($('#obConcern'), CONCERNS, ob.concerns, v => { ob.concerns = ob.concerns.includes(v) ? ob.concerns.filter(c => c !== v) : [...ob.concerns, v]; draw(); });
  };
  draw();
}
function initOnboard() {
  $('#obGo').onclick = async () => {
    if (!ob.age || !ob.role) { $('#obErr').textContent = 'Please choose your age group and what describes you.'; return; }
    const btn = $('#obGo'); btn.disabled = true; btn.textContent = 'Saving…'; $('#obErr').textContent = '';
    try {
      prof = await api('/api/profile', { method: 'PUT', body: { age_group: ob.age, role: ob.role, concerns: ob.concerns, display_name: (user.name || '').slice(0, 40) || null } });
      profFor = user.id; store.set('profile', prof); location.hash = '#/app/dashboard';
    } catch (e) { $('#obErr').textContent = e.message; }
    finally { btn.disabled = false; btn.textContent = 'Continue to my dashboard'; }
  };
}

/* ---------- dashboard ---------- */
function renderDashboard() {
  const h = new Date().getHours(); const hi = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('#dashH').textContent = `${hi}, ${user?.name || 'friend'}`;
  const tm = todayMood();
  $('#dashMood').innerHTML = tm ? `<div class="mood-big"><span aria-hidden="true" style="font-size:2.4rem">${moodLabel(tm.mood).e}</span><span>${moodLabel(tm.mood).l}</span></div><p class="fine">Logged ${fmt(tm.at)}</p>` : '<p class="empty">You haven’t checked in today.</p><a class="btn sm" href="#/app/mood">Log your mood</a>';
  $('#dashTip').textContent = dailyTip();
  renderWeek($('#dashWeek'));
  const act = store.get('activity', []).slice(0, 6);
  $('#dashActivity').innerHTML = act.length ? act.map(a => `<li><i data-lucide="${esc(a.icon)}"></i><div>${esc(a.text)}<small>${fmt(a.at)}</small></div></li>`).join('') : '<li class="empty">Nothing yet. Try a breathing exercise or say hello in chat.</li>';
}

/* ---------- boot ---------- */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-scroll]'); if (!a) return;
  e.preventDefault(); pendingScroll = a.dataset.scroll;
  if ((location.hash || '#/') === '#/') route(); else location.hash = '#/';
});
window.addEventListener('hashchange', () => { route().catch(() => toast('Something went wrong. Please reload.')); });
window.addEventListener('load', () => icons());

initAuthUi(); initOnboard(); initBreathing(); initMood(); initWellness(); setMoodListener(rerender);
initChat(() => { const p = profile() || {}; const tm = todayMood(); return { age_group: p.age_group, role: p.role, concerns: p.concerns || [], mood_today: tm ? moodLabel(tm.mood).l : null }; });
resetMoodForm();
fetch(`${CONFIG.API_BASE_URL}/health`).catch(() => {}); // wake a sleeping free-tier backend early
(async () => {
  await initAuth(() => { location.hash = '#/'; location.reload(); });
  try { await route(); } catch { toast('Something went wrong. Please reload.'); }
  $('#boot')?.remove(); icons();
})();
