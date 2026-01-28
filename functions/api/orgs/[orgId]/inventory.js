import { json, bad, now, uuid } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";
import { logActivity } from "../../_lib/activity.js";

// Inventory items for an org.
// Columns expected:
// id, org_id, name, qty, unit, category, location, notes, is_public, created_at, updated_at

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;

  const res = await env.BF_DB.prepare(
    `SELECT id, name, qty, unit, category, location, notes, is_public, created_at, updated_at
     FROM inventory
     WHERE org_id = ?
     ORDER BY created_at DESC`
  )
    .bind(orgId)
    .all();

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

  await env.BF_DB.prepare(
    `INSERT INTO inventory (
        id, org_id, name, qty, unit, category, location, notes, is_public, created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
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
      body.is_public ? 1 : 0,
      t,
      t
    )
    .run();

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

  return json({ ok: true, id });
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

  await env.BF_DB.prepare(
    `UPDATE inventory
     SET name = COALESCE(?, name),
         qty = COALESCE(?, qty),
         unit = COALESCE(?, unit),
         category = COALESCE(?, category),
         location = COALESCE(?, location),
         notes = COALESCE(?, notes),
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
      isPublic,
      now(),
      id,
      orgId
    )
    .run();

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
  "SELECT name FROM inventory WHERE id = ? AND org_id = ?"
).bind(id, orgId).first();

const shortId = (x) =>
  typeof x === "string" && x.length > 12 ? `${x.slice(0, 8)}…${x.slice(-4)}` : (x || "");

const name = String(prev?.name || "").trim();
const label = name || shortId(id);

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
