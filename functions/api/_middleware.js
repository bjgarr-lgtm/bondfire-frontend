function corsHeadersFor(request) {
  const origin = request.headers.get("Origin") || "";
  // Cookie auth requires a concrete origin, not '*'. We reflect Origin.
  // If you later add an allowlist, enforce it here.
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Vary": "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  };
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
  // Preflight for cross-origin Authorization header requests
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeadersFor(request) });
  }

  // CSRF protection for cookie-based auth.
  // Double-submit: SPA reads bf_csrf cookie and echoes it as X-CSRF.
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const csrfExempt =
    method === "GET" ||
    method === "HEAD" ||
    url.pathname.startsWith("/api/auth/login") ||
    url.pathname.startsWith("/api/auth/register") ||
    url.pathname.startsWith("/api/auth/refresh") ||
    url.pathname.startsWith("/api/auth/logout");

  if (!csrfExempt) {
    const cookie = request.headers.get("cookie") || "";
    const m = cookie.match(/(?:^|;\s*)bf_csrf=([^;]+)/);
    let csrfCookie = "";
    if (m) {
      try {
        csrfCookie = decodeURIComponent(m[1]);
      } catch {
        csrfCookie = m[1];
      }
    }
    const csrfHeader = request.headers.get("x-csrf") || "";
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return new Response(JSON.stringify({ ok: false, error: "CSRF" }), {
        status: 403,
        headers: {
          "content-type": "application/json",
          ...corsHeadersFor(request),
        },
      });
    }
  }

  const resp = await next();
  const headers = new Headers(resp.headers);
  for (const [k, v] of Object.entries(corsHeadersFor(request))) headers.set(k, v);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}
