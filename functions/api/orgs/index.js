// functions/api/orgs/index.js
// NOTE: This endpoint MUST support both legacy Bearer JWT auth and the newer
// httpOnly cookie-session auth. The Org Dashboard depends on it.

import { json, bad } from "../_lib/http.js";
import { getDb, requireUser } from "../_lib/auth.js";

export async function onRequestGet({ env, request }) {
  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;

  const userId = u.user?.sub;
  if (!userId) return bad(401, "UNAUTHORIZED");

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");

  const res = await db
    .prepare(
      `SELECT o.id as id, o.name as name, m.role as role
       FROM org_memberships m
       JOIN orgs o ON o.id = m.org_id
       WHERE m.user_id = ?
       ORDER BY o.created_at DESC`
    )
    .bind(userId)
    .all();

  return json({ ok: true, orgs: res.results || [] });
}
