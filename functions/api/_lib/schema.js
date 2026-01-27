// Minimal D1 schema bootstrap.
//
// Pages Functions do not run migrations automatically. To keep Bondfire usable
// in fresh environments (or after you change tables), we create the required
// tables lazily at request time.

export async function ensureCoreTables(db) {
  // users
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`
    )
    .run();

  // orgs
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS orgs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        created_by TEXT NOT NULL
      )`
    )
    .run();

  // org memberships
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS org_memberships (
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(org_id, user_id)
      )`
    )
    .run();

  // invites
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS invites (
        code TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        role TEXT NOT NULL,
        uses INTEGER NOT NULL DEFAULT 0,
        max_uses INTEGER NOT NULL DEFAULT 1,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        created_by TEXT NOT NULL
      )`
    )
    .run();
}
