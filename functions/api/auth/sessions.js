import { json } from "../_lib/http.js";
import { getDb, requireUser } from "../_lib/auth.js";

export async function onRequestGet({ env, request }) {
  const auth = await requireUser({ env, request });
  if (!auth.ok) return auth.resp;
  const userId = auth.user?.sub;
  if (!userId) return json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const db = getDb(env);
  const rows = await db.prepare(
    "SELECT id, expires_at FROM refresh_tokens WHERE user_id = ? ORDER BY expires_at DESC LIMIT 20"
  ).bind(userId).all();

  return json({ ok: true, sessions: rows?.results || [] });
}
