import { getDb } from './auth.js';

async function tableInfo(db, table) {
  const rows = await db.prepare(`PRAGMA table_info(${table})`).all();
  return rows?.results || [];
}

export async function ensureZkSchema(env) {
  const db = getDb(env);
  if (!db) throw new Error('NO_DB_BINDING');

  // org_crypto: tracks version
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS org_crypto (
      org_id TEXT PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )`
  ).run();

  // org_key_wrapped: may have older schema (PK org_id,user_id) without key_version/wrapped_at.
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS org_key_wrapped (
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      wrapped_key TEXT NOT NULL,
      PRIMARY KEY (org_id, user_id)
    )`
  ).run();

  // Add optional columns if missing (safe additive changes)
  const cols = await tableInfo(db, 'org_key_wrapped');
  const colNames = new Set(cols.map((c) => c.name));

  if (!colNames.has('key_version')) {
    try {
      await db.prepare('ALTER TABLE org_key_wrapped ADD COLUMN key_version INTEGER').run();
    } catch (_) {
      // Ignore if cannot alter (some D1 environments can be finicky). We'll run in compatibility mode.
    }
  }
  if (!colNames.has('wrapped_at')) {
    try {
      await db.prepare('ALTER TABLE org_key_wrapped ADD COLUMN wrapped_at INTEGER').run();
    } catch (_) {
      // ignore
    }
  }

  return { db };
}

export async function getOrgKeyVersion(db, orgId) {
  const row = await db.prepare('SELECT version FROM org_crypto WHERE org_id = ?').bind(orgId).first();
  return row?.version ? Number(row.version) : null;
}

export async function ensureOrgCryptoRow(db, orgId) {
  const now = Date.now();
  await db.prepare(
    'INSERT OR IGNORE INTO org_crypto (org_id, version, created_at) VALUES (?, 1, ?)'
  ).bind(orgId, now).run();
  const v = await getOrgKeyVersion(db, orgId);
  return v ?? 1;
}

export async function bumpOrgKeyVersion(db, orgId) {
  const now = Date.now();
  await db.prepare(
    'INSERT OR IGNORE INTO org_crypto (org_id, version, created_at) VALUES (?, 1, ?)'
  ).bind(orgId, now).run();
  await db.prepare('UPDATE org_crypto SET version = version + 1 WHERE org_id = ?').bind(orgId).run();
  const v = await getOrgKeyVersion(db, orgId);
  return v ?? 1;
}

export async function orgKeyWrappedCapabilities(db) {
  const cols = await db.prepare('PRAGMA table_info(org_key_wrapped)').all();
  const names = new Set((cols?.results || []).map((c) => c.name));
  return {
    hasKeyVersion: names.has('key_version'),
    hasWrappedAt: names.has('wrapped_at'),
  };
}
