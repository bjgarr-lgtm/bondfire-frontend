import { json, bad, now, uuid } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";
import { logActivity } from "../../_lib/activity.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;

  const res = await env.BF_DB.prepare(
    "SELECT id, name, role, phone, skills, notes, created_at, updated_at FROM people WHERE org_id = ? ORDER BY created_at DESC"
  ).bind(orgId).all();

  return json({ ok: true, people: res.results || [] });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!a.ok) return a.resp;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return bad(400, "MISSING_NAME");

  const id = uuid();
  const t = now();

  await env.BF_DB.prepare(
    `INSERT INTO people (id, org_id, name, role, phone, skills, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(
    id,
    orgId,
    name,
    String(body.role || ""),
    String(body.phone || ""),
    String(body.skills || ""),
    String(body.notes || ""),
    t,
    t
  ).run();

  try {
    await logActivity(env, {
    orgId,
    kind: "person.created",
    message: `person added: ${name}`,
    actorUserId: a?.user?.sub || null,
  });
  } catch (e) {
    console.error("ACTIVITY_FAIL", e);
  }

  return json({ ok: true, id });
}

export async function onRequestPut({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!a.ok) return a.resp;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return bad(400, "MISSING_ID");

  await env.BF_DB.prepare(
    `UPDATE people
     SET name = COALESCE(?, name),
         role = COALESCE(?, role),
         phone = COALESCE(?, phone),
         skills = COALESCE(?, skills),
         notes = COALESCE(?, notes),
         updated_at = ?
     WHERE id = ? AND org_id = ?`
  ).bind(
    body.name ?? null,
    body.role ?? null,
    body.phone ?? null,
    body.skills ?? null,
    body.notes ?? null,
    now(),
    id,
    orgId
  ).run();

  try {
    await logActivity(env, {
    orgId,
    kind: "person.updated",
    message: `person updated: ${id}`,
    actorUserId: a?.user?.sub || null,
  });
  } catch (e) {
    console.error("ACTIVITY_FAIL", e);
  }

  return json({ ok: true });
}

export async function onRequestDelete({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!a.ok) return a.resp;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return bad(400, "MISSING_ID");

  await env.BF_DB.prepare("DELETE FROM people WHERE id = ? AND org_id = ?")
    .bind(id, orgId).run();

  try {
    await logActivity(env, {
    orgId,
    kind: "person.deleted",
    message: `person deleted: ${id}`,
    actorUserId: a?.user?.sub || null,
  });
  } catch (e) {
    console.error("ACTIVITY_FAIL", e);
  }

  return json({ ok: true });
}
