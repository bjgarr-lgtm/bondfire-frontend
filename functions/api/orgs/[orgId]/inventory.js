import { json, bad, now, uuid } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";
import { logActivity } from "../../_lib/activity.js";

async function getOrgCryptoKeyVersion(db, orgId) {
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

async function ensureInventoryParsTable(db) {
	await db.prepare(
		`CREATE TABLE IF NOT EXISTS inventory_pars (
			org_id TEXT NOT NULL,
			inventory_id TEXT NOT NULL,
			par REAL,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			PRIMARY KEY (org_id, inventory_id)
		)`
	).run();
}

async function upsertInventoryPar(db, orgId, inventoryId, par) {
	await ensureInventoryParsTable(db);
	const t = now();
	const raw = par === "" || par == null ? null : Number(par);
	const val = Number.isFinite(raw) && raw > 0 ? raw : null;

	if (val == null) {
		await db.prepare("DELETE FROM inventory_pars WHERE org_id = ? AND inventory_id = ?").bind(orgId, inventoryId).run();
		return null;
	}

	await db.prepare(
		`INSERT INTO inventory_pars (org_id, inventory_id, par, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(org_id, inventory_id)
		 DO UPDATE SET par = excluded.par, updated_at = excluded.updated_at`
	).bind(orgId, inventoryId, val, t, t).run();

	return val;
}

async function getInventoryRow(db, orgId, id) {
	return await db.prepare(
		`SELECT i.id, i.name, i.qty, i.unit, i.category, i.location, i.notes,
		        i.encrypted_notes, i.encrypted_blob, i.key_version,
		        i.is_public, i.created_at, i.updated_at,
		        COALESCE(p.par, NULL) AS par
		 FROM inventory i
		 LEFT JOIN inventory_pars p
		   ON p.org_id = i.org_id
		  AND p.inventory_id = i.id
		 WHERE i.org_id = ? AND i.id = ?`
	).bind(orgId, id).first();
}

export async function onRequestGet({ env, request, params }) {
	const orgId = params.orgId;
	const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
	if (!a.ok) return a.resp;

	await ensureInventoryParsTable(env.BF_DB);

	const res = await env.BF_DB.prepare(
		`SELECT i.id, i.name, i.qty, i.unit, i.category, i.location, i.notes,
		        i.encrypted_notes, i.encrypted_blob, i.key_version,
		        i.is_public, i.created_at, i.updated_at,
		        COALESCE(p.par, NULL) AS par
		 FROM inventory i
		 LEFT JOIN inventory_pars p
		   ON p.org_id = i.org_id
		  AND p.inventory_id = i.id
		 WHERE i.org_id = ?
		 ORDER BY i.created_at DESC`
	).bind(orgId).all();

	return json({ ok: true, inventory: res.results || [] });
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
	const qty = Number.isFinite(Number(body.qty)) ? Number(body.qty) : 0;
	const keyVersion = body.encrypted_blob ? await getOrgCryptoKeyVersion(env.BF_DB, orgId) : null;

	await env.BF_DB.prepare(
		`INSERT INTO inventory (
			id, org_id, name, qty, unit, category, location, notes,
			encrypted_notes, encrypted_blob, key_version,
			is_public, created_at, updated_at
		) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
	)
		.bind(
			id,
			orgId,
			name,
			qty,
			String(body.unit || ""),
			String(body.category || ""),
			String(body.location || ""),
			String(body.notes || ""),
			body.encrypted_notes ?? null,
			body.encrypted_blob ?? null,
			keyVersion,
			body.is_public ? 1 : 0,
			t,
			t
		)
		.run();

	const par = await upsertInventoryPar(env.BF_DB, orgId, id, body.par);

	try {
		await logActivity(env, {
			orgId,
			kind: "inventory.created",
			message: `inventory added: ${name}`,
			actorUserId: a?.user?.sub || null,
		});
	} catch (e) {
		console.error("ACTIVITY_FAIL", e);
	}

	const item = await getInventoryRow(env.BF_DB, orgId, id);
	return json({ ok: true, id, item: item ? { ...item, par } : null });
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

	const qty =
		body.qty === undefined || body.qty === null
			? null
			: Number.isFinite(Number(body.qty))
			? Number(body.qty)
			: 0;

	const keyVersion = body.encrypted_blob ? await getOrgCryptoKeyVersion(env.BF_DB, orgId) : null;

	await env.BF_DB.prepare(
		`UPDATE inventory
		 SET name = COALESCE(?, name),
			 qty = COALESCE(?, qty),
			 unit = COALESCE(?, unit),
			 category = COALESCE(?, category),
			 location = COALESCE(?, location),
			 notes = COALESCE(?, notes),
			 encrypted_notes = COALESCE(?, encrypted_notes),
			 encrypted_blob = COALESCE(?, encrypted_blob),
			 key_version = COALESCE(?, key_version),
			 is_public = COALESCE(?, is_public),
			 updated_at = ?
		 WHERE id = ? AND org_id = ?`
	)
		.bind(
			body.name ?? null,
			qty,
			body.unit ?? null,
			body.category ?? null,
			body.location ?? null,
			body.notes ?? null,
			body.encrypted_notes ?? null,
			body.encrypted_blob ?? null,
			keyVersion,
			isPublic,
			now(),
			id,
			orgId
		)
		.run();

	const par = await upsertInventoryPar(env.BF_DB, orgId, id, body.par);

	try {
		await logActivity(env, {
			orgId,
			kind: "inventory.updated",
			message: `inventory updated: ${id}`,
			actorUserId: a?.user?.sub || null,
		});
	} catch (e) {
		console.error("ACTIVITY_FAIL", e);
	}

	const item = await getInventoryRow(env.BF_DB, orgId, id);
	return json({ ok: true, item: item ? { ...item, par } : null });
}

export async function onRequestDelete({ env, request, params }) {
	const orgId = params.orgId;
	const a = await requireOrgRole({ env, request, orgId, minRole: "admin" });
	if (!a.ok) return a.resp;

	const url = new URL(request.url);
	const id = url.searchParams.get("id");
	if (!id) return bad(400, "MISSING_ID");

	const prev = await env.BF_DB.prepare(
		"SELECT name FROM inventory WHERE id = ? AND org_id = ?"
	).bind(id, orgId).first();

	const shortId = (x) =>
		typeof x === "string" && x.length > 12 ? `${x.slice(0, 8)}…${x.slice(-4)}` : (x || "");

	const name = String(prev?.name || "").trim();
	const label = name || shortId(id);

	await ensureInventoryParsTable(env.BF_DB);
	await env.BF_DB.prepare("DELETE FROM inventory_pars WHERE org_id = ? AND inventory_id = ?")
		.bind(orgId, id)
		.run();
	await env.BF_DB.prepare("DELETE FROM inventory WHERE id = ? AND org_id = ?")
		.bind(id, orgId)
		.run();

	logActivity(env, {
		orgId,
		kind: "inventory.deleted",
		message: `Inventory removed: ${label} (${shortId(id)})`,
		actorUserId: a?.user?.sub || a?.user?.id || null,
	}).catch(() => {});

	return json({ ok: true });
}
