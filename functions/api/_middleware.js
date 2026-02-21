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
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

function corsHeadersFor(request) {
  // Cookie auth requires non-* ACAO + credentials.
  const origin = request.headers.get("Origin");
  const h = new Headers();
  if (origin) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Vary", "Origin");
    h.set("Access-Control-Allow-Credentials", "true");
  } else {
    // Same-origin requests (no Origin header)
    h.set("Access-Control-Allow-Origin", "*");
  }

  h.set(
    "Access-Control-Allow-Headers",
    "authorization, content-type, x-csrf"
  );
  h.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  // Cache preflights a bit.
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

function isApiJson(request) {
  const accept = request.headers.get("Accept") || "";
  const url = new URL(request.url);
  // Heuristic: if it's under /api OR accepts JSON, treat as JSON.
  return url.pathname.startsWith("/api/") || accept.includes("application/json");
}

export async function onRequest({ request, next }) {
  const cors = corsHeadersFor(request);

  // Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  let resp;
  try {
    resp = await next();
  } catch (err) {
    // Prevent Cloudflare 1101 "Worker threw exception" HTML pages.
    console.error("Unhandled exception in Pages Function:", err);
    const headers = new Headers(cors);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);

    const body = isApiJson(request)
      ? JSON.stringify({ error: "INTERNAL", message: "Worker exception" })
      : "Internal error";

    headers.set("Content-Type", isApiJson(request) ? "application/json" : "text/plain; charset=utf-8");
    return new Response(body, { status: 500, headers });
  }

  const headers = new Headers(resp.headers);
  // Apply CORS
  for (const [k, v] of cors.entries()) headers.set(k, v);
  // Apply security headers
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}
