import { ok, bad, readJSON } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { ensureZkSchema } from "../../../_lib/zkSchema.js";

// Key recovery (Option A)
// Stores a client-generated, passphrase-encrypted recovery payload.
// Server never sees org key material or the passphrase.

async function getRecoveryTableCaps(db) {
  const info = await db.prepare("PRAGMA table_info(org_key_recovery)").all();
  const names = new Set((info?.results || []).map((c) => c.name));
  return {
    hasRecoveryPayload: names.has("recovery_payload"),
    hasWrappedKey: names.has("wrapped_key"),
    hasSalt: names.has("salt"),
    hasKdf: names.has("kdf"),
    hasUpdatedAt: names.has("updated_at"),
  };
}

function coercePayload(body) {
  // Accept multiple shapes from earlier iterations.
  // Preferred: { payload: {...} }
  // Also allow: { recovery: {...} }, { wrapped: {...} }, or raw object.
  const payload = body?.payload ?? body?.recovery ?? body?.wrapped ?? body;
  if (!payload) return null;
  return payload;
}

function parseMaybeJSON(v) {
  if (v == null) return null;
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

export async function onRequestGet(ctx) {
  try {
    const { env, request, params } = ctx;
    const orgId = String(params.orgId);

    const gate = await requireOrgRole({ env, request, orgId, minRole: "member" });
    if (!gate.ok) return gate.resp;
    const userId = String(gate.user.sub);

    // Ensure schema exists in fresh DBs, but stay compatible with older live schemas.
    const { db } = await ensureZkSchema(env);
    const caps = await getRecoveryTableCaps(db);

    let row;
    if (caps.hasRecoveryPayload) {
      row = await db
        .prepare(
          `SELECT recovery_payload, updated_at
             FROM org_key_recovery
            WHERE org_id = ? AND user_id = ?`
        )
        .bind(orgId, userId)
        .first();

      if (!row) return ok({ has_recovery: false, updated_at: null, payload: null });

      return ok({
        has_recovery: true,
        updated_at: row.updated_at ?? null,
        payload: parseMaybeJSON(row.recovery_payload),
      });
    }

    // Legacy schema: wrapped_key/salt/kdf/updated_at
    row = await db
      .prepare(
        `SELECT wrapped_key, salt, kdf, updated_at
           FROM org_key_recovery
          WHERE org_id = ? AND user_id = ?`
      )
      .bind(orgId, userId)
      .first();

    if (!row) return ok({ has_recovery: false, updated_at: null, payload: null });

    // If wrapped_key contains JSON (newer client), return that.
    const maybe = parseMaybeJSON(row.wrapped_key);
    const payload =
      typeof maybe === "object" && maybe !== null
        ? maybe
        : {
            wrapped_key: row.wrapped_key ?? "",
            salt: row.salt ?? "",
            kdf: row.kdf ?? "",
          };

    return ok({
      has_recovery: true,
      updated_at: row.updated_at ?? null,
      payload,
    });
  } catch (e) {
    return bad(500, e?.message || String(e));
  }
}

export async function onRequestPost(ctx) {
  try {
    const { env, request, params } = ctx;
    const orgId = String(params.orgId);

    const gate = await requireOrgRole({ env, request, orgId, minRole: "member" });
    if (!gate.ok) return gate.resp;
    const userId = String(gate.user.sub);

    const { db } = await ensureZkSchema(env);
    const caps = await getRecoveryTableCaps(db);

    const body = await readJSON(request);
    const payload = coercePayload(body);
    if (!payload) return bad(400, "MISSING_RECOVERY_PAYLOAD");

    const payloadText = typeof payload === "string" ? payload : JSON.stringify(payload);
    const now = Date.now();

    if (caps.hasRecoveryPayload) {
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

      return ok({ has_recovery: true, updated_at: now, payload });
    }

    // Legacy schema write.
    // IMPORTANT: never bind `undefined` into D1.
    const salt =
      (typeof payload === "object" && payload && typeof payload.salt === "string" && payload.salt) ||
      (typeof body?.salt === "string" && body.salt) ||
      "";

    const kdf =
      (typeof payload === "object" && payload && typeof payload.kdf === "string" && payload.kdf) ||
      (typeof body?.kdf === "string" && body.kdf) ||
      "";

    const hasUpdatedAt = caps.hasUpdatedAt;

    // Some legacy tables may not have all columns; choose the safest statement.
    const columns = ["org_id", "user_id"].concat(
      caps.hasWrappedKey ? ["wrapped_key"] : [],
      caps.hasSalt ? ["salt"] : [],
      caps.hasKdf ? ["kdf"] : [],
      hasUpdatedAt ? ["updated_at"] : []
    );

    const values = [orgId, userId].concat(
      caps.hasWrappedKey ? [payloadText] : [],
      caps.hasSalt ? [salt] : [],
      caps.hasKdf ? [kdf] : [],
      hasUpdatedAt ? [now] : []
    );

    const setParts = [];
    if (caps.hasWrappedKey) setParts.push("wrapped_key = excluded.wrapped_key");
    if (caps.hasSalt) setParts.push("salt = excluded.salt");
    if (caps.hasKdf) setParts.push("kdf = excluded.kdf");
    if (hasUpdatedAt) setParts.push("updated_at = excluded.updated_at");

    await db
      .prepare(
        `INSERT INTO org_key_recovery (${columns.join(", ")})
         VALUES (${columns.map(() => "?").join(", ")})
         ON CONFLICT(org_id, user_id) DO UPDATE SET ${setParts.join(", ")}`
      )
      .bind(...values)
      .run();

    return ok({ has_recovery: true, updated_at: now, payload });
  } catch (e) {
    return bad(500, e?.message || String(e));
  }
}

export async function onRequestDelete(ctx) {
  try {
    const { env, request, params } = ctx;
    const orgId = String(params.orgId);

    const gate = await requireOrgRole({ env, request, orgId, minRole: "member" });
    if (!gate.ok) return gate.resp;
    const userId = String(gate.user.sub);

    const { db } = await ensureZkSchema(env);
    await db
      .prepare(`DELETE FROM org_key_recovery WHERE org_id = ? AND user_id = ?`)
      .bind(orgId, userId)
      .run();

    return ok({ has_recovery: false, updated_at: null, payload: null });
  } catch (e) {
    return bad(500, e?.message || String(e));
  }
}
