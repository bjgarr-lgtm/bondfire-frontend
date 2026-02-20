// src/lib/api.js
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

let refreshing = null;

export async function apiFetch(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const init = {
    credentials: "include",
    ...opts,
    headers: {
      ...(opts.headers || {}),
    },
  };

  // default json content-type for bodies that are plain objects
  if (init.body && typeof init.body === "object" && !(init.body instanceof FormData) && !(init.body instanceof Blob)) {
    init.headers["Content-Type"] = init.headers["Content-Type"] || "application/json";
    init.body = JSON.stringify(init.body);
  }

  const res = await fetch(url, init);
  if (res.status !== 401) return res;

  // Try one refresh then retry once.
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/auth/refresh`, { method: "POST", credentials: "include" });
        return r.ok;
      } finally {
        refreshing = null;
      }
    })();
  }
  const ok = await refreshing;
  if (!ok) return res;

  return fetch(url, init);
}

export async function apiJSON(path, opts) {
  const res = await apiFetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `HTTP_${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
