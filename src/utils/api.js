// src/utils/api.js

// Cookie-based auth + CSRF.
// Access/refresh tokens live in httpOnly cookies.
// For unsafe requests, we send X-CSRF that matches the bf_csrf cookie.

function getCookie(name) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

export function getAuthToken() {
  // Legacy compatibility: token-based auth is deprecated.
  return "";
}

export async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});

  // JSON helper
  if (!headers.has("content-type") && opts.body && typeof opts.body === "string") {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  // CSRF for unsafe methods
  const method = (opts.method || "GET").toUpperCase();
  const unsafe = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  if (unsafe && !headers.has("x-csrf") && !headers.has("X-CSRF")) {
    const csrf = getCookie("bf_csrf");
    if (csrf) headers.set("X-CSRF", csrf);
  }

  const res = await fetch(path, {
    ...opts,
    headers,
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.ok === false) {
    const msg = data?.error || data?.message || `HTTP_${res.status}`;
    throw new Error(msg);
  }

  return data;
}
