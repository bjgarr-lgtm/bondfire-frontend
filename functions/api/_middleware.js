function corsHeadersFor(request) {
  // Cookie-based auth requires credentials-friendly CORS.
  // For same-origin requests this doesn't matter, but for safety we echo Origin.
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Vary": origin ? "Origin" : "",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "authorization, content-type, x-csrf",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  };
}

function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const parts = raw.split(";").map((s) => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx);
    const v = p.slice(idx + 1);
    if (k === name) return decodeURIComponent(v);
  }
  return "";
}

function isUnsafe(method) {
  const m = (method || "GET").toUpperCase();
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS";
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  // CSP tuned for this app (React inline styles are used heavily).
  // If you later remove inline styles, drop 'unsafe-inline'.
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
    "script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; font-src 'self' data:; " +
    "connect-src 'self' https: wss:;",
  // Keep it boring.
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

export async function onRequest({ request, next }) {
  const CORS_HEADERS = corsHeadersFor(request);

  // Preflight for cross-origin requests
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // CSRF: double-submit cookie pattern.
  // Only enforce on unsafe methods.
  if (isUnsafe(request.method)) {
    const csrfCookie = readCookie(request, "bf_csrf");
    const csrfHeader = request.headers.get("X-CSRF") || request.headers.get("x-csrf") || "";
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      const headers = new Headers(CORS_HEADERS);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
      return new Response(JSON.stringify({ ok: false, error: "CSRF" }), {
        status: 403,
        headers,
      });
    }
  }

  const resp = await next();
  const headers = new Headers(resp.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    if (v === "") continue;
    headers.set(k, v);
  }
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}
