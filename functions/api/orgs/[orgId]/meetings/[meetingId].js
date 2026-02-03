import { json, bad, now } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";

async function ensureMeetingsPublicColumn(db) {
  try {
    await db
      .prepare("ALTER TABLE meetings ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0")
      .run();
  } catch {
    // ignore (already exists)
  }
}

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const meetingId = params.meetingId;

  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;

  await ensureMeetingsPublicColumn(env.BF_DB);

  const row = await env.BF_DB.prepare(
    `SELECT id, title, starts_at, ends_at, location, agenda, notes, is_public, created_at, updated_at
     FROM meetings
     WHERE id = ? AND org_id = ?`
  ).bind(meetingId, orgId).first();

  if (!row) return bad(404, "NOT_FOUND");
  return json({ ok: true, meeting: row });
}

export async function onRequestPut({ env, request, params }) {
  const orgId = params.orgId;
  const meetingId = params.meetingId;

  const a = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!a.ok) return a.resp;

  await ensureMeetingsPublicColumn(env.BF_DB);

  const body = await request.json().catch(() => ({}));

  await env.BF_DB.prepare(
    `UPDATE meetings
     SET title = COALESCE(?, title),
         starts_at = COALESCE(?, starts_at),
         ends_at = COALESCE(?, ends_at),
         location = COALESCE(?, location),
         agenda = COALESCE(?, agenda),
         notes = COALESCE(?, notes),
         is_public = COALESCE(?, is_public),
         updated_at = ?
     WHERE id = ? AND org_id = ?`
  ).bind(
    body.title ?? null,
    body.starts_at ?? null,
    body.ends_at ?? null,
    body.location ?? null,
    body.agenda ?? null,
    body.notes ?? null,
    body.is_public === undefined ? null : (body.is_public ? 1 : 0),
    now(),
    meetingId,
    orgId
  ).run();

  return json({ ok: true });
}

export async function onRequestDelete({ env, request, params }) {
  const orgId = params.orgId;
  const meetingId = params.meetingId;

  const a = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!a.ok) return a.resp;

  await env.BF_DB.prepare("DELETE FROM meetings WHERE id = ? AND org_id = ?")
    .bind(meetingId, orgId)
    .run();

  return json({ ok: true });
}
