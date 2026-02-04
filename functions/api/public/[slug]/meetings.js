// functions/api/public/[slug]/meetings.js
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

  // Meetings table is expected to exist already via org routes.
  // We only read public meetings.
  const r = await db
    .prepare(
      `SELECT id, org_id, title, starts_at, ends_at, location, agenda, is_public, created_at, updated_at
       FROM meetings
       WHERE org_id=? AND is_public=1
       ORDER BY COALESCE(starts_at, 0) DESC, updated_at DESC`
    )
    .bind(orgId)
    .all();

  return Response.json({ ok: true, meetings: r.results || [] });
}
