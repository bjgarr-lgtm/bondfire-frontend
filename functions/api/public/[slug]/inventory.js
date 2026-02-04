// functions/api/public/[slug]/inventory.js
import { getDB } from "../../_bf.js";
import { getPublicCfg, getOrgIdBySlug } from "../../_lib/publicPageStore.js";

export async function onRequestGet({ env, params }) {
  const slug = params.slug;
  const db = getDB(env);
  if (!db) return Response.json({ ok: false, error: "DB_NOT_CONFIGURED" }, { status: 500 });

  // Resolve slug to org
  const orgId = await getOrgIdBySlug(env, slug);
  if (!orgId) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  // Public config gate
  const pub = await getPublicCfg(env, orgId);
  if (!pub?.enabled) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  // Inventory table is expected to exist already via org routes.
  // We only read public items.
  const r = await db
    .prepare(
      `SELECT id, org_id, name, qty, unit, category, location, notes, is_public, created_at, updated_at
       FROM inventory
       WHERE org_id=? AND is_public=1
       ORDER BY updated_at DESC, created_at DESC`
    )
    .bind(orgId)
    .all();

  return Response.json({ ok: true, items: r.results || [] });
}
