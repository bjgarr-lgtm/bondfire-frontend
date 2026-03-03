// src/utils/api.js
// Central fetch wrapper with:
// - Bearer token support (multiple key names for back-compat)
// - Cookie/session support
// - Optional silent refresh on 401

const API_BASE = (import.meta?.env?.VITE_API_BASE || "").replace(/\/$/, "");

function pickToken() {
  try {
    return (
      localStorage.getItem("bf_token") ||
      localStorage.getItem("bf_auth_token") ||
      localStorage.getItem("bf_access_token") ||
      localStorage.getItem("bf_accessToken") ||
      ""
    );
  } catch {
    return "";
  }
}

function saveToken(tok) {
  if (!tok) return;
  try {
    localStorage.setItem("bf_token", tok);
  } catch {}
}

async function tryRefresh() {
  // If your backend doesn't support refresh, this just fails quietly.
  const url = `${API_BASE}/api/auth/refresh`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));

  // Support either cookie-only refresh or token-in-body refresh.
  if (data?.token) saveToken(data.token);
  if (data?.access_token) saveToken(data.access_token);

  return data;
}

export async function api(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const headers = new Headers(opts.headers || {});
  if (!headers.has("Content-Type") && opts.body != null) {
    headers.set("Content-Type", "application/json");
  }

  const token = pickToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Always include cookies if the server uses httpOnly sessions.
  const firstRes = await fetch(url, {
    ...opts,
    headers,
    credentials: "include",
  });

  if (firstRes.status !== 401) {
    if (!firstRes.ok) {
      const text = await firstRes.text().catch(() => "");
      throw new Error(text || `Request failed (${firstRes.status})`);
    }
    return firstRes.json().catch(() => ({}));
  }

  // 401: attempt silent refresh once, then retry.
  try {
    await tryRefresh();
  } catch {
    // ignore
  }

  const token2 = pickToken();
  const headers2 = new Headers(opts.headers || {});
  if (!headers2.has("Content-Type") && opts.body != null) {
    headers2.set("Content-Type", "application/json");
  }
  if (token2 && !headers2.has("Authorization")) {
    headers2.set("Authorization", `Bearer ${token2}`);
  }

  const retryRes = await fetch(url, {
    ...opts,
    headers: headers2,
    credentials: "include",
  });

  if (!retryRes.ok) {
    const text = await retryRes.text().catch(() => "");
    throw new Error(text || `Unauthorized (${retryRes.status})`);
  }
  return retryRes.json().catch(() => ({}));
}
