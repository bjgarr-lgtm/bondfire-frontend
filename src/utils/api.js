export function getAuthToken() {
  return (
    localStorage.getItem("bf_auth_token") ||
    sessionStorage.getItem("bf_auth_token") ||
    ""
  );
}

function getCookie(name) {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[-.$?*|{}()\[\]\\/+^]/g, "\\$&")}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

export async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  const tok = getAuthToken();
  if (tok) headers.set("authorization", `Bearer ${tok}`);

  // If we're using cookie sessions + CSRF, attach X-CSRF on unsafe methods.
  const method = String(opts.method || "GET").toUpperCase();
  const unsafe = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  if (unsafe && !headers.has("x-csrf")) {
    const csrf = getCookie("bf_csrf");
    if (csrf) headers.set("x-csrf", csrf);
  }

  if (!headers.has("content-type") && opts.body && typeof opts.body === "string") {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  const res = await fetch(path, { ...opts, headers, credentials: "include" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.ok === false) {
    const msg = data?.detail || data?.error_detail || data?.error || data?.message || `HTTP_${res.status}`;
    throw new Error(msg);
  }

  return data;
}
