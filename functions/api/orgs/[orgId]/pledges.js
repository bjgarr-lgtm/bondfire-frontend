import { ok, err } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";

// D1 table expected (legacy but used by UI):
// - pledges(
//     id TEXT PRIMARY KEY,
//     org_id TEXT,
//     need_id TEXT NULL,
//     title TEXT,
//     description TEXT,
//     qty REAL NULL,
//     unit TEXT NULL,
//     contact TEXT NULL,
//     is_public INTEGER DEFAULT 0,
//     created_at INTEGER,
//     updated_at INTEGER
//   )

function now() {
  return Date.now();
}

function uuid() {
  return crypto.randomUUID();
}

async function listPledges(db, orgId) {
  const r = await db
    .prepare(
      "SELECT id, org_id, need_id, title, description, qty, unit, contact, is_public, created_at, updated_at FROM pledges WHERE org_id=? ORDER BY created_at DESC"
    )
    .bind(orgId)
    .all();
  return r.results || [];
}

export async function onRequest(ctx) {
  const { params, env, request } = ctx;
  const orgId = params.orgId;
  if (!env.BF_DB) return err(500, "DB_NOT_CONFIGURED");

  // Any org member can view/add; tighten later if you want.
  const gate = await requireOrgRole(ctx, orgId, "member");
  if (!gate.ok) return gate.res;

  try {
    if (request.method === "GET") {
      const pledges = await listPledges(env.BF_DB, orgId);
      return ok({ pledges });
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const id = uuid();
      const t = now();
      const pledge = {
        id,
        org_id: orgId,
        need_id: body.need_id || null,
        title: String(body.title || "").slice(0, 140),
        description: String(body.description || "").slice(0, 4000),
        qty: body.qty == null || body.qty === "" ? null : Number(body.qty),
        unit: body.unit ? String(body.unit).slice(0, 64) : null,
        contact: body.contact ? String(body.contact).slice(0, 256) : null,
        is_public: body.is_public ? 1 : 0,
        created_at: t,
        updated_at: t,
      };

      await env.BF_DB.prepare(
        "INSERT INTO pledges(id, org_id, need_id, title, description, qty, unit, contact, is_public, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
      )
        .bind(
          pledge.id,
          pledge.org_id,
          pledge.need_id,
          pledge.title,
          pledge.description,
          pledge.qty,
          pledge.unit,
          pledge.contact,
          pledge.is_public,
          pledge.created_at,
          pledge.updated_at
        )
        .run();

      const pledges = await listPledges(env.BF_DB, orgId);
      return ok({ pledge, pledges });
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const id = body.id;
      if (!id) return err(400, "MISSING_ID");

      const t = now();
      const fields = {
        need_id: body.need_id || null,
        title: String(body.title || "").slice(0, 140),
        description: String(body.description || "").slice(0, 4000),
        qty: body.qty == null || body.qty === "" ? null : Number(body.qty),
        unit: body.unit ? String(body.unit).slice(0, 64) : null,
        contact: body.contact ? String(body.contact).slice(0, 256) : null,
        is_public: body.is_public ? 1 : 0,
      };

      await env.BF_DB.prepare(
        "UPDATE pledges SET need_id=?, title=?, description=?, qty=?, unit=?, contact=?, is_public=?, updated_at=? WHERE id=? AND org_id=?"
      )
        .bind(
          fields.need_id,
          fields.title,
          fields.description,
          fields.qty,
          fields.unit,
          fields.contact,
          fields.is_public,
          t,
          id,
          orgId
        )
        .run();

      const pledges = await listPledges(env.BF_DB, orgId);
      return ok({ pledges });
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url);
      const id = url.searchParams.get("id");
      if (!id) return err(400, "MISSING_ID");

      await env.BF_DB.prepare("DELETE FROM pledges WHERE id=? AND org_id=?")
        .bind(id, orgId)
        .run();

      const pledges = await listPledges(env.BF_DB, orgId);
      return ok({ pledges });
    }

    return err(405, "METHOD_NOT_ALLOWED");
  } catch (e) {
    return err(500, "SERVER_ERROR", { message: String(e?.message || e) });
  }
}
