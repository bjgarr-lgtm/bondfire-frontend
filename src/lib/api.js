// src/lib/api.js
import { debugLog } from "./debugBus.js";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

let refreshing = null;

// Robust JSON parsing: tolerate 204 and empty bodies.
async function readJsonMaybe(res) {
  if (!res) return null;
  if (res.status === 204 || res.status === 205) return null;

  const text = await res.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function apiFetch(path, opts = {}) {
  const startedAt = Date.now();
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  debugLog("api:request", {
    url,
    method: (opts?.method || "GET").toString(),
  });

  const init = {
    credentials: "include",
    ...opts,
    headers: {
      ...(opts.headers || {}),
    },
  };

  // default json content-type for bodies that are plain objects
  if (
    init.body &&
    typeof init.body === "object" &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof Blob)
  ) {
    init.headers["Content-Type"] = init.headers["Content-Type"] || "application/json";
    init.body = JSON.stringify(init.body);
  }

  const res = await fetch(url, init);
  debugLog("api:response", { url, status: res.status, ms: Date.now() - startedAt });
  if (res.status !== 401) return res;

  // Try one refresh then retry once.
  if (!refreshing) {
    refreshing = (async () => {
      try {
        debugLog("api:refresh_start", { url });
        const r = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        debugLog("api:refresh_result", { ok: r.ok, status: r.status });
        return r.ok;
      } finally {
        refreshing = null;
      }
    })();
  }

  const ok = await refreshing;
  if (!ok) {
    debugLog("api:refresh_failed", { url });
    return res;
  }

  const res2 = await fetch(url, init);
  debugLog("api:retry_response", { url, status: res2.status });
  return res2;
}

export async function apiJSON(path, opts) {
  const res = await apiFetch(path, opts);

  const data = await readJsonMaybe(res);

  if (!res.ok) {
    const msg =
      data?.error ||
      data?.message ||
      data?.raw ||
      `HTTP_${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  // Maintain old behavior: callers expect an object
  return data || {};
}