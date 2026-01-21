export function getAuthToken() {
  return (
    localStorage.getItem("bf_auth_token") ||
    sessionStorage.getItem("bf_auth_token") ||
    ""
  );
}

export async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  const tok = getAuthToken();
  if (tok) headers.set("authorization", `Bearer ${tok}`);

  if (!headers.has("content-type") && opts.body && typeof opts.body === "string") {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.ok === false) {
    const msg = data?.error || data?.message || `HTTP_${res.status}`;
    throw new Error(msg);
  }

  return data;
}
