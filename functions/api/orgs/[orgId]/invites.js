import { json } from "../../../_lib/http";
import { requireOrgRole } from "../../../_lib/auth";

function nowMs() {
  return Date.now();
}

function genCode() {
  // human-friendly-ish: 10 chars, uppercase
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function ensureInvitesTable(db) {
  // Safe to run repeatedly.
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
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_invites_org ON invites(org_id);`)
    .run();
}

export async function onRequestGet({ env, params, request }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole(request, env, orgId, "admin");
  if (!auth.ok) return json(auth, auth.status);

  const db = env.BF_DB;
  await ensureInvitesTable(db);

  const rows = await db
    .prepare(
      `SELECT code, role, uses, max_uses, expires_at, created_at, created_by
       FROM invites
       WHERE org_id = ?
       ORDER BY created_at DESC
       LIMIT 100;`
    )
    .bind(orgId)
    .all();

  return json({ ok: true, invites: rows.results || [] });
}

export async function onRequestPost({ env, params, request }) {
  const orgId = params.orgId;
  // Owner/admin can create invites
  const auth = await requireOrgRole(request, env, orgId, "admin");
  if (!auth.ok) return json(auth, auth.status);

  const db = env.BF_DB;
  await ensureInvitesTable(db);

  const body = await request.json().catch(() => ({}));
  const role = (body.role || "member").toLowerCase();
  const maxUses = Number.isFinite(body.maxUses)
    ? body.maxUses
    : Number.isFinite(body.max_uses)
      ? body.max_uses
      : Number.isFinite(body.maxUses)
        ? body.maxUses
        : 1;
  const expiresInDays = Number.isFinite(body.expiresInDays) ? body.expiresInDays : 14;
  const expiresAt = expiresInDays > 0 ? nowMs() + expiresInDays * 86400 * 1000 : null;

  // keep it simple: roles limited
  const safeRole = ["member", "admin"].includes(role) ? role : "member";
  const safeMaxUses = Math.max(1, Math.min(100, parseInt(maxUses, 10) || 1));

  // Try a few times in case of rare collisions
  let code = "";
  for (let i = 0; i < 5; i++) {
    code = genCode();
    const exists = await db
      .prepare(`SELECT code FROM invites WHERE code = ? LIMIT 1;`)
      .bind(code)
      .first();
    if (!exists) break;
    code = "";
  }
  if (!code) return json({ ok: false, error: "Could not generate invite" }, 500);

  const createdAt = nowMs();
  const createdBy = auth.user?.id || null;

  await db
    .prepare(
      `INSERT INTO invites(code, org_id, role, uses, max_uses, expires_at, created_at, created_by)
       VALUES(?, ?, ?, 0, ?, ?, ?, ?);`
    )
    .bind(code, orgId, safeRole, safeMaxUses, expiresAt, createdAt, createdBy)
    .run();

  return json({
    ok: true,
    invite: {
      code,
      org_id: orgId,
      role: safeRole,
      uses: 0,
      max_uses: safeMaxUses,
      expires_at: expiresAt,
      created_at: createdAt,
      created_by: createdBy,
    },
  });
}
