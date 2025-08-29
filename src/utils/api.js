// src/utils/api.js

// Base URL (strip ALL trailing slashes)
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const AUTH_TOKEN_KEY = 'bf_auth_token';
const AUTH_REFRESH_KEY = 'bf_refresh_token';

let onUnauthorized = null;

function setOnUnauthorized(fn){ onUnauthorized = fn; }

function getToken(){
  return (sessionStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY)) || null;
}

function _setToken(store, token){
  if (token) { store.setItem(AUTH_TOKEN_KEY, token); }
  else { store.removeItem(AUTH_TOKEN_KEY); }
}

function _setRefresh(store, token){
  if (token) { store.setItem(AUTH_REFRESH_KEY, token); }
  else { store.removeItem(AUTH_REFRESH_KEY); }
}

function setToken(token, persist){
  _setToken(persist ? localStorage : sessionStorage, token);
  _setToken(persist ? sessionStorage : localStorage, null);
}

function setRefreshToken(token, persist){
  _setRefresh(persist ? localStorage : sessionStorage, token);
  _setRefresh(persist ? sessionStorage : localStorage, null);
}

function clearTokens(){
  localStorage.removeItem(AUTH_TOKEN_KEY); sessionStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_REFRESH_KEY); sessionStorage.removeItem(AUTH_REFRESH_KEY);
}

async function apiFetch(path, opts = {}){
  // Safe URL join: supports "/api/..." or "api/..." or absolute
  const url = path.startsWith('http')
    ? path
    : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

  const headers = { 'Accept': 'application/json', ...(opts.headers || {}) };

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const isJson = opts.body && typeof opts.body !== 'string';
  if (isJson && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, { ...opts, headers, body: isJson ? JSON.stringify(opts.body) : opts.body });
  } catch (netErr) {
    const err = new Error('NETWORK_ERROR: Failed to reach API');
    err.cause = netErr;
    err.url = url;
    throw err;
  }

  if (res.status === 401 && onUnauthorized) { onUnauthorized(); }

  const ctype = res.headers.get('content-type') || '';
  const data = ctype.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok || (data && data.ok === false)) {
    const msg = (data && (data.message || data.error || data.msg)) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    err.url = url;
    throw err;
  }
  return data;
}

// Single export list (no duplicates anywhere else in this file)
export {
  API_BASE,
  AUTH_TOKEN_KEY,
  AUTH_REFRESH_KEY,
  apiFetch,
  getToken,
  setToken,
  setRefreshToken,
  clearTokens,
  setOnUnauthorized,
};

// Handy for debugging in the browser console
if (typeof window !== 'undefined') window.__API_BASE__ = API_BASE;
