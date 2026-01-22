import { json, bad, now } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const meetingId = params.meetingId;

  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;

  const row = await env.BF_DB.prepare(
    `SELECT id, title, starts_at, ends_at, location, agenda, notes, created_at, updated_at
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

  const body = await request.json().catch(() => ({}));

  await env.BF_DB.prepare(
    `UPDATE meetings
     SET title = COALESCE(?, title),
         starts_at = COALESCE(?, starts_at),
         ends_at = COALESCE(?, ends_at),
         location = COALESCE(?, location),
         agenda = COALESCE(?, agenda),
         notes = COALESCE(?, notes),
         updated_at = ?
     WHERE id = ? AND org_id = ?`
  ).bind(
    body.title ?? null,
    body.starts_at ?? null,
    body.ends_at ?? null,
    body.location ?? null,
    body.agenda ?? null,
    body.notes ?? null,
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
