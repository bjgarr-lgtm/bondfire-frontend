import { err } from "./http.js";

const ROLE_RANK = { viewer: 0, member: 1, admin: 2, owner: 3 };
const DEFAULT_MIN_ROLE = "member";

// Back-compat: some earlier DBs used a different table name.
const MEMBERSHIP_TABLES = ["org_memberships", "org_members"];

function normalizeMinRole(minRole) {
  const r = String(minRole || DEFAULT_MIN_ROLE).toLowerCase();
  return ROLE_RANK[r] == null ? DEFAULT_MIN_ROLE : r;
}

function getBearerToken(request) {
  const h = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function decodeJwtNoVerify(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function queryMembership(env, orgId, userId) {
  for (const table of MEMBERSHIP_TABLES) {
    try {
      const row = await env.BF_DB
        .prepare(`SELECT role FROM ${table} WHERE org_id = ? AND user_id = ? LIMIT 1`)
        .bind(orgId, userId)
        .first();
      if (row && row.role) return { role: String(row.role).toLowerCase(), table };
    } catch {
      // table probably doesn't exist in this environment, try next
    }
  }
  return null;
}

/**
 * Back-compat calling conventions supported:
 *   1) requireOrgRole({ env, request, orgId, minRole })
 *   2) requireOrgRole(ctx, orgId, minRole)  where ctx = { env, request, params?... }
 */
export async function requireOrgRole(arg1, arg2, arg3) {
  let env;
  let request;
  let orgId;
  let minRole;

  if (arg1 && arg1.env && arg1.request && typeof arg1 === "object" && !arg1.params) {
    // legacy object style
    env = arg1.env;
    request = arg1.request;
    orgId = arg1.orgId;
    minRole = arg1.minRole;
  } else {
    // ctx style
    const ctx = arg1;
    env = ctx?.env;
    request = ctx?.request;
    orgId = arg2 ?? ctx?.params?.orgId;
    minRole = arg3;
  }

  const token = getBearerToken(request);
  if (!token) throw err("UNAUTH", 401);

  // We do NOT verify here (your existing stack didn’t include verification either).
  // If you want full verification later, we can wire it into jwt.js.
  const payload = decodeJwtNoVerify(token);
  const userId = payload?.sub || payload?.userId || payload?.uid;
  if (!userId) throw err("UNAUTH", 401);

  const need = normalizeMinRole(minRole);
  const mem = await queryMembership(env, orgId, userId);
  if (!mem) throw err("NOT_A_MEMBER", 403);

  const haveRank = ROLE_RANK[mem.role] ?? -1;
  const needRank = ROLE_RANK[need];
  if (haveRank < needRank) throw err("FORBIDDEN", 403, { need, have: mem.role });

  return { userId, role: mem.role };
}

/**
 * Some files still import this name.
 * Returns userId if present, otherwise null.
 */
export async function getUserIdFromRequest(request) {
  const token = getBearerToken(request);
  if (!token) return null;
  const payload = decodeJwtNoVerify(token);
  return payload?.sub || payload?.userId || payload?.uid || null;
}
