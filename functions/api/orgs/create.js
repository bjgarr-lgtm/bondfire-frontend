import { json, bad, now, uuid } from "../_lib/http.js";
import { getDb, requireUser } from "../_lib/auth.js";

async function ensureTables(db) {
  await db
    .prepare(`
      CREATE TABLE IF NOT EXISTS orgs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)
    .run();

  await db
    .prepare(`
      CREATE TABLE IF NOT EXISTS org_memberships (
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (org_id, user_id)
      )
    `)
    .run();
}


export async function onRequestPost({ request, env }) {
  if (!env.JWT_SECRET) return bad(500, "JWT_SECRET_MISSING");

  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;

  const meId = u.user?.sub || u.user?.id || u.user?.userId;
  if (!meId) return bad(401, "UNAUTHORIZED");

  const db = getDb(env);
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
    .bind(orgId, meId, "owner", t)
    .run();

  return json({ ok: true, org: { id: orgId, name }, membership: { role: "owner" } });
}
