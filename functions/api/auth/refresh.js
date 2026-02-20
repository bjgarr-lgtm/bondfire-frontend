import { json, bad, parseCookies, cookie, clearCookie } from "../_lib/http.js";
import { sha256Hex } from "../_lib/crypto.js";
import { signJwt } from "../_lib/jwt.js";

function makeRefreshToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return `${crypto.randomUUID()}.${s}`;
}

export async function onRequestPost({ env, request }) {
  const cookies = parseCookies(request);
  const rt = cookies.bf_rt;
  if (!rt) return bad(401, "NO_REFRESH");

  const db = env.BF_DB;
  if (!db) return bad(500, "NO_DB_BINDING");

  const rtHash = await sha256Hex(`${env.JWT_SECRET}:${rt}`);
  const row = await db
    .prepare("SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ?")
    .bind(rtHash)
    .first();

  if (!row) return bad(401, "INVALID_REFRESH");
  if (row.expires_at && Number(row.expires_at) < Date.now()) {
    try { await db.prepare("DELETE FROM refresh_tokens WHERE id = ?").bind(row.id).run(); } catch {}
    return bad(401, "EXPIRED_REFRESH");
  }

  // rotate: delete old, insert new
  try { await db.prepare("DELETE FROM refresh_tokens WHERE id = ?").bind(row.id).run(); } catch {}

  const user = await db
    .prepare("SELECT id, email, name FROM users WHERE id = ?")
    .bind(row.user_id)
    .first();
  if (!user) return bad(401, "INVALID_REFRESH");

  const accessTtl = 60 * 15;
  const refreshTtl = 60 * 60 * 24 * 30;

  const at = await signJwt(env.JWT_SECRET, { sub: user.id, email: user.email, name: user.name }, accessTtl);

  const newRt = makeRefreshToken();
  const newHash = await sha256Hex(`${env.JWT_SECRET}:${newRt}`);
  const expiresAt = Date.now() + refreshTtl * 1000;

  await db.prepare(
    "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), user.id, newHash, expiresAt).run();

  const headers = new Headers();
  headers.append("set-cookie", cookie("bf_at", at, { httpOnly: true, sameSite: "Lax", path: "/", maxAge: accessTtl }));
  headers.append("set-cookie", cookie("bf_rt", newRt, { httpOnly: true, sameSite: "Strict", path: "/api/auth", maxAge: refreshTtl }));

  return json({ ok: true, user: { id: user.id, email: user.email, name: user.name } }, { headers });
}
