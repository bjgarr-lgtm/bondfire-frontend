import { getDB, json, bad, readJson, getUserIdFromRequest, requireMemberRole } from "../../_bf.js";

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = getDB(env);
  if (!db) return bad("DB_NOT_CONFIGURED", 500);

  const orgId = String(params.orgId || "");

  if (request.method === "GET") {
    const userId = getUserIdFromRequest(request);
    const roleCheck = await requireMemberRole(db, orgId, userId, "member");
    if (!roleCheck.ok) return bad(roleCheck.error, roleCheck.status);

    const row = await db
      .prepare(
        `SELECT org_id, enabled, list_address, blurb, updated_at
         FROM newsletter_settings
         WHERE org_id = ?
         LIMIT 1`
      )
      .bind(orgId)
      .first();

    const newsletter = row
      ? {
          enabled: !!row.enabled,
          list_address: row.list_address || "",
          blurb: row.blurb || "",
          updated_at: row.updated_at || null,
        }
      : { enabled: false, list_address: "", blurb: "", updated_at: null };

    return json({ ok: true, newsletter });
  }

  if (request.method === "PUT") {
    const userId = getUserIdFromRequest(request);
    const roleCheck = await requireMemberRole(db, orgId, userId, "admin");
    if (!roleCheck.ok) return bad(roleCheck.error, roleCheck.status);

    const body = await readJson(request);
    if (!body) return bad("BAD_JSON", 400);

    const enabled = body.enabled ? 1 : 0;
    const listAddress = String(body.list_address || "").trim();
    const blurb = String(body.blurb || "").trim();
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO newsletter_settings (org_id, enabled, list_address, blurb, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(org_id) DO UPDATE SET
           enabled = excluded.enabled,
           list_address = excluded.list_address,
           blurb = excluded.blurb,
           updated_at = excluded.updated_at`
      )
      .bind(orgId, enabled, listAddress, blurb, now)
      .run();

    return json({
      ok: true,
      newsletter: { enabled: !!enabled, list_address: listAddress, blurb, updated_at: now },
    });
  }

  return bad("METHOD_NOT_ALLOWED", 405);
}
