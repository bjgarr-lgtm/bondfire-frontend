import { json, bad, now } from "../../../../_lib/http.js";
import { requireOrgRole } from "../../../../_lib/auth.js";
import { deleteDriveFolderTree, ensureDriveSchema, getDriveBucket, normalizeParentId, normalizeString } from "../../../../_lib/drive.js";

export async function onRequestPatch({ env, request, params }) {
  const orgId = params.orgId;
  const id = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  const body = await request.json().catch(() => ({}));
  await ensureDriveSchema(env.BF_DB);
  const existing = await env.BF_DB.prepare(`SELECT id, parent_id, name FROM drive_folders WHERE org_id = ? AND id = ?`).bind(orgId, id).first();
  if (!existing) return bad(404, "NOT_FOUND");
  const name = body.name === undefined ? existing.name : normalizeString(body.name).trim();
  if (!name) return bad(400, "MISSING_NAME");
  const parentId = body.parent_id === undefined && body.parentId === undefined ? existing.parent_id : normalizeParentId(body.parent_id ?? body.parentId);
  if (parentId === id) return bad(400, "INVALID_PARENT");
  await env.BF_DB.prepare(`UPDATE drive_folders SET name = ?, parent_id = ?, updated_at = ? WHERE org_id = ? AND id = ?`).bind(name, parentId, now(), orgId, id).run();
  return json({ ok: true });
}

export async function onRequestDelete({ env, request, params }) {
  const orgId = params.orgId;
  const id = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env.BF_DB);
  const existing = await env.BF_DB.prepare(`SELECT id FROM drive_folders WHERE org_id = ? AND id = ?`).bind(orgId, id).first();
  if (!existing) return bad(404, "NOT_FOUND");
  const result = await deleteDriveFolderTree(env.BF_DB, getDriveBucket(env), orgId, id);
  return json({ ok: true, ...result });
}
