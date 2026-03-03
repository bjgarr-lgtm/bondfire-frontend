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

    const cols = await db.prepare("PRAGMA table_info(org_key_recovery)").all();
    const names = new Set((cols?.results || []).map((c) => c.name));
    const hasRecoveryPayload = names.has("recovery_payload");

    const row = await db
      .prepare(
        hasRecoveryPayload
          ? `SELECT recovery_payload AS payload_text, updated_at
               FROM org_key_recovery
              WHERE org_id = ? AND user_id = ?`
          : `SELECT wrapped_key AS payload_text, updated_at
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
      payload = JSON.parse(row.payload_text);
    } catch {
      // Keep it raw if somehow not JSON (older builds)
      payload = row.payload_text;
    }

    return ok({
      has_recovery: true,
      updated_at: row.updated_at,
      payload,
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

    const cols = await db.prepare("PRAGMA table_info(org_key_recovery)").all();
    const names = new Set((cols?.results || []).map((c) => c.name));
    const hasRecoveryPayload = names.has("recovery_payload");

    const body = await readJSON(request);
    // Accept { payload }, { recovery }, { wrapped }, or raw object.
    const payload = body?.payload ?? body?.recovery ?? body?.wrapped ?? body;
    if (!payload) return bad(400, "MISSING_RECOVERY_PAYLOAD");

    const payloadText = typeof payload === "string" ? payload : JSON.stringify(payload);
    const now = Date.now();

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
      // Legacy schema compatibility: org_key_recovery(org_id,user_id,wrapped_key,salt,kdf,updated_at)
      // We store the full JSON blob into wrapped_key so the client can round-trip its v1 payload.
      const salt = typeof payload === "object" && payload?.salt ? String(payload.salt) : "legacy";
      const kdf =
        typeof payload === "object" && payload?.kdf
          ? JSON.stringify(payload.kdf)
          : JSON.stringify({ name: "PBKDF2", hash: "SHA-256", iterations: 210000 });

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
        .bind(orgId, userId, payloadText, salt, kdf, now)
        .run();
    }

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

    await db.prepare(`DELETE FROM org_key_recovery WHERE org_id = ? AND user_id = ?`).bind(orgId, userId).run();

    return ok({ has_recovery: false });
  } catch (e) {
    return bad(500, e?.message || String(e));
  }
}
