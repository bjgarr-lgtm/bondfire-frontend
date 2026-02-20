import { ok, getCookie } from "../_lib/http.js";
import { sha256Hex, clearAuthCookieHeaders } from "../_lib/session.js";

export async function onRequestPost({ env, request }) {
  const rt = getCookie(request, "bf_rt");
  if (rt && env?.BF_DB) {
    const h = await sha256Hex(rt);
    await env.BF_DB.prepare("DELETE FROM refresh_tokens WHERE token_hash = ?").bind(h).run();
  }

  const isProd = (env?.ENV || env?.NODE_ENV || "").toLowerCase() === "production";
  const resp = ok({});
  for (const c of clearAuthCookieHeaders({ isProd })) resp.headers.append("set-cookie", c);
  return resp;
}
