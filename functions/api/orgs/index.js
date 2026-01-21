import { json, bad, now, uuid } from "../_lib/http.js";
import { requireUser } from "../_lib/auth.js";

export async function onRequestGet({ env, request }) {
  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;

  const res = await env.BF_DB.prepare(
    `SELECT o.id, o.name, m.role
     FROM orgs o
     JOIN org_memberships m ON m.org_id = o.id
     WHERE m.user_id = ?
     ORDER BY o.created_at DESC`
  ).bind(u.user.sub).all();

  return json({ ok: true, orgs: res.results || [] });
}

export async function onRequestPost({ env, request }) {
  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return bad(400, "MISSING_NAME");

  const orgId = uuid();
  await env.BF_DB.prepare(
    "INSERT INTO orgs (id, name, created_at) VALUES (?,?,?)"
  ).bind(orgId, name, now()).run();

  await env.BF_DB.prepare(
    "INSERT INTO org_memberships (org_id, user_id, role, created_at) VALUES (?,?,?,?)"
  ).bind(orgId, u.user.sub, "owner", now()).run();

  return json({ ok: true, org: { id: orgId, name }, role: "owner" });
}
