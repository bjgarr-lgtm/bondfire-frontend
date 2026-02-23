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

// UI sends urgency as free text ("high") but DB stores priority as int (NOT NULL).
function parsePriority(v, fallback = 0) {
  if (v == null || v === "") return fallback;

  if (typeof v === "number") {
    return Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : fallback;
  }

  const s = asString(v).trim().toLowerCase();
  if (!s) return fallback;

  const n = Number(s);
  if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));

  if (["high", "urgent", "h"].includes(s)) return 3;
  if (["medium", "med", "m"].includes(s)) return 2;
  if (["low", "l"].includes(s)) return 1;

  return fallback;
}

async function safeLog(env, payload) {
  try {
    await logActivity(env, payload);
  } catch (e) {
    // Logging should never block the actual user action.
    console.warn("activity log failed", e);
  }
}

async function ensureNeedsZkColumns(db) {
	try { await db.prepare("ALTER TABLE needs ADD COLUMN encrypted_description TEXT").run(); } catch {}
	try { await db.prepare("ALTER TABLE needs ADD COLUMN encrypted_blob TEXT").run(); } catch {}
	try { await db.prepare("ALTER TABLE needs ADD COLUMN key_version INTEGER").run(); } catch {}
}

export async function onRequestGet({ env, request, params }) {
	await ensureNeedsZkColumns(env.BF_DB);
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;

  const r = await env.BF_DB.prepare(
    `SELECT
       id,
       title,
       description,
       status,
       priority,
       CASE
         WHEN priority >= 3 THEN 'high'
         WHEN priority = 2 THEN 'medium'
         WHEN priority = 1 THEN 'low'
         ELSE ''
       END AS urgency,
	     is_public,
	     encrypted_description,
	     encrypted_blob,
	     key_version,
       created_at,
       updated_at
     FROM needs
     WHERE org_id = ?
     ORDER BY COALESCE(updated_at, created_at) DESC`
  )
    .bind(orgId)
    .all();

  return json({ ok: true, needs: r?.results || [] });
}

export async function onRequestPost({ env, request, params }) {
	await ensureNeedsZkColumns(env.BF_DB);
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!a.ok) return a.resp;

  const body = await request.json().catch(() => ({}));

	const title = asString(body.title).trim();
	if (!title) return bad(400, "Title is required");

	const description = asString(body.description).trim();
  const status = asString(body.status).trim() || "open";

  // Always an int, never null, because DB column is NOT NULL
  const priority = parsePriority(body.priority ?? body.urgency, 0);

  const is_public = asBool(body.is_public, false) ? 1 : 0;

  const id = uuid();
  const t = now();

	let keyVersion = null;
	if (body.encrypted_blob) {
		keyVersion = await getOrgCryptoKeyVersion(db, orgId);
	}

	await env.BF_DB.prepare(
	  `INSERT INTO needs (id, org_id, title, description, status, priority, is_public, encrypted_description, encrypted_blob, key_version, created_at, updated_at)
	   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	)
	  .bind(
		id,
		orgId,
		title,
		description,
		status,
		priority,
		is_public,
		body.encrypted_description ?? null,
		body.encrypted_blob ?? null,
		keyVersion,
		t,
		t
	  )
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
	await ensureNeedsZkColumns(env.BF_DB);
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!a.ok) return a.resp;

  const body = await request.json().catch(() => ({}));
  const id = asString(body.id).trim();
  if (!id) return bad(400, "id is required");

	const existing = await env.BF_DB.prepare(
	  `SELECT id, title, description, status, priority, is_public, encrypted_description, encrypted_blob, key_version
	   FROM needs
	   WHERE org_id = ? AND id = ?`
	)
    .bind(orgId, id)
    .first();

  if (!existing) return bad(404, "Need not found");

  const nextTitle =
    body.title === undefined ? existing.title : asString(body.title).trim();
  const nextDescription =
    body.description === undefined
      ? existing.description
      : asString(body.description).trim();
  const nextStatus =
    body.status === undefined ? existing.status : asString(body.status).trim();

  const basePriority = Number.isFinite(Number(existing.priority))
    ? Math.max(0, Math.trunc(Number(existing.priority)))
    : 0;

  const nextPriority =
    body.priority === undefined && body.urgency === undefined
      ? basePriority
      : parsePriority(body.priority ?? body.urgency, basePriority);

  const nextPublic =
    body.is_public === undefined
      ? existing.is_public
      : asBool(body.is_public, false)
      ? 1
      : 0;

  const t = now();

	let keyVersion = null;
	if (body.encrypted_blob) {
		keyVersion = await getOrgCryptoKeyVersion(db, orgId);
	}

	await env.BF_DB.prepare(
	  `UPDATE needs
	   SET title = ?,
	       description = ?,
	       status = ?,
	       priority = ?,
	       is_public = ?,
	       encrypted_description = COALESCE(?, encrypted_description),
	       encrypted_blob = COALESCE(?, encrypted_blob),
	       key_version = COALESCE(?, key_version),
	       updated_at = ?
	   WHERE org_id = ? AND id = ?`
	)
	  .bind(
	    nextTitle,
	    nextDescription,
	    nextStatus,
	    nextPriority,
	    nextPublic,
	    body.encrypted_description ?? null,
	    body.encrypted_blob ?? null,
	    keyVersion,
	    t,
	    orgId,
	    id
	  )
	  .run();

  await safeLog(env, {
    orgId,
    kind: "need.updated",
    message: nextTitle || id,
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
    const body = await request.json().catch(() => ({}));
    id = asString(body.id).trim();
  }
  id = asString(id).trim();
  if (!id) return bad(400, "id is required");

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
    message: before?.title || id,
    actorUserId: a?.user?.sub || null,
    entityType: "need",
    entityId: id,
    entityTitle: before?.title || "",
  });

  return json({ ok: true });
}
