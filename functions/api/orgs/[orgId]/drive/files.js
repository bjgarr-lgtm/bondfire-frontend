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
  const bucket = getDriveBucket(env);

  const persistBinaryUpload = async ({ name, mime, parentId, bytes }) => {
    const storageKey = `${orgId}/drive/files/${id}/${encodeURIComponent(name)}`;
    const size = Number(bytes?.byteLength || 0);

    if (bucket && storageKey) {
      try {
        await bucket.put(storageKey, bytes, { httpMetadata: { contentType: mime || "application/octet-stream" } });
      } catch (error) {
        return bad(500, "FILE_STORAGE_FAILED", { detail: String(error?.message || error || "Bucket write failed") });
      }
    } else {
      const tooLargeForInline = size > 4 * 1024 * 1024 && !isEditableTextMime(mime, name);
      if (tooLargeForInline) {
        return bad(500, "FILE_STORAGE_FAILED", { detail: "Drive bucket unavailable for large binary upload" });
      }
      const dataUrl = dataUrlFromBytes(bytes, mime || "application/octet-stream");
      const textContent = isEditableTextMime(mime, name) ? textFromBytes(bytes) : "";
      await saveFileBlob(env, { orgId, fileId: id, storageKey, mime, dataUrl, textContent });
    }

    await db.prepare(`INSERT INTO drive_files (id, org_id, parent_id, name, mime, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, orgId, parentId, name, mime, size, storageKey, t, t).run();
    const createdFile = await getFileRecord(env, orgId, id, { includeData: isEditableTextMime(mime, name) });
    return created("file", createdFile || { id, parentId, name, mime, size, storageKey, createdAt: t, updatedAt: t });
  };

  const headerName = String(request.headers.get("x-drive-name") || "").trim();
  if (headerName) {
    const name = headerName || "file";
    const mime = String(request.headers.get("x-drive-mime") || contentType || "application/octet-stream");
    const parentId = normalizeNullableId(request.headers.get("x-drive-parent-id"));
    const bytes = new Uint8Array(await request.arrayBuffer());
    return persistBinaryUpload({ name, mime, parentId, bytes });
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const upload = form.get("file");
    if (!upload || typeof upload.arrayBuffer !== "function") return bad(400, "FILE_REQUIRED");

    const name = String(form.get("name") || upload.name || "file").trim() || "file";
    const mime = String(form.get("mime") || upload.type || "application/octet-stream");
    const parentId = normalizeNullableId(form.get("parentId"));
    const bytes = new Uint8Array(await upload.arrayBuffer());
    return persistBinaryUpload({ name, mime, parentId, bytes });
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
