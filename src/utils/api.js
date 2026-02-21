function readCookie(name) {
  const raw = typeof document !== "undefined" ? document.cookie || "" : "";
  const parts = raw.split(";").map((s) => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const i = p.indexOf("=");
    const k = i >= 0 ? p.slice(0, i) : p;
    if (k === name) return decodeURIComponent(i >= 0 ? p.slice(i + 1) : "");
  }
  return "";
}

export function getAuthToken() {
  // Back-compat for older deployments still using Bearer tokens.
  return (
    localStorage.getItem("bf_auth_token") ||
    sessionStorage.getItem("bf_auth_token") ||
    ""
  );
}

export async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  const tok = getAuthToken();
  if (tok && !headers.has("authorization")) headers.set("authorization", `Bearer ${tok}`);

  // Cookie sessions
  const method = String(opts.method || "GET").toUpperCase();
  const unsafe = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  if (unsafe && !headers.has("x-csrf")) {
    const csrf = readCookie("bf_csrf");
    if (csrf) headers.set("x-csrf", csrf);
  }

  if (!headers.has("content-type") && opts.body && typeof opts.body === "string") {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  const res = await fetch(path, {
    ...opts,
    headers,
    credentials: opts.credentials || "include",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.ok === false) {
    const base = data?.error || data?.message || `HTTP_${res.status}`;
    const detail = data?.detail || data?.error_detail || data?.reason || "";
    throw new Error(detail ? `${base}: ${detail}` : base);
  }

  return data;
}
