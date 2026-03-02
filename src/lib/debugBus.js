// src/lib/debugBus.js
// Tiny in-browser debug ring buffer for Bondfire.
// Enabled via ?debug=1 or localStorage bf_debug=1

const MAX = 250;

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return String(Date.now());
  }
}

export function isDebugEnabled() {
  try {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("debug") === "1") return true;
    if (qs.get("bf_debug") === "1") return true;
    return String(localStorage.getItem("bf_debug") || "") === "1";
  } catch {
    return false;
  }
}

function getStore() {
  if (!window.__BF_DEBUG__) {
    window.__BF_DEBUG__ = { logs: [] };
  }
  return window.__BF_DEBUG__;
}

export function debugLog(type, detail = {}) {
  if (!isDebugEnabled()) return;
  const store = getStore();

  const entry = {
    t: nowIso(),
    type: String(type || "log"),
    detail: detail && typeof detail === "object" ? detail : { value: detail },
  };

  store.logs.push(entry);
  if (store.logs.length > MAX) store.logs.splice(0, store.logs.length - MAX);

  try {
    // lightweight persistence so you can refresh and still see the last few events
    sessionStorage.setItem("bf_debug_logs", JSON.stringify(store.logs.slice(-120)));
  } catch {
    // ignore
  }
}

export function getDebugLogs() {
  const store = getStore();
  if (store.logs.length) return store.logs;

  try {
    const raw = sessionStorage.getItem("bf_debug_logs");
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      store.logs = parsed;
      return store.logs;
    }
  } catch {
    // ignore
  }

  return store.logs;
}

export function clearDebugLogs() {
  const store = getStore();
  store.logs = [];
  try {
    sessionStorage.removeItem("bf_debug_logs");
  } catch {
    // ignore
  }
}
