import { requireAuth, requireOrgRole } from "../../_lib/auth";

export async function onRequestPost({ env, request, params }) {
  const user = await requireAuth(request, env);
  await requireOrgRole(user, params.orgId, "admin", env);

  const db = env.BF_DB || env.DB;
  if (!db) {
    return new Response(JSON.stringify({ ok: false, error: "DB not bound" }), { status: 500 });
  }

  const code = crypto.randomUUID().slice(0, 8).toUpperCase();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60 * 24 * 14;

  await db.prepare(
    `INSERT INTO invites (code, org_id, role, expires_at, max_uses, uses)
     VALUES (?, ?, ?, ?, ?, 0)`
  ).bind(code, params.orgId, "member", expiresAt, 1).run();

  // 🔥 ALWAYS fetch and return the invite you just made
  const invite = await db.prepare(
    `SELECT code, role, expires_at, max_uses, uses
     FROM invites WHERE code = ?`
  ).bind(code).first();

  return new Response(
    JSON.stringify({ ok: true, invite }),
    { headers: { "Content-Type": "application/json" } }
  );
}
