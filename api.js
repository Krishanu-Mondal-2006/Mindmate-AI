// Small client for the FastAPI backend. Attaches the Supabase access token to every call.
import { CONFIG } from './config.js';
import { getToken } from './auth.js';

export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }

export async function api(path, { method = 'GET', body } = {}) {
  const token = await getToken();
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 60000); // free hosts can take a while to wake up
  let res;
  try {
    res = await fetch(CONFIG.API_BASE_URL + path, {
      method, signal: ac.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new ApiError(0, e.name === 'AbortError' ? 'The server took too long to respond. It may be waking up, so please try again.' : 'Can’t reach the server. Check your connection and try again.');
  } finally { clearTimeout(to); }
  if (!res.ok) {
    let msg = ''; try { const j = await res.json(); if (typeof j.detail === 'string') msg = j.detail; } catch { /* non-JSON error */ }
    throw new ApiError(res.status, msg || (res.status === 422 ? 'Please check what you entered.' : 'Something went wrong. Please try again.'));
  }
  return res.json();
}
