import { json, bad, now } from "../../_lib/http";
import { requireAuth, requireOrgRole } from "../../_lib/auth";

function randCode(len = 10) {
  // URL-friendly, human-copyable-ish.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no O0I1
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

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
  const { request, env, params } = context;

  const user = await requireAuth(context);
  if (user instanceof Response) return user;

  const orgId = params.orgId;
  if (!orgId) return bad("missing orgId", 400);

  // Only owners/admins can manage codes.
  const role = await requireOrgRole(env.BF_DB, orgId, user.id, "admin");
  if (!role) return bad("forbidden", 403);

  await ensureInvitesTable(env.BF_DB);

  if (request.method === "GET") {
    const { results } = await env.BF_DB
      .prepare(
        `SELECT code, role, uses, max_uses, expires_at, created_at
         FROM org_invites
         WHERE org_id = ?
         ORDER BY created_at DESC
         LIMIT 50`
      )
      .bind(orgId)
      .all();
    return json({ ok: true, invites: results || [] });
  }

  if (request.method === "POST") {
    let body = {};
    try {
      body = (await request.json()) || {};
    } catch {}

    const inviteRole = (body.role || "member").toLowerCase();
    const maxUses = Math.max(1, Math.min(100, Number(body.maxUses || 1)));
    const expiresInDays = Number(body.expiresInDays || 14);
    const expiresAt =
      expiresInDays > 0 ? now() + Math.floor(expiresInDays * 86400) : null;

    let code = randCode(10);
    // Retry a few times on collision.
    for (let i = 0; i < 5; i++) {
      try {
        await env.BF_DB
          .prepare(
            `INSERT INTO org_invites (code, org_id, role, uses, max_uses, expires_at, created_by, created_at)
             VALUES (?, ?, ?, 0, ?, ?, ?, ?)`
          )
          .bind(code, orgId, inviteRole, maxUses, expiresAt, user.id, now())
          .run();
        break;
      } catch {
        code = randCode(10);
      }
    }

    const invite = {
      code,
      role: inviteRole,
      uses: 0,
      max_uses: maxUses,
      expires_at: expiresAt,
      created_at: now(),
    };
    return json({ ok: true, invite });
  }

  return bad("method not allowed", 405);
}
