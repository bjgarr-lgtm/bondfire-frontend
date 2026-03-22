import { json, bad } from "../../../../_lib/http.js";
import { requireOrgRole } from "../../../../_lib/auth.js";
import { ensureDriveSchema, getDriveBucket } from "../../../../_lib/drive.js";

export async function onRequestDelete({ env, request, params }) {
  const orgId = params.orgId;
  const id = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env.BF_DB);
  const row = await env.BF_DB.prepare(`SELECT storage_key FROM drive_files WHERE org_id = ? AND id = ?`).bind(orgId, id).first();
  if (!row) return bad(404, "NOT_FOUND");
  const bucket = getDriveBucket(env);
  if (bucket && row.storage_key) {
    try { await bucket.delete(String(row.storage_key)); } catch {}
  }
  await env.BF_DB.prepare(`DELETE FROM drive_files WHERE org_id = ? AND id = ?`).bind(orgId, id).run();
  return json({ ok: true });
}
