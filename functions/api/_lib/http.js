export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function bad(status, error, extra) {
  return json({ ok: false, error, ...(extra || {}) }, { status });
}

export function now() {
  return Date.now();
}

export function uuid() {
  return crypto.randomUUID();
}

export function ok(data = {}, init = {}) {
  const payload = (data && typeof data === "object") ? data : { value: data };
  return json({ ok: true, ...payload }, init);
}

export function err(status, message, extra) {
  return bad(status, message, extra);
}

export function readJSON(req) {
  // Cloudflare Request.json() throws on empty body / invalid JSON.
  // We return {} instead of exploding.
  return req.json().catch(() => ({}));
}

export function requireMethod(req, method) {
  const want = String(method || "").toUpperCase();
  const got = String(req.method || "").toUpperCase();
  if (want && got !== want) {
    // 405 Method Not Allowed
    return err(405, `METHOD_NOT_ALLOWED`, { want, got });
  }
  return null;
}
