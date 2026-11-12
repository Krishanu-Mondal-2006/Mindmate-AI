// Shared helpers: DOM, escaping, per-user local storage, toast, activity log.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const icons = () => { try { window.lucide && window.lucide.createIcons(); } catch { /* icons are decorative */ } };

let uid = 'guest';
export const setUid = u => { uid = u || 'guest'; };
export const store = {
  get(k, d) { try { const v = localStorage.getItem(`mm:${uid}:${k}`); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`mm:${uid}:${k}`, JSON.stringify(v)); } catch { /* storage may be blocked */ } },
  del(k) { try { localStorage.removeItem(`mm:${uid}:${k}`); } catch { /* ignore */ } },
};

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fmt = t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

let tt;
export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600);
}
export function logActivity(text, icon = 'sparkles') {
  const a = store.get('activity', []); a.unshift({ text, icon, at: Date.now() }); store.set('activity', a.slice(0, 20));
}
