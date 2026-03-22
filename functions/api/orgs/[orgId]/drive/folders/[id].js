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
  const folder = await db.prepare(`SELECT id FROM drive_folders WHERE org_id = ? AND id = ?`).bind(orgId, folderId).first();
  if (!folder) return bad(404, "NOT_FOUND");

  const folderIds = [];
  const queue = [folderId];
  while (queue.length) {
    const currentId = queue.shift();
    if (!currentId || folderIds.includes(currentId)) continue;
    folderIds.push(currentId);
    const children = await db.prepare(`SELECT id FROM drive_folders WHERE org_id = ? AND parent_id = ?`).bind(orgId, currentId).all();
    for (const row of children?.results || []) {
      if (row?.id) queue.push(String(row.id));
    }
  }

  const placeholders = folderIds.map(() => "?").join(", ");
  await db.prepare(`DELETE FROM drive_notes WHERE org_id = ? AND parent_id IN (${placeholders})`).bind(orgId, ...folderIds).run();
  const filesToDelete = await db.prepare(`SELECT id, storage_key FROM drive_files WHERE org_id = ? AND parent_id IN (${placeholders})`).bind(orgId, ...folderIds).all();
  for (const file of filesToDelete?.results || []) {
    const storageKey = String(file?.storage_key || "").trim();
    if (!storageKey) continue;
    try {
      const bucket = env.DRIVE_BUCKET || env.BONDFIRE_DRIVE_BUCKET || env.R2 || null;
      if (bucket?.delete) await bucket.delete(storageKey);
    } catch {}
  }
  await db.prepare(`DELETE FROM drive_files WHERE org_id = ? AND parent_id IN (${placeholders})`).bind(orgId, ...folderIds).run();
  await db.prepare(`DELETE FROM drive_templates WHERE org_id = ? AND parent_id IN (${placeholders})`).bind(orgId, ...folderIds).run().catch(() => null);
  await db.prepare(`DELETE FROM drive_folders WHERE org_id = ? AND id IN (${placeholders})`).bind(orgId, ...folderIds).run();
  return json({ ok: true, deleted: true, id: folderId, deletedFolderIds: folderIds });
}
