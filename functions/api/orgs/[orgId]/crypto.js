import { json, bad, readJSON, requireMethod } from "../../_lib/http.js";
import { getDb, requireUser, requireOrgRole } from "../../_lib/auth.js";

/*
  Org key model (pragmatic ZK v1):
  - Client generates a random 32-byte org symmetric key (org_k).
  - For each member, client wraps org_k using ECDH(shared_secret(member_pub, my_priv)) + HKDF -> AES-GCM.
  - Server stores only wrapped blobs.
*/

async function ensureZkColumns(db) {
  // org_keys already created by you; keep defensive for dev.
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS org_keys (org_id TEXT PRIMARY KEY, encrypted_org_metadata TEXT)"
  ).run();
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS org_key_wrapped (org_id TEXT NOT NULL, user_id TEXT NOT NULL, wrapped_key TEXT NOT NULL, PRIMARY KEY (org_id, user_id))"
  ).run();
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
  const wk = await db.prepare("SELECT wrapped_key FROM org_key_wrapped WHERE org_id = ? AND user_id = ?")
    .bind(orgId, auth.userId).first();

  return json({
    ok: true,
    has_org_key: !!org,
    encrypted_org_metadata: org?.encrypted_org_metadata || null,
    wrapped_key: wk?.wrapped_key || null,
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

  if (!wrappedKeys || !wrappedKeys.length) return bad(400, "MISSING_WRAPPED_KEYS");

  await db.prepare("INSERT OR REPLACE INTO org_keys (org_id, encrypted_org_metadata) VALUES (?, ?)")
    .bind(orgId, encryptedOrgMetadata).run();

  const stmt = db.prepare("INSERT OR REPLACE INTO org_key_wrapped (org_id, user_id, wrapped_key) VALUES (?, ?, ?)");
  for (const wk of wrappedKeys) {
    if (!wk?.user_id || !wk?.wrapped_key) continue;
    await stmt.bind(orgId, wk.user_id, wk.wrapped_key).run();
  }

  return json({ ok: true });
}
