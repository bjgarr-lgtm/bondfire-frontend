export async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});

  // CSRF double-submit (cookie + header). Only for state-changing requests.
  const m = document.cookie.match(/(?:^|;\s*)bf_csrf=([^;]+)/);
  const csrf = m ? decodeURIComponent(m[1]) : "";
  const method = (opts.method || "GET").toUpperCase();
  if (csrf && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("x-csrf", csrf);
  }

  if (!headers.has("content-type") && opts.body && typeof opts.body === "string") {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  const doFetch = () => fetch(path, { ...opts, headers, credentials: "include" });

  let res = await doFetch();
  // If access token expired, attempt one silent refresh.
  if (res.status === 401) {
    const r = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" }).catch(() => null);
    if (r && r.ok) {
      res = await doFetch();
    }
  }
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.ok === false) {
    const msg = data?.error || data?.message || `HTTP_${res.status}`;
    throw new Error(msg);
  }

  return data;
}
