import { json } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;

  const people = await env.BF_DB.prepare(
    "SELECT COUNT(*) as c FROM people WHERE org_id = ?"
  ).bind(orgId).first();

  const needsOpen = await env.BF_DB.prepare(
    "SELECT COUNT(*) as c FROM needs WHERE org_id = ? AND status = 'open'"
  ).bind(orgId).first();

  const needsAll = await env.BF_DB.prepare(
    "SELECT COUNT(*) as c FROM needs WHERE org_id = ?"
  ).bind(orgId).first();

  return json({
    ok: true,
    counts: {
      people: people?.c || 0,
      needsOpen: needsOpen?.c || 0,
      needsAll: needsAll?.c || 0
    }
  });
}
