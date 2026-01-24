import { json, bad, now, uuid } from "../_lib/http";
import { requireAuth } from "../_lib/auth";

async function ensureTables(db) {
  // orgs + org_memberships already exist in schema, but in case you deploy to a fresh DB
  // this keeps the endpoint from hard-failing.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS org_memberships (
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (org_id, user_id)
    );
  `);
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth.resp) return auth.resp;
  const me = auth.user;

  const db = env.BF_DB || env.DB || env.db;
  if (!db) return bad(500, "NO_DB_BINDING");

  await ensureTables(db);

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name) return bad(400, "Missing org name");

  const orgId = uuid();
  const t = now();

  await db
    .prepare("INSERT INTO orgs (id, name, created_at) VALUES (?, ?, ?)")
    .bind(orgId, name, t)
    .run();

  await db
    .prepare(
      "INSERT INTO org_memberships (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)"
    )
    .bind(orgId, me.id, "owner", t)
    .run();

  return json({ ok: true, org: { id: orgId, name }, membership: { role: "owner" } });
}
