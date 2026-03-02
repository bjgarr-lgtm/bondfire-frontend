function readCookie(name) {
  const raw = typeof document !== "undefined" ? document.cookie || "" : "";
  const parts = raw.split(";").map((s) => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const i = p.indexOf("=");
    const k = i >= 0 ? p.slice(0, i) : p;
    if (k === name) return decodeURIComponent(i >= 0 ? p.slice(i + 1) : "");
  }
  return "";
}

// Optional separate API host. Keep it safe: never reference an undefined global.
// If not set, we stick to same-origin.
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof window !== "undefined" && window.__BF_API_BASE__) ||
  "";

export function getAuthToken() {
  // Back-compat for older deployments still using Bearer tokens.
  return (
    localStorage.getItem("bf_auth_token") ||
    sessionStorage.getItem("bf_auth_token") ||
    ""
  );
}

export async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  const tok = getAuthToken();
  // If we have a cookie session (bf_csrf), prefer it and DO NOT send stale Bearer tokens.
  const csrfCookie = readCookie("bf_csrf");
  const cookieSessionActive = !!csrfCookie;
  if (!cookieSessionActive && tok && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${tok}`);
  }

  // Cookie sessions
  const method = String(opts.method || "GET").toUpperCase();
  const unsafe = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  if (unsafe && !headers.has("x-csrf")) {
    const csrf = csrfCookie || readCookie("bf_csrf");
    if (csrf) headers.set("x-csrf", csrf);
  }

  if (!headers.has("content-type") && opts.body && typeof opts.body === "string") {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  const doFetch = async () =>
    fetch(path, {
      ...opts,
      headers,
      credentials: opts.credentials || "include",
    });

  let res = await doFetch();

  // If the session expired, try a one-time refresh and retry.
  // This reduces the "randomly logged out" experience when the backend uses short-lived sessions.
  if (res.status === 401) {
    try {
      // Try both same-origin and API_BASE (in case the frontend talks to a separate API host).
      const refreshUrls = [
        "/api/auth/refresh",
        API_BASE ? `${API_BASE}/api/auth/refresh` : "",
      ].filter((u) => typeof u === "string" && u);
      for (const u of refreshUrls) {
        try {
          const rr = await fetch(u, {
            method: "POST",
            credentials: "include",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: "{}",
          });
          // If refresh succeeded, retry the original request.
          if (rr && rr.ok) {
            res = await doFetch();
            break;
          }
        } catch {
          // ignore and try next URL
        }
      }
    } catch {
      // ignore
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.ok === false) {
    const base = data?.error || data?.message || `HTTP_${res.status}`;
    const detail = data?.detail || data?.error_detail || data?.reason || "";
    throw new Error(detail ? `${base}: ${detail}` : base);
  }

  return data;
}
