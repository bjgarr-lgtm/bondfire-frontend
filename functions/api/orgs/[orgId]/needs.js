import { json, bad, now, uuid } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";
import { logActivity } from "../../_lib/activity.js";

function asString(v) {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

function asBool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = asString(v).trim().toLowerCase();
  if (!s) return fallback;
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return fallback;
}

function asInt(v, fallback = null) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

async function safeLog(env, payload) {
  try {
    await logActivity(env, payload);
  } catch (e) {
    // Logging should never block the actual user action.
    console.warn("activity log failed", e);
  }
}

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;

  const r = await env.BF_DB.prepare(
    `SELECT id, title, description, status, urgency, is_public, created_at, updated_at
     FROM needs
     WHERE org_id = ?
     ORDER BY COALESCE(updated_at, created_at) DESC`
  )
    .bind(orgId)
    .all();

  return json({ ok: true, needs: r?.results || [] });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!a.ok) return a.resp;

  const body = await request.json().catch(() => ({}));

  const title = asString(body.title).trim();
  if (!title) return bad("BAD_REQUEST", "Title is required", 400);

  const description = asString(body.description).trim();
  const status = asString(body.status).trim() || "open";
  const urgency = body.urgency == null ? null : asInt(body.urgency, null);
  const is_public = asBool(body.is_public, false) ? 1 : 0;

  const id = uuid();
  const t = now();

  await env.BF_DB.prepare(
    `INSERT INTO needs (id, org_id, title, description, status, urgency, is_public, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, orgId, title, description, status, urgency, is_public, t, t)
    .run();

  await safeLog(env, {
    orgId,
    kind: "need.created",
    message: title,
    actorUserId: a?.user?.sub || null,
    entityType: "need",
    entityId: id,
    entityTitle: title,
  });

  return json({ ok: true, id });
}

export async function onRequestPut({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!a.ok) return a.resp;

  const body = await request.json().catch(() => ({}));
  const id = asString(body.id).trim();
  if (!id) return bad("BAD_REQUEST", "id is required", 400);

  const existing = await env.BF_DB.prepare(
    `SELECT id, title, description, status, urgency, is_public
     FROM needs
     WHERE org_id = ? AND id = ?`
  )
    .bind(orgId, id)
    .first();

  if (!existing) return bad("NOT_FOUND", "Need not found", 404);

  const nextTitle =
    body.title === undefined ? existing.title : asString(body.title).trim();
  const nextDescription =
    body.description === undefined
      ? existing.description
      : asString(body.description).trim();
  const nextStatus =
    body.status === undefined ? existing.status : asString(body.status).trim();
  const nextUrgency =
    body.urgency === undefined ? existing.urgency : asInt(body.urgency, null);
  const nextPublic =
    body.is_public === undefined
      ? existing.is_public
      : asBool(body.is_public, false)
      ? 1
      : 0;

  const t = now();

  await env.BF_DB.prepare(
    `UPDATE needs
     SET title = ?, description = ?, status = ?, urgency = ?, is_public = ?, updated_at = ?
     WHERE org_id = ? AND id = ?`
  )
    .bind(
      nextTitle,
      nextDescription,
      nextStatus,
      nextUrgency,
      nextPublic,
      t,
      orgId,
      id
    )
    .run();

  await safeLog(env, {
    orgId,
    kind: "need.updated",
    message: (nextTitle || id),
    actorUserId: a?.user?.sub || null,
    entityType: "need",
    entityId: id,
    entityTitle: nextTitle || "",
  });

  return json({ ok: true });
}

export async function onRequestDelete({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!a.ok) return a.resp;

  const url = new URL(request.url);
  let id = url.searchParams.get("id");

  if (!id) {
    // allow JSON body too (some clients can't send query params easily)
    const body = await request.json().catch(() => ({}));
    id = asString(body.id).trim();
  }
  id = asString(id).trim();
  if (!id) return bad("BAD_REQUEST", "id is required", 400);

  const before = await env.BF_DB.prepare(
    `SELECT title FROM needs WHERE org_id = ? AND id = ?`
  )
    .bind(orgId, id)
    .first();

  await env.BF_DB.prepare(`DELETE FROM needs WHERE org_id = ? AND id = ?`)
    .bind(orgId, id)
    .run();

  await safeLog(env, {
    orgId,
    kind: "need.deleted",
    message: (before?.title || id),
    actorUserId: a?.user?.sub || null,
    entityType: "need",
    entityId: id,
    entityTitle: before?.title || "",
  });

  return json({ ok: true });
}
