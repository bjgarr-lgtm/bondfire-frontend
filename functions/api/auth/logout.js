import { ok, bad, parseCookies, clearCookie } from "../_lib/http.js";
import { sha256Hex } from "../_lib/crypto.js";

export async function onRequestPost({ env, request }) {
  const db = env.BF_DB;
  if (!db) return bad(500, "NO_DB_BINDING");

  const cookies = parseCookies(request);
  const rt = cookies.bf_rt;

  if (rt) {
    const rtHash = await sha256Hex(`${env.JWT_SECRET}:${rt}`);
    try {
      await db.prepare("DELETE FROM refresh_tokens WHERE token_hash = ?").bind(rtHash).run();
    } catch {}
  }

  const headers = new Headers();
  headers.append("set-cookie", clearCookie("bf_at", { path: "/" }));
  headers.append("set-cookie", clearCookie("bf_rt", { path: "/api/auth" }));
  return ok({}, { headers });
}
