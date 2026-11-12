// Supabase Auth (passwords are hashed by Supabase; the app never sees or stores them).
import { CONFIG } from './config.js';

const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const NOCFG = 'Sign-in isn’t configured yet. Add your Supabase URL and anon key in js/config.js (see the README).';
let sb = null, current = null, loadError = '';

export const isConfigured = () => Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
const map = u => u ? { id: u.id, email: u.email, name: u.user_metadata?.display_name || (u.email || '').split('@')[0] } : null;

export async function initAuth(onSignedOut) {
  if (!isConfigured()) return;
  try {
    const { createClient } = await import(SDK);
    sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await sb.auth.getSession();
    current = map(data.session?.user);
    sb.auth.onAuthStateChange((ev, session) => { current = map(session?.user); if (ev === 'SIGNED_OUT') setTimeout(() => onSignedOut?.(), 0); });
  } catch { loadError = 'Couldn’t load the sign-in library. Check your internet connection and reload.'; }
}
export const getUser = () => current;
export async function getToken() { if (!sb) return null; const { data } = await sb.auth.getSession(); return data.session?.access_token || null; }

function validate(email, pw) {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.';
  if (pw.length < 6) return 'Use a password with at least 6 characters.';
  return '';
}
function friendly(e) {
  const m = (e?.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'That email and password don’t match an account. New here? Create an account.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists. Please log in.';
  if (m.includes('not confirmed')) return 'Please confirm your email first. Check your inbox for the link.';
  if (m.includes('rate limit') || e?.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (m.includes('password')) return 'That password isn’t accepted. Try a longer one.';
  if (m.includes('fetch') || m.includes('network')) return 'Can’t reach the sign-in service. Check your connection.';
  return 'Something went wrong. Please try again.';
}
const ready = () => (sb ? '' : loadError || NOCFG);

export async function signUp(name, email, pw) {
  const bad = validate(email, pw) || ready(); if (bad) return { ok: false, error: bad };
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pw, options: { data: { display_name: name.trim() || undefined } } });
  if (error) return { ok: false, error: friendly(error) };
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return { ok: false, error: 'An account with this email already exists. Please log in.' };
  if (!data.session) return { ok: true, confirm: true };       // email confirmation is enabled in Supabase
  current = map(data.session.user); return { ok: true, user: current };
}
export async function signIn(email, pw) {
  const bad = validate(email, pw) || ready(); if (bad) return { ok: false, error: bad };
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
  if (error) return { ok: false, error: friendly(error) };
  current = map(data.user); return { ok: true, user: current };
}
export async function signOut() { if (sb) await sb.auth.signOut(); current = null; }
