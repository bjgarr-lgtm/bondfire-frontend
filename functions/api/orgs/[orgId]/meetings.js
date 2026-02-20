import { json, bad, now, uuid } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";
import { logActivity } from "../../_lib/activity.js";

async function ensureMeetingsZkColumns(db) {
  try { await db.prepare("ALTER TABLE meetings ADD COLUMN encrypted_notes TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE meetings ADD COLUMN key_version INTEGER").run(); } catch {}
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

// Meetings list endpoint
// Columns expected:
// id, org_id, title, starts_at, ends_at, location, agenda, notes, created_at, updated_at

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;

  await ensureMeetingsPublicColumn(env.BF_DB);
  await ensureMeetingsZkColumns(env.BF_DB);

  const res = await env.BF_DB.prepare(
    `SELECT id, title, starts_at, ends_at, location, agenda, notes, encrypted_notes, key_version, is_public, created_at, updated_at
     FROM meetings
     WHERE org_id = ?
     ORDER BY starts_at DESC, created_at DESC`
  )
    .bind(orgId)
    .all();

  return json({ ok: true, meetings: res.results || [] });
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
  const startsAt = Number.isFinite(Number(body.starts_at)) ? Number(body.starts_at) : t;
  const endsAt = Number.isFinite(Number(body.ends_at)) ? Number(body.ends_at) : startsAt;

  await ensureMeetingsPublicColumn(env.BF_DB);
  await ensureMeetingsZkColumns(env.BF_DB);

  const encryptedNotes = body.encrypted_notes ? String(body.encrypted_notes) : null;
  const keyVersion = body.key_version == null ? null : Number(body.key_version);

  await env.BF_DB.prepare(
    `INSERT INTO meetings (
        id, org_id, title, starts_at, ends_at, location, agenda, notes, encrypted_notes, key_version, is_public, created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      id,
      orgId,
      title,
      startsAt,
      endsAt,
      String(body.location || ""),
      String(body.agenda || ""),
      encryptedNotes ? "" : String(body.notes || ""),
      encryptedNotes,
      Number.isFinite(keyVersion) ? keyVersion : null,
      body.is_public ? 1 : 0,
      t,
      t
    )
    .run();

  try {
    await logActivity(env, {
    orgId,
    kind: "meeting.created",
    message: `meeting created: ${title}`,
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

  await ensureMeetingsPublicColumn(env.BF_DB);
  await ensureMeetingsZkColumns(env.BF_DB);
  const encryptedNotes =
    body.encrypted_notes === undefined ? undefined : (body.encrypted_notes ? String(body.encrypted_notes) : null);
  const keyVersion = body.key_version === undefined ? undefined : Number(body.key_version);

  const startsAt =
    body.starts_at === undefined || body.starts_at === null
      ? null
      : Number.isFinite(Number(body.starts_at))
      ? Number(body.starts_at)
      : 0;

  const endsAt =
    body.ends_at === undefined || body.ends_at === null
      ? null
      : Number.isFinite(Number(body.ends_at))
      ? Number(body.ends_at)
      : 0;

  await env.BF_DB.prepare(
    `UPDATE meetings
     SET title = COALESCE(?, title),
         starts_at = COALESCE(?, starts_at),
         ends_at = COALESCE(?, ends_at),
         location = COALESCE(?, location),
         agenda = COALESCE(?, agenda),
         notes = COALESCE(?, notes),
         encrypted_notes = COALESCE(?, encrypted_notes),
         key_version = COALESCE(?, key_version),
         is_public = COALESCE(?, is_public),
         updated_at = ?
     WHERE id = ? AND org_id = ?`
  )
    .bind(
      body.title ?? null,
      startsAt,
      endsAt,
      body.location ?? null,
      body.agenda ?? null,
      encryptedNotes ? "" : (body.notes ?? null),
      encryptedNotes === undefined ? null : encryptedNotes,
      keyVersion === undefined || !Number.isFinite(keyVersion) ? null : keyVersion,
      body.is_public === undefined ? null : (body.is_public ? 1 : 0),
      now(),
      id,
      orgId
    )
    .run();

  try {
    await logActivity(env, {
    orgId,
    kind: "meeting.updated",
    message: `meeting updated: ${id}`,
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

  await env.BF_DB.prepare("DELETE FROM meetings WHERE id = ? AND org_id = ?")
    .bind(id, orgId)
    .run();

const prev = await env.BF_DB.prepare(
  "SELECT title FROM meetings WHERE id = ? AND org_id = ?"
).bind(id, orgId).first();

const shortId = (x) =>
  typeof x === "string" && x.length > 12 ? `${x.slice(0, 8)}…${x.slice(-4)}` : (x || "");

const title = String(prev?.title || "").trim();
const label = title || shortId(id);

logActivity(env, {
  orgId,
  kind: "meeting.deleted",
  message: `Meeting deleted: ${label} (${shortId(id)})`,
  actorUserId: a?.user?.sub || a?.user?.id || null,
}).catch(() => {});


  return json({ ok: true });
}
