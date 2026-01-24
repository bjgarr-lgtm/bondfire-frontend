import { json, bad, now } from "../_lib/http";
import { requireAuth, getDb } from "../_lib/auth";

async function ensureInvitesTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      uses INTEGER NOT NULL DEFAULT 0,
      max_uses INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      created_by TEXT,
      created_at TEXT
    )`
  ).run();
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth.resp) return auth.resp;
  const me = auth.user;

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");
  await ensureInvitesTable(db);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const code = String(body.code || "").trim();
  if (!code) return bad(400, "Missing invite code");

  const invite = await db
    .prepare(
      `SELECT code, org_id, role, uses, max_uses, expires_at
       FROM invites
       WHERE code = ?`
    )
    .bind(code)
    .first();

  if (!invite) return bad(404, "INVITE_NOT_FOUND");
  if (invite.expires_at && Date.now() > new Date(invite.expires_at).getTime()) {
    return bad(410, "INVITE_EXPIRED");
  }
  if ((invite.uses || 0) >= (invite.max_uses || 1)) {
    return bad(410, "INVITE_USED_UP");
  }

  // add membership
  await db
    .prepare(
      `INSERT INTO org_memberships (org_id, user_id, role, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(org_id, user_id) DO UPDATE SET role = excluded.role`
    )
    .bind(invite.org_id, me.id, invite.role || "member", now())
    .run();

  await db
    .prepare("UPDATE invites SET uses = uses + 1 WHERE code = ?")
    .bind(code)
    .run();

  return json({ ok: true, orgId: invite.org_id, role: invite.role || "member" });
}
