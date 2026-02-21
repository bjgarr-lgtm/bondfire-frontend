// functions/api/_middleware.js
// Global API middleware: CORS + security headers + cookie-based CSRF protection.

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  // CSP tuned for this app (React inline styles are used heavily).
  // If you later remove inline styles, drop 'unsafe-inline'.
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
    "script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; font-src 'self' data:; " +
    "connect-src 'self' https: wss:;",
};

const CSRF_COOKIE = "bf_csrf";

function parseCookies(cookieHeader = "") {
  const out = {};
  cookieHeader.split(/;\s*/).forEach((kv) => {
    if (!kv) return;
    const i = kv.indexOf("=");
    if (i < 0) return;
    const k = kv.slice(0, i).trim();
    const v = kv.slice(i + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function base64Url(bytes) {
  // bytes: Uint8Array
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function mintCsrf() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return base64Url(b);
}

function setCookie(headers, name, value, attrs = "") {
  // Append Set-Cookie without clobbering existing.
  const line = `${name}=${encodeURIComponent(value)}; ${attrs}`.trim();
  headers.append("Set-Cookie", line);
}

function json(status, obj, extraHeaders = {}) {
  const h = new Headers({ "content-type": "application/json; charset=utf-8" });
  for (const [k, v] of Object.entries(extraHeaders)) h.set(k, v);
  return new Response(JSON.stringify(obj), { status, headers: h });
}

function isUnsafe(method) {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function isCsrfExempt(pathname) {
  // Bootstrap endpoints cannot require CSRF because the cookie may not exist yet.
  // Keep this list tight.
  return (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/register" ||
    pathname === "/api/auth/login/mfa" ||
    pathname === "/api/auth/refresh" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/logout_all"
  );
}

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || "";

  // CORS: allow same-origin + explicit Origin with credentials.
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin || "*",
    "Vary": origin ? "Origin" : undefined,
    "Access-Control-Allow-Credentials": origin ? "true" : undefined,
    "Access-Control-Allow-Headers": "authorization, content-type, x-csrf",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  };

  if (request.method === "OPTIONS") {
    const h = new Headers();
    for (const [k, v] of Object.entries(corsHeaders)) if (v) h.set(k, v);
    return new Response(null, { status: 204, headers: h });
  }

  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const hasCsrf = !!cookies[CSRF_COOKIE];

  // Enforce CSRF on unsafe requests (except exempt endpoints).
  if (isUnsafe(request.method) && !isCsrfExempt(url.pathname)) {
    const csrfCookie = cookies[CSRF_COOKIE] || "";
    const csrfHeader = request.headers.get("X-CSRF") || request.headers.get("x-csrf") || "";
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      // Also mint a cookie so the next attempt can succeed without a full reload.
      const h = new Headers();
      for (const [k, v] of Object.entries(corsHeaders)) if (v) h.set(k, v);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
      if (!hasCsrf) {
        const token = mintCsrf();
        setCookie(h, CSRF_COOKIE, token, "Path=/; SameSite=Lax; Secure");
      }
      return json(403, { ok: false, error: "CSRF" }, Object.fromEntries(h.entries()));
    }
  }

  const resp = await next();
  const headers = new Headers(resp.headers);

  for (const [k, v] of Object.entries(corsHeaders)) {
    if (!v) continue;
    headers.set(k, v);
  }
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }

  // Ensure CSRF cookie exists for authenticated flows.
  if (!hasCsrf) {
    const token = mintCsrf();
    setCookie(headers, CSRF_COOKIE, token, "Path=/; SameSite=Lax; Secure");
  }

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}
