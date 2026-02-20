import { ok, bad, readJSON, requireMethod } from "../../../_lib/http.js";
import { requireUser, getDb } from "../../../_lib/auth.js";
import { ensureZkSchema } from "../../../_lib/zk.js";

export async function onRequestPost({ env, request, params }) {
  requireMethod(request, "POST");
  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;
  const db = getDb(env);
  await ensureZkSchema(db);
  const orgId = String(params.orgId || "");
  if (!orgId) return bad(400, "MISSING_ORG_ID");

  const body = await readJSON(request, {});
  const targetUserId = String(body?.user_id || u.user.sub);
  const wrappedKey = body?.wrapped_key;
  const kid = String(body?.kid || "").trim() || crypto.randomUUID();

  if (!wrappedKey) return bad(400, "MISSING_WRAPPED_KEY");

  const actor = await db.prepare(
    "SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?"
  ).bind(orgId, String(u.user.sub)).first();
  if (!actor) return bad(403, "NOT_IN_ORG");

  // Only allow self by default; allow owners/admins to wrap for others.
  const isPriv = actor.role === "owner" || actor.role === "admin";
  if (targetUserId !== String(u.user.sub) && !isPriv) return bad(403, "FORBIDDEN");

  const targetMember = await db.prepare(
    "SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?"
  ).bind(orgId, targetUserId).first();
  if (!targetMember) return bad(404, "TARGET_NOT_IN_ORG");

  let serialized = "";
  try { serialized = JSON.stringify(wrappedKey); } catch { return bad(400, "INVALID_WRAPPED_KEY"); }

  await db.prepare(
    "INSERT INTO org_key_wrapped (org_id, user_id, wrapped_key, kid) VALUES (?, ?, ?, ?)\n     ON CONFLICT(org_id, user_id) DO UPDATE SET wrapped_key = excluded.wrapped_key, kid = excluded.kid"
  ).bind(orgId, targetUserId, serialized, kid).run();

  return ok({ saved: true, kid, user_id: targetUserId });
}
