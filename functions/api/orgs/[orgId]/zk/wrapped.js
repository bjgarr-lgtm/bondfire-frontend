import { ok, bad } from "../../../_lib/http.js";
import { requireUser, getDb } from "../../../_lib/auth.js";
import { ensureZkSchema } from "../../../_lib/zk.js";

export async function onRequestGet({ env, request, params }) {
  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;
  const db = getDb(env);
  await ensureZkSchema(db);
  const orgId = String(params.orgId || "");
  if (!orgId) return bad(400, "MISSING_ORG_ID");

  const m = await db.prepare(
    "SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?"
  ).bind(orgId, String(u.user.sub)).first();
  if (!m) return bad(403, "NOT_IN_ORG");

  const row = await db.prepare(
    "SELECT wrapped_key, kid, created_at FROM org_key_wrapped WHERE org_id = ? AND user_id = ?"
  ).bind(orgId, String(u.user.sub)).first();

  if (!row) return ok({ has_key: false });

  let wrapped = null;
  try { wrapped = JSON.parse(row.wrapped_key); } catch { wrapped = row.wrapped_key; }
  return ok({ has_key: true, kid: row.kid || null, wrapped_key: wrapped, created_at: row.created_at || null });
}
