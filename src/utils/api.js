// src/utils/api.js
// Central fetch wrapper with:
// - Bearer token support (multiple key names for back-compat)
// - Cookie/session support
// - Optional silent refresh on 401

import { isDemoMode } from "../demo/demoMode.js";
import { demoHandle, ensureDemoOrgList } from "../demo/demoStore.js";

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

// Robust JSON parsing: tolerate 204 and empty bodies.
async function readJsonMaybe(res) {
  if (!res) return null;
  if (res.status === 204 || res.status === 205) return null;

  const text = await res.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // Sometimes servers return plain text. Keep it available for debugging.
    return { raw: text };
  }
}

async function tryRefresh() {
  // If your backend doesn't support refresh, this just fails quietly.
  const rel = `/api/auth/refresh`;
  const url = API_BASE ? `${API_BASE}${rel}` : rel;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

  if (!res.ok) return null;

  const data = await readJsonMaybe(res);

  // Support either cookie-only refresh or token-in-body refresh.
  if (data?.token) saveToken(data.token);
  if (data?.access_token) saveToken(data.access_token);

  return data;
}

export async function api(path, opts = {}) {
  const rel = path.startsWith("/") ? path : `/${path}`;

  if (isDemoMode()) {
    ensureDemoOrgList();
    const handled = demoHandle(rel, opts);
    if (handled) return handled;
  }
  const candidates = (() => {
    if (path.startsWith("http")) return [path];
    if (!API_BASE) return [rel];
    if (rel.startsWith("/api/")) return [rel, `${API_BASE}${rel}`];
    return [`${API_BASE}${rel}`];
  })();

  const headers = new Headers(opts.headers || {});
  if (!headers.has("Content-Type") && opts.body != null) {
    headers.set("Content-Type", "application/json");
  }

  const token = pickToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Always include cookies if the server uses httpOnly sessions.
  let chosenUrl = candidates[0];
  let firstRes = null;

  for (let i = 0; i < candidates.length; i++) {
    const u = candidates[i];
    chosenUrl = u;
    try {
      const r = await fetch(u, { ...opts, headers, credentials: "include" });
      firstRes = r;

      const shouldTryNext =
        i < candidates.length - 1 && (r.status === 404 || r.status >= 500);

      if (!shouldTryNext) break;
    } catch {
      firstRes = null;
      // try next
    }
  }

  if (!firstRes) throw new Error("Network error");

  if (firstRes.status !== 401) {
    if (!firstRes.ok) {
      const text = await firstRes.text().catch(() => "");
      throw new Error(text || `Request failed (${firstRes.status})`);
    }
    return readJsonMaybe(firstRes) || {};
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

  const retryRes = await fetch(chosenUrl, {
    ...opts,
    headers: headers2,
    credentials: "include",
  });

  if (!retryRes.ok) {
    const text = await retryRes.text().catch(() => "");
    throw new Error(text || `Unauthorized (${retryRes.status})`);
  }

  return readJsonMaybe(retryRes) || {};
}