export function getAuthToken() {
  // legacy (kept so we don't explode older pages)
  return "";
}

let refreshing = null;

export async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});

  if (!headers.has("content-type") && opts.body && typeof opts.body === "string") {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  const doFetch = () => fetch(path, { ...opts, credentials: "include", headers });

  let res = await doFetch();
  if (res.status === 401) {
    if (!refreshing) {
      refreshing = (async () => {
        try {
          const r = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
          return r.ok;
        } finally {
          refreshing = null;
        }
      })();
    }
    const ok = await refreshing;
    if (ok) res = await doFetch();
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.ok === false) {
    const msg = data?.error || data?.message || `HTTP_${res.status}`;
    throw new Error(msg);
  }

  return data;
}
