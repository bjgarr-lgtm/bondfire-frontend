import { json, now } from "../_lib/http.js";
import { parseCookies, clearCookie } from "../_lib/cookies.js";
import { sha256Hex } from "../_lib/crypto.js";

export async function onRequestPost({ env, request }) {
  const cookies = parseCookies(request.headers.get("cookie") || "");
  const refreshRaw = cookies.bf_rt || "";

  const headers = new Headers();
  headers.append("Set-Cookie", clearCookie("bf_at", { httpOnly: true, secure: true, sameSite: "Lax", path: "/" }));
  headers.append("Set-Cookie", clearCookie("bf_rt", { httpOnly: true, secure: true, sameSite: "Lax", path: "/api/auth" }));

  if (refreshRaw) {
    const pepper = env.REFRESH_PEPPER || env.JWT_SECRET;
    const tokenHash = await sha256Hex(refreshRaw + ":" + pepper);
    const db = env.BF_DB;
    await db
      .prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
      .bind(now(), tokenHash)
      .run();
  }

  return json({ ok: true }, { headers });
}
