import { json, bad, readJSON, requireMethod } from "../../_lib/http.js";
import { getDb, requireUser, requireOrgRole } from "../../_lib/auth.js";
import { ensureZkSchema, getOrgKeyVersion } from "../../_lib/zk.js";

/*
  Org key model (pragmatic ZK v1/v2):
  - Client generates a random 32-byte org symmetric key (org_k).
  - Client wraps org_k per-member and sends wrapped blobs.
  - Server stores only wrapped blobs + optional encrypted org metadata.

  NOTE: This endpoint is auth/role-gated. It must accept the current auth helper
  signatures (requireUser({ env, request }), requireOrgRole({ env, request, orgId, minRole })).
*/

async function tryRun(db, sql) {
  try {
    await db.prepare(sql).run();
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg.includes("duplicate") || msg.includes("already exists") || msg.includes("SQLITE_ERROR")) return;
    throw e;
  }
}

async function ensureZkColumns(db) {
  // Keep defensive for dev environments.
  await tryRun(db, "CREATE TABLE IF NOT EXISTS org_keys (org_id TEXT PRIMARY KEY, encrypted_org_metadata TEXT)");
  await ensureZkSchema(db);
}

export async function onRequestGet({ env, request, params }) {
  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;

  const orgId = String(params?.orgId || "");
  if (!orgId) return bad(400, "MISSING_ORG_ID");

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");
  await ensureZkColumns(db);

  // Any org member can fetch their wrapped key + org key version.
  const role = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!role.ok) return role.resp;

  const org = await db
    .prepare("SELECT encrypted_org_metadata FROM org_keys WHERE org_id = ?")
    .bind(orgId)
    .first();

  const keyVersion = await getOrgKeyVersion(db, orgId);

  const userId = String(u.user?.sub || "");
  const wk = await db
    .prepare("SELECT wrapped_key, key_version, kid FROM org_key_wrapped WHERE org_id = ? AND user_id = ?")
    .bind(orgId, userId)
    .first();

  return json({
    ok: true,
    has_org_key: !!org,
    key_version: keyVersion,
    encrypted_org_metadata: org?.encrypted_org_metadata || null,
    wrapped_key: wk?.wrapped_key || null,
    wrapped_key_version: wk?.key_version ?? null,
    wrapped_kid: wk?.kid ?? null,
  });
}

export async function onRequestPost({ env, request, params }) {
  const m = requireMethod(request, "POST");
  if (m) return m;

  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;

  const orgId = String(params?.orgId || "");
  if (!orgId) return bad(400, "MISSING_ORG_ID");

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");
  await ensureZkColumns(db);

  // Only admin/owner can publish wrapped keys for the org.
  const role = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!role.ok) return role.resp;

  const body = await readJSON(request);
  const wrappedKeys = Array.isArray(body?.wrapped_keys) ? body.wrapped_keys : null;
  const encryptedOrgMetadata = body?.encrypted_org_metadata ?? null;
  const keyVersion = Number.isFinite(Number(body?.key_version)) ? Number(body.key_version) : null;

  if (!wrappedKeys || wrappedKeys.length === 0) return bad(400, "MISSING_WRAPPED_KEYS");

  await db
    .prepare("INSERT OR REPLACE INTO org_keys (org_id, encrypted_org_metadata) VALUES (?, ?)")
    .bind(orgId, encryptedOrgMetadata)
    .run();

  const fallbackStmt = db.prepare(
    "INSERT OR REPLACE INTO org_key_wrapped (org_id, user_id, wrapped_key) VALUES (?, ?, ?)"
  );

  for (const wk of wrappedKeys) {
    if (!wk?.user_id || !wk?.wrapped_key) continue;

    const userId = String(wk.user_id);
    const wrappedKey = String(wk.wrapped_key);
    const kid = wk.kid ? String(wk.kid) : null;
    const kv = Number.isFinite(Number(wk.key_version)) ? Number(wk.key_version) : keyVersion;

    try {
      await db
        .prepare(
          "INSERT INTO org_key_wrapped (org_id, user_id, wrapped_key, key_version, kid) VALUES (?, ?, ?, ?, ?) " +
            "ON CONFLICT(org_id, user_id) DO UPDATE SET wrapped_key = excluded.wrapped_key, key_version = excluded.key_version, kid = excluded.kid"
        )
        .bind(orgId, userId, wrappedKey, kv, kid)
        .run();
    } catch {
      // Older schema fallback (no key_version/kid columns).
      await fallbackStmt.bind(orgId, userId, wrappedKey).run();
    }
  }

  if (keyVersion != null) {
    const info = await db.prepare("PRAGMA table_info(org_crypto)").all();
    const cols = new Set((info?.results || []).map((r) => r.name));
    const hasCreatedAt = cols.has("created_at");

    const now = Date.now();

    if (hasCreatedAt) {
      // Legacy org_crypto has NOT NULL created_at with no default. Keep it satisfied forever.
      await db
        .prepare(
          "INSERT INTO org_crypto (org_id, key_version, updated_at, created_at) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT(org_id) DO UPDATE SET " +
            "key_version = excluded.key_version, " +
            "updated_at = excluded.updated_at, " +
            "created_at = COALESCE(org_crypto.created_at, excluded.created_at)"
        )
        .bind(orgId, keyVersion, now, now)
        .run();
    } else {
      await db
        .prepare(
          "INSERT INTO org_crypto (org_id, key_version, updated_at) VALUES (?, ?, ?) " +
            "ON CONFLICT(org_id) DO UPDATE SET key_version = excluded.key_version, updated_at = excluded.updated_at"
        )
        .bind(orgId, keyVersion, now)
        .run();
    }
  }

return json({ ok: true });
}
