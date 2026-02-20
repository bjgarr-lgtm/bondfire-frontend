import { json, bad, now, uuid } from "../_lib/http.js";
import { parseCookies, serializeCookie, clearCookie } from "../_lib/cookies.js";
import { sha256Hex } from "../_lib/crypto.js";
import { signJwt } from "../_lib/jwt.js";

export async function onRequestPost({ env, request }) {
  const cookies = parseCookies(request.headers.get("cookie") || "");
  const refreshRaw = cookies.bf_rt || "";
  if (!refreshRaw) return bad(401, "NO_REFRESH");

  const pepper = env.REFRESH_PEPPER || env.JWT_SECRET;
  const tokenHash = await sha256Hex(refreshRaw + ":" + pepper);

  const db = env.BF_DB;
  const row = await db
    .prepare("SELECT id, user_id, expires_at, revoked_at, replaced_by FROM refresh_tokens WHERE token_hash = ? LIMIT 1")
    .bind(tokenHash)
    .first();

  if (!row) return bad(401, "INVALID_REFRESH");
  if (row.revoked_at) return bad(401, "REVOKED_REFRESH");
  if (row.replaced_by) return bad(401, "STALE_REFRESH");
  if (row.expires_at && row.expires_at < now()) return bad(401, "EXPIRED_REFRESH");

  // Rotate refresh token (simple delete+insert; add revoke/rotation columns later)
  const newRefresh = uuid() + ":" + uuid();
  const newHash = await sha256Hex(newRefresh + ":" + pepper);

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const ua = request.headers.get("user-agent") || "";
  const ipHash = ip ? await sha256Hex(ip + ":" + pepper) : "";

  const refreshTtlSec = 60 * 60 * 24 * 30;
  const newId = uuid();

  await db
    .prepare("INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked_at, replaced_by, user_agent, ip_hash) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)")
    .bind(newId, row.user_id, newHash, now() + refreshTtlSec * 1000, now(), ua.slice(0, 256), ipHash)
    .run();

  
  // Issue new access token
  const user = await db
    .prepare("SELECT id, email, name FROM users WHERE id = ?")
    .bind(row.user_id)
    .first();

  if (!user) return bad(401, "INVALID_REFRESH");

  const accessTtlSec = 60 * 15;
  const token = await signJwt(env.JWT_SECRET, { sub: user.id, email: user.email, name: user.name }, accessTtlSec);

  const headers = new Headers();
  headers.append("Set-Cookie", serializeCookie("bf_at", token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: accessTtlSec }));
  headers.append("Set-Cookie", serializeCookie("bf_rt", newRefresh, { httpOnly: true, secure: true, sameSite: "Lax", path: "/api/auth", maxAge: refreshTtlSec }));

  return json({ ok: true, user: { id: user.id, email: user.email, name: user.name } }, { headers });
}
