import { json } from "../../_lib/http";
import { requireUser } from "../../_lib/auth";

async function ensureInvitesTable(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS invites (
        code TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        role TEXT NOT NULL,
        uses INTEGER NOT NULL DEFAULT 0,
        max_uses INTEGER NOT NULL DEFAULT 1,
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        created_by TEXT
      );`
    )
    .run();
}

async function ensureMembershipsTable(db) {
  // memberships table should already exist from schema.sql, but in case…
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS memberships (
        user_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, org_id)
      );`
    )
    .run();
}

export async function onRequestPost({ env, request }) {
  const auth = await requireUser(request, env);
  if (!auth.ok) return json(auth, auth.status);

  const body = await request.json().catch(() => ({}));
  const code = String(body.code || "").trim().toUpperCase();
  if (!code) return json({ ok: false, error: "Missing invite code" }, 400);

  const db = env.BF_DB;
  await ensureInvitesTable(db);
  await ensureMembershipsTable(db);

  // Fetch invite
  const invite = await db
    .prepare(
      `SELECT code, org_id, role, uses, max_uses, expires_at
       FROM invites
       WHERE code = ?
       LIMIT 1;`
    )
    .bind(code)
    .first();

  if (!invite) return json({ ok: false, error: "Invalid invite code" }, 404);

  const now = Date.now();
  if (invite.expires_at && Number(invite.expires_at) < now) {
    return json({ ok: false, error: "Invite expired" }, 400);
  }
  if (Number(invite.uses) >= Number(invite.max_uses)) {
    return json({ ok: false, error: "Invite already used" }, 400);
  }

  // Transaction-ish: bump uses, then ensure membership.
  // D1 doesn't do multi-statement transactions in Pages Functions reliably, so keep it simple.
  await db
    .prepare(`UPDATE invites SET uses = uses + 1 WHERE code = ?;`)
    .bind(code)
    .run();

  // Insert membership if not exists
  const role = ["member", "admin"].includes(invite.role) ? invite.role : "member";
  await db
    .prepare(
      `INSERT OR IGNORE INTO memberships(user_id, org_id, role, created_at)
       VALUES(?, ?, ?, ?);`
    )
    .bind(auth.user.id, invite.org_id, role, now)
    .run();

  // Fetch org name for UX
  const org = await db
    .prepare(`SELECT id, name FROM orgs WHERE id = ? LIMIT 1;`)
    .bind(invite.org_id)
    .first();

  return json({ ok: true, org: org || { id: invite.org_id, name: "" } });
}
