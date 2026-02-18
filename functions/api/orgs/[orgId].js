import { json, bad } from "../_lib/http.js";
import { getDb, requireOrgRole } from "../_lib/auth.js";

export async function onRequestDelete({ env, request, params }) {
  const orgId = params?.orgId;
  if (!orgId) return bad(400, "MISSING_ORG_ID");

  const auth = await requireOrgRole({ env, request, orgId, minRole: "owner" });
  if (!auth.ok) return auth.resp;

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");

  // Basic safety: do it in the right order.
  // If you later add more org-scoped tables, delete those too.
  await db.prepare("DELETE FROM org_memberships WHERE org_id = ?").bind(orgId).run();
  const delOrg = await db.prepare("DELETE FROM orgs WHERE id = ?").bind(orgId).run();

  // D1 run() returns meta; we can’t always rely on a changes count, so just return ok.
  return json({ ok: true, deleted: true, orgId });
}
