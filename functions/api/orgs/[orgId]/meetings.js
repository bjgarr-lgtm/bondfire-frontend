import { json, bad, now, uuid } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";
import { logActivity } from "../../_lib/activity.js";
async function getOrgCryptoKeyVersion(db, orgId) {
	// org_crypto historically used either key_version or version.
	try {
		const r = await db.prepare("SELECT key_version FROM org_crypto WHERE org_id = ?").bind(orgId).first();
		return Number(r?.key_version) || 1;
	} catch (e) {
		const msg = String(e?.message || "");
		if (!msg.includes("no such column: key_version")) throw e;
		const r = await db.prepare("SELECT version AS key_version FROM org_crypto WHERE org_id = ?").bind(orgId).first();
		return Number(r?.key_version) || 1;
	}
}

async function ensureMeetingsZkColumns(db) {
	try { await db.prepare("ALTER TABLE meetings ADD COLUMN encrypted_notes TEXT").run(); } catch {}
	try { await db.prepare("ALTER TABLE meetings ADD COLUMN encrypted_blob TEXT").run(); } catch {}
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
	  `SELECT id, title, starts_at, ends_at, location, agenda, notes, is_public, encrypted_notes, encrypted_blob, key_version, created_at, updated_at
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

	let keyVersion = null;
	if (body.encrypted_blob) {
		keyVersion = await getOrgCryptoKeyVersion(db, orgId);
	}

	await env.BF_DB.prepare(
	  `INSERT INTO meetings (
	      id, org_id, title, starts_at, ends_at, location, agenda, notes, is_public, encrypted_notes, encrypted_blob, key_version, created_at, updated_at
	   ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
	)
    .bind(
      id,
      orgId,
      title,
      startsAt,
      endsAt,
      String(body.location || ""),
      String(body.agenda || ""),
      String(body.notes || ""),
      body.is_public ? 1 : 0,
	    body.encrypted_notes ?? null,
	    body.encrypted_blob ?? null,
	    keyVersion,
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

	let keyVersion = null;
	if (body.encrypted_blob) {
		keyVersion = await getOrgCryptoKeyVersion(db, orgId);
	}

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
         is_public = COALESCE(?, is_public),
	       encrypted_notes = COALESCE(?, encrypted_notes),
	       encrypted_blob = COALESCE(?, encrypted_blob),
	       key_version = COALESCE(?, key_version),
         updated_at = ?
     WHERE id = ? AND org_id = ?`
  )
    .bind(
      body.title ?? null,
      startsAt,
      endsAt,
      body.location ?? null,
      body.agenda ?? null,
      body.notes ?? null,
      body.is_public === undefined ? null : (body.is_public ? 1 : 0),
	    body.encrypted_notes ?? null,
	    body.encrypted_blob ?? null,
	    keyVersion,
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
