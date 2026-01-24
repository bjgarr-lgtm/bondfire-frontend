import { ok, bad } from "../../_lib/http";
import { requireAuth, requireOrgRole, getDb } from "../../_lib/auth";

function randCode(len = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoids 0/O/1/I
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");

  const auth = await requireAuth(ctx);
  if (!auth.ok) return auth.resp;

  const orgId = params.orgId;
  const roleCheck = await requireOrgRole({ env, request, orgId, minRole: "owner" });
  if (!roleCheck.ok) return roleCheck.resp;

  try {
    if (request.method === "GET") {
      const rows = await db
        .prepare(
          `SELECT code, role, uses, max_uses, expires_at, created_at
           FROM invites
           WHERE org_id = ?
           ORDER BY created_at DESC
           LIMIT 50`
        )
        .bind(orgId)
        .all();

      return ok({
        invites: (rows.results || []).map((r) => ({
          code: r.code,
          role: r.role || "member",
          uses: toInt(r.uses, 0),
          max_uses: toInt(r.max_uses, 1),
          expires_at: r.expires_at ? new Date(r.expires_at).getTime() : null,
          created_at: r.created_at ? new Date(r.created_at).getTime() : null,
        })),
      });
    }

    if (request.method === "POST") {
      let body = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }

      const role = (body.role || "member").toString();
      const maxUses = toInt(body.maxUses ?? body.max_uses ?? body.maxUses, 1) || 1;
      const expiresInDays = toInt(body.expiresInDays, 14);

      const now = new Date();
      const expiresAt =
        expiresInDays && expiresInDays > 0
          ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
          : null;

      // Try a few times to avoid rare collisions.
      let code = null;
      for (let i = 0; i < 5; i++) {
        const candidate = randCode(10);
        const existing = await db
          .prepare("SELECT code FROM invites WHERE code = ? LIMIT 1")
          .bind(candidate)
          .first();
        if (!existing) {
          code = candidate;
          break;
        }
      }
      if (!code) return bad(500, "INVITE_CODE_COLLISION");

      await db
        .prepare(
          `INSERT INTO invites (org_id, code, role, uses, max_uses, expires_at, created_by, created_at)
           VALUES (?, ?, ?, 0, ?, ?, ?, ?)`
        )
        .bind(
          orgId,
          code,
          role,
          maxUses,
          expiresAt ? expiresAt.toISOString() : null,
          auth.user.id,
          now.toISOString()
        )
        .run();

      return ok({
        invite: {
          code,
          role,
          uses: 0,
          max_uses: maxUses,
          expires_at: expiresAt ? expiresAt.getTime() : null,
          created_at: now.getTime(),
        },
      });
    }

    return bad(405, "Method not allowed");
  } catch (e) {
    return bad(500, e?.message || "INVITES_ERROR");
  }
}
