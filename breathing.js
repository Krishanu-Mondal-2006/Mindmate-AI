import { $, $$, icons, logActivity, mmss, store } from './util.js';

const TECH = {
  '478': { name: '4-7-8', desc: 'Inhale 4, hold 7, exhale 8. A slow pattern to calm racing thoughts.', phases: [['Inhale', 4, 'in'], ['Hold', 7, 'hold'], ['Exhale', 8, 'out']] },
  box: { name: 'Box', desc: 'Inhale, hold, exhale, hold, each for 4. Steady and focusing.', phases: [['Inhale', 4, 'in'], ['Hold', 4, 'hold'], ['Exhale', 4, 'out'], ['Hold', 4, 'hold']] },
  deep: { name: 'Deep', desc: 'Inhale for 4, exhale for 6. Simple and soothing.', phases: [['Inhale', 4, 'in'], ['Exhale', 6, 'out']] },
};
const MIN = 0.55, MAX = 1;
const S = { tech: '478', mins: 3, idx: 0, pe: 0, total: 0, running: false, started: false, timer: null, scale: MIN };
const circle = () => $('#bCircle');
const phases = () => TECH[S.tech].phases;

function setCircle(scale, seconds) {
  const c = circle(); c.style.transitionDuration = seconds + 's'; c.style.transform = `scale(${scale})`; S.scale = scale;
}
function applyPhase() {
  const [label, d, kind] = phases()[S.idx]; const left = d - S.pe / 1000;
  $('#bLabel').textContent = label;
  if (kind === 'in') setCircle(MAX, left); else if (kind === 'out') setCircle(MIN, left); else setCircle(S.scale, 0);
}
function paint() {
  const [, d] = phases()[S.idx];
  $('#bCount').textContent = S.started ? Math.ceil((d * 1000 - S.pe) / 1000) : '';
  $('#bTimer').textContent = mmss(S.mins * 60000 - S.total);
}
function buttons() {
  $('#bStart').disabled = S.running; $('#bPause').disabled = !S.running;
  $('#bStart').innerHTML = S.started && !S.running ? '<i data-lucide="play"></i> Resume' : '<i data-lucide="play"></i> Start'; icons();
}
function tick() {
  S.pe += 100; S.total += 100;
  if (S.total >= S.mins * 60000) return complete();
  if (S.pe >= phases()[S.idx][1] * 1000) { S.idx = (S.idx + 1) % phases().length; S.pe = 0; applyPhase(); }
  paint();
}
function start() {
  $('#bMsg').textContent = '';
  if (!S.started) { S.started = true; S.idx = 0; S.pe = 0; S.total = 0; }
  S.running = true; void circle().offsetWidth; applyPhase(); paint(); buttons();
  clearInterval(S.timer); S.timer = setInterval(tick, 100);
}
function pause() {
  if (!S.running) return; S.running = false; clearInterval(S.timer);
  const c = circle(); const m = getComputedStyle(c).transform; c.style.transitionDuration = '0s'; c.style.transform = m; // freeze mid-animation
  const mm = m.match(/matrix\(([^,]+)/); if (mm) S.scale = parseFloat(mm[1]);
  $('#bLabel').textContent = 'Paused'; buttons();
}
function reset(msg = '') {
  clearInterval(S.timer); S.running = false; S.started = false; S.idx = 0; S.pe = 0; S.total = 0;
  setCircle(MIN, 0.4); $('#bLabel').textContent = 'Ready'; $('#bMsg').textContent = msg; paint(); buttons();
}
function complete() {
  const name = TECH[S.tech].name, mins = S.mins; reset(`Session complete. You breathed for ${mins} minute${mins > 1 ? 's' : ''}. Notice how you feel.`);
  logActivity(`Finished ${mins}-min ${name} breathing`, 'wind');
  store.set('breath-sessions', (store.get('breath-sessions', 0)) + 1);
}
function chooseTech(k) {
  S.tech = k; reset(); $('#bDesc').textContent = TECH[k].desc;
  $$('#bTech button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
}

export function initBreathing() {
  $('#bTech').innerHTML = Object.entries(TECH).map(([k, t]) => `<button type="button" data-k="${k}" aria-pressed="${k === S.tech}">${t.name}</button>`).join('');
  $$('#bTech button').forEach(b => b.onclick = () => chooseTech(b.dataset.k));
  $('#bDur').onchange = e => { S.mins = +e.target.value; reset(); };
  $('#bStart').onclick = start; $('#bPause').onclick = pause; $('#bReset').onclick = () => reset();
  chooseTech(S.tech);
}
export const stopBreathing = () => { if (S.running) pause(); };
