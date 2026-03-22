import { bad } from "../../../../_lib/http.js";
import { requireOrgRole } from "../../../../_lib/auth.js";
import { ensureDriveSchema, getDb, normalizeNullableId, json, now } from "../../../../_lib/drive.js";

export async function onRequestPatch({ env, request, params }) {
  const orgId = params.orgId;
  const folderId = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env);
  const body = await request.json().catch(() => ({}));
  const db = getDb(env);
  await db.prepare(
    `UPDATE drive_folders
     SET parent_id = COALESCE(?, parent_id),
         name = COALESCE(?, name),
         updated_at = ?
     WHERE org_id = ? AND id = ?`
  ).bind(
    Object.prototype.hasOwnProperty.call(body, "parentId") ? normalizeNullableId(body.parentId) : null,
    body.name === undefined ? null : String(body.name || "").trim() || "untitled folder",
    now(),
    orgId,
    folderId
  ).run();
  const folder = await db.prepare(`SELECT id, parent_id, name, created_at, updated_at FROM drive_folders WHERE org_id = ? AND id = ?`).bind(orgId, folderId).first();
  if (!folder) return bad(404, "NOT_FOUND");
  return json({ ok: true, folder: { id: folder.id, parentId: folder.parent_id || null, name: folder.name, createdAt: Number(folder.created_at || 0), updatedAt: Number(folder.updated_at || 0) } });
}

export async function onRequestDelete({ env, request, params }) {
  const orgId = params.orgId;
  const folderId = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env);
  const db = getDb(env);
  const folder = await db.prepare(`SELECT parent_id FROM drive_folders WHERE org_id = ? AND id = ?`).bind(orgId, folderId).first();
  if (!folder) return bad(404, "NOT_FOUND");
  const parentId = folder.parent_id || null;
  const t = now();
  await db.prepare(`UPDATE drive_folders SET parent_id = ?, updated_at = ? WHERE org_id = ? AND parent_id = ?`).bind(parentId, t, orgId, folderId).run();
  await db.prepare(`UPDATE drive_notes SET parent_id = ?, updated_at = ? WHERE org_id = ? AND parent_id = ?`).bind(parentId, t, orgId, folderId).run();
  await db.prepare(`UPDATE drive_files SET parent_id = ?, updated_at = ? WHERE org_id = ? AND parent_id = ?`).bind(parentId, t, orgId, folderId).run();
  await db.prepare(`DELETE FROM drive_folders WHERE org_id = ? AND id = ?`).bind(orgId, folderId).run();
  return json({ ok: true, deleted: true, id: folderId });
}
