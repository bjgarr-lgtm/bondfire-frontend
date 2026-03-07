import { json, bad, now } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";

async function ensureMemberRsvpTable(db) {
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS meeting_rsvps (
      org_id TEXT NOT NULL,
      meeting_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )`).run();
  } catch {}
}

async function ensurePublicRsvpTable(db) {
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS public_meeting_rsvps (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      meeting_id TEXT NOT NULL,
      name TEXT,
      contact TEXT,
      status TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`).run();
  } catch {}
}

async function getRsvpCounts(db, orgId, meetingId) {
  await ensureMemberRsvpTable(db);
  await ensurePublicRsvpTable(db);

  const empty = { yes: 0, maybe: 0, no: 0, total: 0 };

  const fold = (row) => ({
    yes: Number(row?.yes_count || 0),
    maybe: Number(row?.maybe_count || 0),
    no: Number(row?.no_count || 0),
    total: Number(row?.total_count || 0),
  });

  const [memberRow, publicRow] = await Promise.all([
    db.prepare(`SELECT
      SUM(CASE WHEN lower(status) = 'yes' THEN 1 ELSE 0 END) AS yes_count,
      SUM(CASE WHEN lower(status) = 'maybe' THEN 1 ELSE 0 END) AS maybe_count,
      SUM(CASE WHEN lower(status) = 'no' THEN 1 ELSE 0 END) AS no_count,
      COUNT(*) AS total_count
      FROM meeting_rsvps
      WHERE org_id = ? AND meeting_id = ?`).bind(orgId, meetingId).first().catch(() => null),
    db.prepare(`SELECT
      SUM(CASE WHEN lower(status) = 'yes' THEN 1 ELSE 0 END) AS yes_count,
      SUM(CASE WHEN lower(status) = 'maybe' THEN 1 ELSE 0 END) AS maybe_count,
      SUM(CASE WHEN lower(status) = 'no' THEN 1 ELSE 0 END) AS no_count,
      COUNT(*) AS total_count
      FROM public_meeting_rsvps
      WHERE org_id = ? AND meeting_id = ?`).bind(orgId, meetingId).first().catch(() => null),
  ]);

  const member = memberRow ? fold(memberRow) : { ...empty };
  const publicCounts = publicRow ? fold(publicRow) : { ...empty };

  return {
    member,
    public: publicCounts,
    combined: {
      yes: member.yes + publicCounts.yes,
      maybe: member.maybe + publicCounts.maybe,
      no: member.no + publicCounts.no,
      total: member.total + publicCounts.total,
    },
  };
}

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

  const rsvp_counts = await getRsvpCounts(env.BF_DB, orgId, meetingId);
  return json({ ok: true, meeting: { ...row, rsvp_counts } });
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
