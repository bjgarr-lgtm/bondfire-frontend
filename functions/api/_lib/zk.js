async function tryRun(db, sql) {
  try {
    await db.prepare(sql).run();
  } catch (e) {
    // D1/SQLite throws on duplicate columns, etc. That's fine.
    const msg = String(e?.message || "");
    if (msg.includes("duplicate") || msg.includes("already exists")) return;
    if (msg.includes("SQLITE_ERROR")) return;
    throw e;
  }
}

export async function ensureZkSchema(db) {
  await tryRun(
    db,
    "CREATE TABLE IF NOT EXISTS org_key_wrapped (\n" +
      "org_id TEXT NOT NULL,\n" +
      "user_id TEXT NOT NULL,\n" +
      "wrapped_key TEXT NOT NULL,\n" +
      "kid TEXT,\n" +
      "created_at INTEGER DEFAULT (strftime('%s','now')*1000),\n" +
      "key_version INTEGER DEFAULT 1,\n" +
      "PRIMARY KEY (org_id, user_id)\n" +
    ")"
  );
  await tryRun(db, "CREATE INDEX IF NOT EXISTS idx_org_key_wrapped_org ON org_key_wrapped(org_id)");

  await tryRun(
    db,
    "CREATE TABLE IF NOT EXISTS org_crypto (\n" +
      "org_id TEXT PRIMARY KEY,\n" +
      "key_version INTEGER NOT NULL DEFAULT 1,\n" +
      "updated_at INTEGER NOT NULL\n" +
    ")"
  );

  // best-effort column adds for older schemas
  await tryRun(db, "ALTER TABLE org_key_wrapped ADD COLUMN kid TEXT");
  await tryRun(db, "ALTER TABLE org_key_wrapped ADD COLUMN created_at INTEGER");
  await tryRun(db, "ALTER TABLE org_key_wrapped ADD COLUMN key_version INTEGER DEFAULT 1");
}

export async function getOrgKeyVersion(db, orgId) {
  await ensureZkSchema(db);
  const row = await db
    .prepare("SELECT key_version FROM org_crypto WHERE org_id = ?")
    .bind(orgId)
    .first();
  return Number.isFinite(Number(row?.key_version)) ? Number(row.key_version) : 1;
}

export async function bumpOrgKeyVersion(db, orgId) {
  await ensureZkSchema(db);
  const cur = await getOrgKeyVersion(db, orgId);
  const next = cur + 1;
  const t = Date.now();
  await db
    .prepare(
      "INSERT INTO org_crypto (org_id, key_version, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(org_id) DO UPDATE SET key_version = excluded.key_version, updated_at = excluded.updated_at"
    )
    .bind(orgId, next, t)
    .run();
  return next;
}
