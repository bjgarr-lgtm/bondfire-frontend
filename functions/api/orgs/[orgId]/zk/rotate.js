import { ok, bad, requireMethod } from "../../../_lib/http.js";
import { requireUser, getDb } from "../../../_lib/auth.js";
import { ensureZkSchema, bumpOrgKeyVersion } from "../../../_lib/zk.js";

// Rotate the org key version.
// This does NOT generate keys server-side.
// Client must generate a new org key and re-wrap for members, then POST to /api/orgs/:orgId/crypto.

export async function onRequestPost({ env, request, params }) {
	requireMethod(request, "POST");
	const u = await requireUser({ env, request });
	if (!u.ok) return u.resp;

	const orgId = String(params.orgId || "");
	if (!orgId) return bad(400, "MISSING_ORG_ID");

	const db = getDb(env);
	await ensureZkSchema(db);

	const actor = await db
		.prepare("SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?")
		.bind(orgId, String(u.user.sub))
		.first();
	if (!actor) return bad(403, "NOT_IN_ORG");
	if (actor.role !== "owner" && actor.role !== "admin") return bad(403, "FORBIDDEN");

	const next = await bumpOrgKeyVersion(db, orgId);

	// Keep existing wrapped keys for now (so org doesn't brick if admin bails mid-flow).
	// Clients should overwrite via /crypto with the new key_version.
	return ok({ rotated: true, key_version: next });
}
