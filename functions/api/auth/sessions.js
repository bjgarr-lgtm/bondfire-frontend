import { json } from "../_lib/http.js";
import { getDb, requireUser } from "../_lib/auth.js";

export async function onRequestGet({ env, request }) {
  const auth = await requireUser({ env, request });
  if (!auth.ok) return auth.resp;

  const db = getDb(env);
  const rows = await db.prepare(
    "SELECT id, expires_at FROM refresh_tokens WHERE user_id = ? ORDER BY expires_at DESC LIMIT 20"
  ).bind(auth.userId).all();

  return json({ ok: true, sessions: rows?.results || [] });
}
