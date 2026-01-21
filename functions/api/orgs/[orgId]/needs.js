import { json, bad, now, uuid } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;

  const res = await env.BF_DB.prepare(
    "SELECT id, title, description, urgency, status, is_public, created_at, updated_at FROM needs WHERE org_id = ? ORDER BY created_at DESC"
  ).bind(orgId).all();

  return json({ ok: true, needs: res.results || [] });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!a.ok) return a.resp;

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return bad(400, "MISSING_TITLE");

  const id = uuid();
  const t = now();

  await env.BF_DB.prepare(
    `INSERT INTO needs (id, org_id, title, description, urgency, status, is_public, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(
    id,
    orgId,
    title,
    String(body.description || ""),
    String(body.urgency || ""),
    String(body.status || "open"),
    body.is_public ? 1 : 0,
    t,
    t
  ).run();

  return json({ ok: true, id });
}

export async function onRequestPut({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!a.ok) return a.resp;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return bad(400, "MISSING_ID");

  const isPublic =
    typeof body.is_public === "boolean" ? (body.is_public ? 1 : 0) : null;

  await env.BF_DB.prepare(
    `UPDATE needs
     SET title = COALESCE(?, title),
         description = COALESCE(?, description),
         urgency = COALESCE(?, urgency),
         status = COALESCE(?, status),
         is_public = COALESCE(?, is_public),
         updated_at = ?
     WHERE id = ? AND org_id = ?`
  ).bind(
    body.title ?? null,
    body.description ?? null,
    body.urgency ?? null,
    body.status ?? null,
    isPublic,
    now(),
    id,
    orgId
  ).run();

  return json({ ok: true });
}

export async function onRequestDelete({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!a.ok) return a.resp;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return bad(400, "MISSING_ID");

  await env.BF_DB.prepare("DELETE FROM needs WHERE id = ? AND org_id = ?")
    .bind(id, orgId)
    .run();

  return json({ ok: true });
}
