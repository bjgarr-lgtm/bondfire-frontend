import { getPublicCfg, resolveSlug } from "../../../_lib/publicPageStore.js";

async function ensureMeetingsPublicColumn(db) {
  try {
    await db
      .prepare("ALTER TABLE meetings ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0")
      .run();
  } catch {
    // ignore (already exists)
  }
}

// GET /api/public/:slug/meetings
// Returns meetings that have been marked public (is_public = 1).

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

  const db = env.BF_DB;

  try {
    await ensureMeetingsPublicColumn(db);

    const res = await db
      .prepare(
        `SELECT id, title, starts_at, ends_at, location, agenda, notes, created_at, updated_at
         FROM meetings
         WHERE org_id = ? AND is_public = 1
         ORDER BY starts_at DESC, created_at DESC`
      )
      .bind(orgId)
      .all();

    return Response.json({ ok: true, meetings: res.results || [] });
  } catch (e) {
    return Response.json(
      { ok: false, error: "SERVER_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
