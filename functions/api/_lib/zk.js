export async function ensureZkSchema(db) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS org_key_wrapped (\n" +
      "org_id TEXT NOT NULL,\n" +
      "user_id TEXT NOT NULL,\n" +
      "wrapped_key TEXT NOT NULL,\n" +
      "kid TEXT,\n" +
      "created_at INTEGER DEFAULT (strftime('%s','now')*1000),\n" +
      "PRIMARY KEY (org_id, user_id)\n" +
    ")"
  ).run();
  await db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_org_key_wrapped_org ON org_key_wrapped(org_id)"
  ).run();
}
