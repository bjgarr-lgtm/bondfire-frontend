import { json, bad, now } from "../../../../_lib/http.js";
import { requireOrgRole } from "../../../../_lib/auth.js";
import { decryptDriveValue, encryptDriveValue, ensureDriveSchema, normalizeParentId, normalizeString, normalizeTags, parseTags } from "../../../../_lib/drive.js";

export async function onRequestPatch({ env, request, params }) {
  const orgId = params.orgId;
  const id = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  const body = await request.json().catch(() => ({}));
  await ensureDriveSchema(env.BF_DB);
  const existing = await env.BF_DB.prepare(`SELECT id, parent_id, title, content, tags, created_at, updated_at FROM drive_notes WHERE org_id = ? AND id = ?`).bind(orgId, id).first();
  if (!existing) return bad(404, "NOT_FOUND");
  const title = body.title === undefined ? existing.title : (normalizeString(body.title).trim() || "untitled");
  const content = body.content === undefined ? existing.content : await encryptDriveValue(normalizeString(body.content), env);
  const parentId = body.parent_id === undefined && body.parentId === undefined ? existing.parent_id : normalizeParentId(body.parent_id ?? body.parentId);
  const tags = body.tags === undefined ? existing.tags : normalizeTags(body.tags);
  const updatedAt = now();
  await env.BF_DB.prepare(`UPDATE drive_notes SET title = ?, content = ?, parent_id = ?, tags = ?, updated_at = ? WHERE org_id = ? AND id = ?`).bind(title, content, parentId, tags, updatedAt, orgId, id).run();
  return json({ ok: true, note: { id, org_id: orgId, parent_id: parentId, title, content: await decryptDriveValue(content, env), tags: parseTags(tags), created_at: existing.created_at, updated_at: updatedAt } });
}

export async function onRequestDelete({ env, request, params }) {
  const orgId = params.orgId;
  const id = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env.BF_DB);
  const result = await env.BF_DB.prepare(`DELETE FROM drive_notes WHERE org_id = ? AND id = ?`).bind(orgId, id).run();
  if (!result?.success) return bad(404, "NOT_FOUND");
  return json({ ok: true });
}
