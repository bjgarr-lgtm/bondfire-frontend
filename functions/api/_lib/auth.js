import { bad } from "./http.js";
import { verifyJwt } from "./jwt.js";

export async function requireUser({ env, request }) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/);
  if (!m) return { ok: false, resp: bad(401, "UNAUTHORIZED") };

  const payload = await verifyJwt(env.JWT_SECRET, m[1]);
  if (!payload) return { ok: false, resp: bad(401, "UNAUTHORIZED") };

  return { ok: true, user: payload };
}

export async function requireOrgRole({ env, request, orgId, minRole }) {
  const u = await requireUser({ env, request });
  if (!u.ok) return u;

  const roleRank = { viewer: 1, member: 2, admin: 3, owner: 4 };
  const need = roleRank[minRole || "member"] || 2;

  const row = await env.BF_DB.prepare(
    "SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?"
  ).bind(orgId, u.user.sub).first();

  if (!row) return { ok: false, resp: bad(403, "NOT_A_MEMBER") };
  if ((roleRank[row.role] || 0) < need) return { ok: false, resp: bad(403, "INSUFFICIENT_ROLE") };

  return { ok: true, user: u.user, role: row.role };
}
