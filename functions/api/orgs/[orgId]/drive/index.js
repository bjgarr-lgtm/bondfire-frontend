import { json } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { ensureDriveSchema, listDriveState } from "../../../_lib/drive.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env.BF_DB);
  const state = await listDriveState(env.BF_DB, orgId);
  return json({ ok: true, ...state });
}
