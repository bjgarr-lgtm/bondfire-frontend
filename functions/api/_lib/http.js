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
