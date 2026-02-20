function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowList = String(env?.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // If no allow list is provided, default to same-origin behavior:
  // - If there's no Origin header, it's not a CORS fetch.
  // - If there is an Origin header, allow it only if it matches the request host.
  let allowOrigin = "";
  if (!origin) {
    allowOrigin = "";
  } else if (allowList.length) {
    if (allowList.includes(origin)) allowOrigin = origin;
  } else {
    try {
      const o = new URL(origin);
      const host = request.headers.get("host") || "";
      if (o.host === host) allowOrigin = origin;
      // dev convenience
      if (o.hostname === "localhost" || o.hostname === "127.0.0.1") allowOrigin = origin;
    } catch {}
  }

  const h = {};
  if (allowOrigin) {
    h["Access-Control-Allow-Origin"] = allowOrigin;
    h["Access-Control-Allow-Credentials"] = "true";
    h["Vary"] = "Origin";
  }
  h["Access-Control-Allow-Headers"] = "authorization, content-type";
  h["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
  return h;
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
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  const resp = await next();
  const headers = new Headers(resp.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}
