import { json, bad, now, uuid } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";
import { logActivity } from "../../_lib/activity.js";

async function ensurePeopleZkColumns(db) {
	try { await db.prepare("ALTER TABLE people ADD COLUMN encrypted_notes TEXT").run(); } catch {}
	try { await db.prepare("ALTER TABLE people ADD COLUMN encrypted_blob TEXT").run(); } catch {}
	try { await db.prepare("ALTER TABLE people ADD COLUMN key_version INTEGER").run(); } catch {}
}

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;
	await ensurePeopleZkColumns(env.BF_DB);

  const res = await env.BF_DB.prepare(
		"SELECT id, name, role, phone, skills, notes, encrypted_notes, encrypted_blob, key_version, created_at, updated_at FROM people WHERE org_id = ? ORDER BY created_at DESC"
  ).bind(orgId).all();

  return json({ ok: true, people: res.results || [] });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!a.ok) return a.resp;
	await ensurePeopleZkColumns(env.BF_DB);

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return bad(400, "MISSING_NAME");

  const id = uuid();
  const t = now();

	let keyVersion = null;
	if (body.encrypted_blob) {
		const k = await env.BF_DB.prepare("SELECT key_version FROM org_crypto WHERE org_id = ?")
			.bind(orgId)
			.first();
		keyVersion = k?.key_version || 1;
	}

  await env.BF_DB.prepare(
		`INSERT INTO people (id, org_id, name, role, phone, skills, notes, encrypted_notes, encrypted_blob, key_version, created_at, updated_at)
	     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id,
    orgId,
    name,
    String(body.role || ""),
    String(body.phone || ""),
    String(body.skills || ""),
    String(body.notes || ""),
    body.encrypted_notes ?? null,
		body.encrypted_blob ?? null,
		keyVersion,
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
	await ensurePeopleZkColumns(env.BF_DB);

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return bad(400, "MISSING_ID");

	let keyVersion = null;
	if (body.encrypted_blob) {
		const k = await env.BF_DB.prepare("SELECT key_version FROM org_crypto WHERE org_id = ?")
			.bind(orgId)
			.first();
		keyVersion = k?.key_version || 1;
	}

  await env.BF_DB.prepare(
    `UPDATE people
     SET name = COALESCE(?, name),
         role = COALESCE(?, role),
         phone = COALESCE(?, phone),
         skills = COALESCE(?, skills),
         notes = COALESCE(?, notes),
         encrypted_notes = COALESCE(?, encrypted_notes),
	         encrypted_blob = COALESCE(?, encrypted_blob),
	         key_version = COALESCE(?, key_version),
         updated_at = ?
     WHERE id = ? AND org_id = ?`
  ).bind(
    body.name ?? null,
    body.role ?? null,
    body.phone ?? null,
    body.skills ?? null,
    body.notes ?? null,
    body.encrypted_notes ?? null,
		body.encrypted_blob ?? null,
		keyVersion,
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

const prev = await env.BF_DB.prepare(
  "SELECT name FROM people WHERE id = ? AND org_id = ?"
).bind(id, orgId).first();

const shortId = (x) =>
  typeof x === "string" && x.length > 12 ? `${x.slice(0, 8)}…${x.slice(-4)}` : (x || "");

const name = String(prev?.name || "").trim();
const label = name || shortId(id);

await env.BF_DB.prepare("DELETE FROM people WHERE id = ? AND org_id = ?")
  .bind(id, orgId)
  .run();

logActivity(env, {
  orgId,
  kind: "person.deleted",
  message: `Person removed: ${label} (${shortId(id)})`,
  actorUserId: a?.user?.sub || a?.user?.id || null,
}).catch(() => {});


  return json({ ok: true });
}
