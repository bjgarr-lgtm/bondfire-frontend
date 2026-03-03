import { ok, bad, readJSON } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { ensureZkSchema } from "../../../_lib/zkSchema.js";

// Option A: store a passphrase-encrypted recovery blob on the server
// keyed by (org_id, user_id). The blob is generated client-side.

export async function onRequestGet(ctx) {
  try {
    const { params, env } = ctx;
    const orgId = params.orgId;

    const gate = await requireOrgRole(ctx, orgId, "member");
    const userId = gate.user.sub;

    const { db } = await ensureZkSchema(env);

    // Compatibility: older environments created org_key_recovery with
    // (wrapped_key, salt, kdf, updated_at) instead of (recovery_payload, updated_at).
    const info = await db.prepare("PRAGMA table_info(org_key_recovery)").all();
    const cols = new Set((info?.results || []).map((c) => c.name));
    const hasRecoveryPayload = cols.has("recovery_payload");

    const row = await db
      .prepare(
        hasRecoveryPayload
          ? `SELECT recovery_payload, updated_at
               FROM org_key_recovery
              WHERE org_id = ? AND user_id = ?`
          : `SELECT wrapped_key AS recovery_payload, updated_at
               FROM org_key_recovery
              WHERE org_id = ? AND user_id = ?`
      )
      .bind(orgId, userId)
      .first();

    if (!row) {
      return ok({ has_recovery: false, updated_at: null });
    }

    const raw = row?.recovery_payload;
    let payload = raw;
    if (typeof raw === "string") {
      const t = raw.trim();
      if (t.startsWith("{") || t.startsWith("[")) {
        try {
          payload = JSON.parse(t);
        } catch {
          payload = raw;
        }
      }
    }

    // Frontend expects { payload: { v, kdf, salt, iv, ct } }
    return ok({ has_recovery: true, updated_at: row.updated_at, payload });
  } catch (e) {
    return bad(500, e?.message || String(e));
  }
}

export async function onRequestPost(ctx) {
  try {
    const { params, env, request } = ctx;
    const orgId = params.orgId;

    const gate = await requireOrgRole(ctx, orgId, "member");
    const userId = gate.user.sub;

    const { db } = await ensureZkSchema(env);

    const body = await readJSON(request);
    // Accept { payload }, { recovery }, { wrapped }, or raw object.
    const recovery = body?.payload ?? body?.recovery ?? body?.wrapped ?? body;
    if (!recovery) return bad(400, "MISSING_RECOVERY_PAYLOAD");

    const payloadText = typeof recovery === "string" ? recovery : JSON.stringify(recovery);
    const now = Date.now();

    const info = await db.prepare("PRAGMA table_info(org_key_recovery)").all();
    const cols = new Set((info?.results || []).map((c) => c.name));
    const hasRecoveryPayload = cols.has("recovery_payload");

    if (hasRecoveryPayload) {
      await db
        .prepare(
          `INSERT INTO org_key_recovery (org_id, user_id, recovery_payload, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(org_id, user_id) DO UPDATE SET
             recovery_payload = excluded.recovery_payload,
             updated_at = excluded.updated_at`
        )
        .bind(orgId, userId, payloadText, now)
        .run();
    } else {
      // Legacy schema from /api/orgs/:orgId/recovery expects NOT NULL wrapped_key/salt/kdf.
      await db
        .prepare(
          `INSERT INTO org_key_recovery (org_id, user_id, wrapped_key, salt, kdf, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(org_id, user_id) DO UPDATE SET
             wrapped_key = excluded.wrapped_key,
             salt = excluded.salt,
             kdf = excluded.kdf,
             updated_at = excluded.updated_at`
        )
        .bind(orgId, userId, payloadText, "-", "-", now)
        .run();
    }

    return ok({ has_recovery: true, updated_at: now });
  } catch (e) {
    return bad(500, e?.message || String(e));
  }
}

export async function onRequestDelete(ctx) {
  try {
    const { params, env } = ctx;
    const orgId = params.orgId;

    const gate = await requireOrgRole(ctx, orgId, "member");
    const userId = gate.user.sub;

    const { db } = await ensureZkSchema(env);

    await db.prepare(`DELETE FROM org_key_recovery WHERE org_id = ? AND user_id = ?`).bind(orgId, userId).run();

    return ok({ has_recovery: false });
  } catch (e) {
    return bad(500, e?.message || String(e));
  }
}
