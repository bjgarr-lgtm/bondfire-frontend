import { ok, bad, readJSON } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { ensureZkSchema } from "../../../_lib/zkSchema.js";

// Option A: store a passphrase-encrypted recovery blob on the server
// keyed by (org_id, user_id). The blob is generated client-side.

export async function onRequestGet(ctx) {
  try {
    const { params, env, request } = ctx;
    const orgId = params.orgId;

    const gate = await requireOrgRole({ env, request, orgId, minRole: "member" });
    if (!gate.ok) return gate.resp;
    const userId = gate.user.sub;

    const { db } = await ensureZkSchema(env);

    const row = await db.prepare(
      `SELECT recovery_payload, updated_at
         FROM org_key_recovery
        WHERE org_id = ? AND user_id = ?`
    )
      .bind(orgId, userId)
      .first();

    if (!row) {
      return ok({ has_recovery: false, updated_at: null });
    }

    let payload = null;
    try {
      payload = JSON.parse(row.recovery_payload);
    } catch {
      // Keep it raw if somehow not JSON (older builds)
      payload = row.recovery_payload;
    }

    return ok({
      has_recovery: true,
      updated_at: row.updated_at,
      recovery: payload,
    });
  } catch (e) {
    return bad(500, e?.message || String(e));
  }
}

export async function onRequestPost(ctx) {
  try {
    const { params, env, request } = ctx;
    const orgId = params.orgId;

    const gate = await requireOrgRole({ env, request, orgId, minRole: "member" });
    if (!gate.ok) return gate.resp;
    const userId = gate.user.sub;

    const { db } = await ensureZkSchema(env);

    const body = await readJSON(request);
    // Accept either { recovery: <obj> } or { wrapped: <obj> } for backwards compatibility.
    const recovery = body?.recovery ?? body?.wrapped ?? body;
    if (!recovery) return bad(400, "MISSING_RECOVERY_PAYLOAD");

    const payloadText = typeof recovery === "string" ? recovery : JSON.stringify(recovery);
    const now = Date.now();

    await db.prepare(
      `INSERT INTO org_key_recovery (org_id, user_id, recovery_payload, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(org_id, user_id) DO UPDATE SET
         recovery_payload = excluded.recovery_payload,
         updated_at = excluded.updated_at`
    )
      .bind(orgId, userId, payloadText, now)
      .run();

    return ok({ has_recovery: true, updated_at: now });
  } catch (e) {
    return bad(500, e?.message || String(e));
  }
}

export async function onRequestDelete(ctx) {
  try {
    const { params, env, request } = ctx;
    const orgId = params.orgId;

    const gate = await requireOrgRole({ env, request, orgId, minRole: "member" });
    if (!gate.ok) return gate.resp;
    const userId = gate.user.sub;

    const { db } = await ensureZkSchema(env);

    await db.prepare(
      `DELETE FROM org_key_recovery WHERE org_id = ? AND user_id = ?`
    )
      .bind(orgId, userId)
      .run();

    return ok({ has_recovery: false });
  } catch (e) {
    return bad(500, e?.message || String(e));
  }
}
