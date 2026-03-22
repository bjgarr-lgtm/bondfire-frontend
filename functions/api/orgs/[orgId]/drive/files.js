import { requireOrgRole } from "../../../_lib/auth.js";
import { ensureDriveSchema, getDb, normalizeNullableId, created, json, now, uuid, saveFileBlob, getFileRecord, isEditableTextMime } from "../../../_lib/drive.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env);
  const res = await getDb(env).prepare(`SELECT id, parent_id, name, mime, size, storage_key, created_at, updated_at FROM drive_files WHERE org_id = ? ORDER BY LOWER(name) ASC`).bind(orgId).all();
  return json({ ok: true, files: (res.results || []).map((row) => ({ id: row.id, parentId: row.parent_id || null, name: row.name || "file", mime: row.mime || "application/octet-stream", size: Number(row.size || 0), storageKey: row.storage_key || null, createdAt: Number(row.created_at || 0), updatedAt: Number(row.updated_at || 0) })) });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env);
  const body = await request.json().catch(() => ({}));
  const id = uuid();
  const t = now();
  const name = String(body.name || "file").trim() || "file";
  const mime = String(body.mime || "application/octet-stream");
  const storageKey = `${orgId}/drive/files/${id}/${encodeURIComponent(name)}`;
  const file = {
    id,
    parentId: normalizeNullableId(body.parentId),
    name,
    mime,
    size: Number(body.size || 0),
    storageKey,
    createdAt: t,
    updatedAt: t,
  };
  await getDb(env).prepare(`INSERT INTO drive_files (id, org_id, parent_id, name, mime, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, orgId, file.parentId, name, mime, file.size, storageKey, t, t).run();
  await saveFileBlob(env, { orgId, fileId: id, storageKey, mime, dataUrl: String(body.dataUrl || ""), textContent: String(body.textContent || "") });
  const createdFile = await getFileRecord(env, orgId, id, { includeData: isEditableTextMime(mime, name) });
  return created("file", createdFile || file);
}
