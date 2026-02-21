// src/utils/api.js
// Cookie-session + CSRF aware API helper.

function getCookie(name) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+./?[\\\]^{|}-]/g, "\\$&")}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

export function getAuthToken() {
  // Legacy token support (kept for backwards compatibility during rollout).
  return (
    localStorage.getItem("bf_auth_token") ||
    sessionStorage.getItem("bf_auth_token") ||
    ""
  );
}

export async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});

  // Always send cookies for same-origin auth.
  const method = String(opts.method || "GET").toUpperCase();
  const unsafe = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

  // Send CSRF for unsafe requests if present.
  if (unsafe && !headers.has("x-csrf")) {
    const csrf = getCookie("bf_csrf");
    if (csrf) headers.set("x-csrf", csrf);
  }

  // Legacy bearer token (if some env still uses it).
  const tok = getAuthToken();
  if (tok && !headers.has("authorization")) headers.set("authorization", `Bearer ${tok}`);

  // JSON convenience.
  if (!headers.has("content-type") && opts.body && typeof opts.body === "string") {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  const res = await fetch(path, {
    ...opts,
    headers,
    credentials: "include",
  });

  const ctype = res.headers.get("content-type") || "";
  const isJson = ctype.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");

  if (!res.ok || (isJson && data?.ok === false)) {
    const msg = isJson
      ? (data?.error_detail || data?.detail || data?.error || data?.message || `HTTP_${res.status}`)
      : `HTTP_${res.status}`;
    throw new Error(msg);
  }

  return isJson ? data : { ok: true, text: data };
}
