const CORS_HEADERS_BASE = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  // CSP tuned for this app (React inline styles are used heavily).
  // If you later remove inline styles, drop 'unsafe-inline'.
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests;",

export async function onRequest({ request, next }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = { ...CORS_HEADERS_BASE };
  if (origin) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
    corsHeaders["Vary"] = "Origin";
  }

  // Preflight for cross-origin Authorization header requests
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
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
