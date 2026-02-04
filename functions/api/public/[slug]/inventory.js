import { getPublicCfg, resolveSlug } from "../../_lib/publicPageStore.js";

// GET /api/public/:slug/inventory
// Returns inventory items that have been marked public (is_public = 1).

export async function onRequestGet({ env, params }) {
  const slug = String(params.slug || "").trim();
  if (!slug) {
    return Response.json({ ok: false, error: "MISSING_SLUG" }, { status: 400 });
  }

  const orgId = await resolveSlug(env, slug);
  if (!orgId) {
    return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const cfg = await getPublicCfg(env, orgId);
  if (!cfg?.enabled) {
    return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const res = await env.BF_DB.prepare(
      `SELECT id, name, qty, unit, category, location, notes, created_at
       FROM inventory
       WHERE org_id = ? AND is_public = 1
       ORDER BY created_at DESC`
    )
      .bind(orgId)
      .all();

    return Response.json({ ok: true, inventory: res.results || [] });
  } catch (e) {
    return Response.json(
      { ok: false, error: "SERVER_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
