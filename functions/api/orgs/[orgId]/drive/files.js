import { bad } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { ensureDriveSchema, getDb, getDriveBucket, normalizeNullableId, created, json, now, uuid, saveFileBlob, getFileRecord, isEditableTextMime, dataUrlFromBytes, textFromBytes } from "../../../_lib/drive.js";

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

  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  const db = getDb(env);
  const id = uuid();
  const t = now();

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const upload = form.get("file");
    if (!upload || typeof upload.arrayBuffer !== "function") return bad(400, "FILE_REQUIRED");

    const name = String(form.get("name") || upload.name || "file").trim() || "file";
    const mime = String(form.get("mime") || upload.type || "application/octet-stream");
    const parentId = normalizeNullableId(form.get("parentId"));
    const storageKey = `${orgId}/drive/files/${id}/${encodeURIComponent(name)}`;
    const size = Number(upload.size || 0);
    const file = {
      id,
      parentId,
      name,
      mime,
      size,
      storageKey,
      createdAt: t,
      updatedAt: t,
    };

    await db.prepare(`INSERT INTO drive_files (id, org_id, parent_id, name, mime, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, orgId, parentId, name, mime, size, storageKey, t, t).run();

    const bytes = new Uint8Array(await upload.arrayBuffer());
    const bucket = getDriveBucket(env);
    if (bucket && storageKey) {
      await bucket.put(storageKey, bytes, { httpMetadata: { contentType: mime || "application/octet-stream" } });
      await db.prepare(`DELETE FROM drive_file_blobs WHERE org_id = ? AND file_id = ?`).bind(orgId, id).run();
    } else {
      const dataUrl = dataUrlFromBytes(bytes, mime || "application/octet-stream");
      const textContent = isEditableTextMime(mime, name) ? textFromBytes(bytes) : "";
      await saveFileBlob(env, { orgId, fileId: id, storageKey, mime, dataUrl, textContent });
    }

    const createdFile = await getFileRecord(env, orgId, id, { includeData: isEditableTextMime(mime, name) });
    return created("file", createdFile || file);
  }

  const body = await request.json().catch(() => ({}));
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
  await db.prepare(`INSERT INTO drive_files (id, org_id, parent_id, name, mime, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, orgId, file.parentId, name, mime, file.size, storageKey, t, t).run();
  await saveFileBlob(env, { orgId, fileId: id, storageKey, mime, dataUrl: String(body.dataUrl || ""), textContent: String(body.textContent || "") });
  const createdFile = await getFileRecord(env, orgId, id, { includeData: isEditableTextMime(mime, name) });
  return created("file", createdFile || file);
}
