// src/utils/api.js
// Central API helper.
//
// Bondfire uses cookie-based sessions (HttpOnly tokens) so the browser must
// include cookies on requests. For unsafe methods we also send a CSRF header
// that matches the non-HttpOnly bf_csrf cookie (double-submit pattern).

function getCookie(name) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function isUnsafeMethod(method) {
  const m = (method || "GET").toUpperCase();
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS";
}

export async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  const method = (opts.method || "GET").toUpperCase();

  // Default JSON content-type when body is a JSON string.
  if (!headers.has("content-type") && opts.body && typeof opts.body === "string") {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  // CSRF: only for unsafe methods.
  if (isUnsafeMethod(method) && !headers.has("x-csrf")) {
    const csrf = getCookie("bf_csrf");
    if (csrf) headers.set("x-csrf", csrf);
  }

  const res = await fetch(path, {
    ...opts,
    method,
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
