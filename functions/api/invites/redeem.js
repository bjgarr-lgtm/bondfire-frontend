import { json, bad } from "../_lib/http.js";
import { getDb, requireUser } from "../_lib/auth.js";


export async function onRequestPost({ request, env }) {

  if (!env.JWT_SECRET) return bad(500, "JWT_SECRET_MISSING");

  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;
  const userId = u.user?.sub || u.user?.userId || u.user?.id;
  if (!userId) return bad(401, "UNAUTHORIZED");

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");

  const body = await request.json().catch(() => ({}));
  const cleanCode = String(body.code || "").trim().toUpperCase();
  if (!cleanCode) return json({ ok: false, error: "Missing invite code" }, 400);

  try {
    const invite = await db
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

    const role = String(invite.role || "member");

    await db
      .prepare(
        `INSERT OR IGNORE INTO org_memberships
         (org_id, user_id, role, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(invite.org_id, userId, role, Date.now())
      .run();

    await db
      .prepare("UPDATE invites SET uses = uses + 1 WHERE code = ?")
      .bind(cleanCode)
      .run();

    const org = await db
      .prepare("SELECT id, name FROM orgs WHERE id = ?")
      .bind(invite.org_id)
      .first();

    return json({
      ok: true,
      org: org ? { id: org.id, name: org.name } : { id: invite.org_id },
      membership: { role },
    });
  } catch (e) {
    return bad(500, e?.message || "INVITE_REDEEM_ERROR");
  }}