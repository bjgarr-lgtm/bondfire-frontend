// functions/api/orgs/index.js
import { json, bad } from "../_lib/http.js";
import { verifyJwt } from "../_lib/jwt.js";

function getToken(request) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function onRequestGet({ env, request }) {
  const token = getToken(request);
  if (!token) return bad(401, "NO_TOKEN");
  if (!env.JWT_SECRET) return bad(500, "JWT_SECRET_MISSING");
  if (!env.BF_DB) return bad(500, "BF_DB_MISSING");

  const payload = await verifyJwt(env.JWT_SECRET, token).catch(() => null);
  const userId = payload?.sub;
  if (!userId) return bad(401, "BAD_TOKEN");

  const res = await env.BF_DB.prepare(
    `SELECT o.id as id, o.name as name, m.role as role
     FROM org_memberships m
     JOIN orgs o ON o.id = m.org_id
     WHERE m.user_id = ?
     ORDER BY o.created_at DESC`
  ).bind(userId).all();

  return json({ ok: true, orgs: res.results || [] });
}
