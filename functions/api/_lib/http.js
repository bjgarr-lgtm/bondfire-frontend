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


export function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  const out = {};
  header.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) return;
    out[k] = decodeURIComponent(v);
  });
  return out;
}

export function cookie(name, value, opts = {}) {
  const parts = [];
  parts.push(`${name}=${encodeURIComponent(value ?? "")}`);
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.expires) parts.push(`Expires=${new Date(opts.expires).toUTCString()}`);
  parts.push(`Path=${opts.path || "/"}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure !== false) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite || "Lax"}`);
  return parts.join("; ");
}

export function clearCookie(name, opts = {}) {
  return cookie(name, "", { ...opts, maxAge: 0, expires: 0 });
}
