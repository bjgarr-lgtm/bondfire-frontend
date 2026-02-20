import { json, bad, readJSON, requireMethod } from "../../_lib/http.js";
import { getDb, requireUser, requireOrgRole } from "../../_lib/auth.js";
import { ensureZkSchema, getOrgKeyVersion } from "../../_lib/zk.js";

/*
  Org key model (pragmatic ZK v1):
  - Client generates a random 32-byte org symmetric key (org_k).
  - For each member, client wraps org_k using ECDH(shared_secret(member_pub, my_priv)) + HKDF -> AES-GCM.
  - Server stores only wrapped blobs.
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
  // org_keys already created by you; keep defensive for dev.
  await tryRun(db, "CREATE TABLE IF NOT EXISTS org_keys (org_id TEXT PRIMARY KEY, encrypted_org_metadata TEXT)");
  await ensureZkSchema(db);
}

export async function onRequestGet({ env, request, params }) {
  const auth = await requireUser(env, request);
  if (!auth.ok) return auth.resp;

  const orgId = params.orgId;
  const db = getDb(env);
  await ensureZkColumns(db);

  const role = await requireOrgRole(db, auth.userId, orgId, ["owner", "admin", "member"]);
  if (!role.ok) return role.resp;

  const org = await db.prepare("SELECT encrypted_org_metadata FROM org_keys WHERE org_id = ?").bind(orgId).first();
  const keyVersion = await getOrgKeyVersion(db, orgId);
  const wk = await db
    .prepare("SELECT wrapped_key, key_version, kid FROM org_key_wrapped WHERE org_id = ? AND user_id = ?")
    .bind(orgId, auth.userId)
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
  const auth = await requireUser(env, request);
  if (!auth.ok) return auth.resp;
  requireMethod(request, "POST");

  const orgId = params.orgId;
  const db = getDb(env);
  await ensureZkColumns(db);

  const role = await requireOrgRole(db, auth.userId, orgId, ["owner", "admin"]);
  if (!role.ok) return role.resp;

  const body = await readJSON(request);
  const wrappedKeys = Array.isArray(body?.wrapped_keys) ? body.wrapped_keys : null;
  const encryptedOrgMetadata = body?.encrypted_org_metadata ?? null;
  const keyVersion = Number.isFinite(Number(body?.key_version)) ? Number(body.key_version) : null;

  if (!wrappedKeys || !wrappedKeys.length) return bad(400, "MISSING_WRAPPED_KEYS");

  await db.prepare("INSERT OR REPLACE INTO org_keys (org_id, encrypted_org_metadata) VALUES (?, ?)")
    .bind(orgId, encryptedOrgMetadata).run();

  const stmt = db.prepare("INSERT OR REPLACE INTO org_key_wrapped (org_id, user_id, wrapped_key) VALUES (?, ?, ?)");
  for (const wk of wrappedKeys) {
    if (!wk?.user_id || !wk?.wrapped_key) continue;
    // v2 schema might include key_version/kid; best effort.
    const userId = wk.user_id;
    const wrappedKey = wk.wrapped_key;
    const kid = wk.kid || null;
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
      // fallback to v0 schema
      await stmt.bind(orgId, userId, wrappedKey).run();
    }
  }

  if (keyVersion != null) {
    // Ensure org_crypto reflects the key version we just published
    await tryRun(
      db,
      "INSERT INTO org_crypto (org_id, key_version, updated_at) VALUES ('" +
        String(orgId).replace(/'/g, "''") +
        "', " +
        String(keyVersion) +
        ", " +
        String(Date.now()) +
        ") ON CONFLICT(org_id) DO UPDATE SET key_version = excluded.key_version, updated_at = excluded.updated_at"
    );
  }

  return json({ ok: true });
}
