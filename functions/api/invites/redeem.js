import { ensureSchema } from "../_lib/schema";
import { json } from "../_lib/http";

export async function onRequestPost({ request, env }) {
  await ensureSchema(env);

  const { code, userId } = await request.json();
  const cleanCode = code.trim().toUpperCase();

  const invite = await env.DB
    .prepare("SELECT * FROM invites WHERE code = ?")
    .bind(cleanCode)
    .first();

  if (!invite) {
    return json({ ok: false, error: "Invalid invite code" }, 400);
  }

  if (invite.expires_at && Date.now() > invite.expires_at) {
    return json({ ok: false, error: "Invite expired" }, 400);
  }

  if (invite.max_uses && invite.uses >= invite.max_uses) {
    return json({ ok: false, error: "Invite exhausted" }, 400);
  }

  await env.DB
    .prepare(`
      INSERT OR IGNORE INTO org_memberships
      (org_id, user_id, role, created_at)
      VALUES (?, ?, ?, ?)
    `)
    .bind(invite.org_id, userId, invite.role, Date.now())
    .run();

  await env.DB
    .prepare("UPDATE invites SET uses = uses + 1 WHERE code = ?")
    .bind(cleanCode)
    .run();

  return json({ ok: true, orgId: invite.org_id });
}
