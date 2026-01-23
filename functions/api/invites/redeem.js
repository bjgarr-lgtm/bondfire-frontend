import { json, bad, now } from "../_lib/http";
import { requireAuth } from "../_lib/auth";

async function ensureInvitesTable(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS org_invites (
      code TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      uses INTEGER NOT NULL DEFAULT 0,
      max_uses INTEGER NOT NULL DEFAULT 1,
      expires_at INTEGER,
      created_by TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON org_invites(org_id);
  `);
}

export async function onRequest(context) {
  const { request, env } = context;

  const user = await requireAuth(context);
  if (user instanceof Response) return user;

  if (request.method !== "POST") return bad("method not allowed", 405);

  const body = await request.json().catch(() => ({}));
  const code = String(body.code || "").trim().toUpperCase();
  if (!code) return bad("missing invite code", 400);

  const db = env.BF_DB;
  await ensureInvitesTable(db);

  const invite = await db
    .prepare(
      `SELECT code, org_id, role, uses, max_uses, expires_at
       FROM org_invites WHERE code=?`
    )
    .bind(code)
    .first();

  if (!invite) return bad("Invalid invite code", 404);

  const nowTs = now();
  if (invite.expires_at && Number(invite.expires_at) < nowTs) {
    return bad("Invite code expired", 400);
  }
  if (Number(invite.uses) >= Number(invite.max_uses)) {
    return bad("Invite code has been used up", 400);
  }

  // Add (or keep) membership.
  const orgId = invite.org_id;
  const existing = await db
    .prepare(`SELECT role FROM org_memberships WHERE org_id=? AND user_id=?`)
    .bind(orgId, user.id)
    .first();

  if (!existing) {
    await db
      .prepare(
        `INSERT INTO org_memberships (org_id, user_id, role, joined_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(orgId, user.id, invite.role || "member", nowTs)
      .run();
  }

  // Consume a use.
  await db
    .prepare(`UPDATE org_invites SET uses = uses + 1 WHERE code=?`)
    .bind(code)
    .run();

  const org = await db
    .prepare(`SELECT id, name, slug, created_at FROM orgs WHERE id=?`)
    .bind(orgId)
    .first();

  return json({ ok: true, org });
}
