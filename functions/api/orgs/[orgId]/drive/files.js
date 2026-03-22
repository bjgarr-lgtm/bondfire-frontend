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

  async function persistUpload({ name, mime, parentId, bytes, size }) {
    const safeName = String(name || "file").trim() || "file";
    const safeMime = String(mime || "application/octet-stream");
    const safeParentId = normalizeNullableId(parentId);
    const safeSize = Number(size ?? bytes?.byteLength ?? 0);
    const storageKey = `${orgId}/drive/files/${id}/${encodeURIComponent(safeName)}`;

    await db.prepare(`INSERT INTO drive_files (id, org_id, parent_id, name, mime, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, orgId, safeParentId, safeName, safeMime, safeSize, storageKey, t, t)
      .run();

    const chunk = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const bucket = getDriveBucket(env);
    if (bucket && storageKey) {
      await bucket.put(storageKey, chunk, { httpMetadata: { contentType: safeMime || "application/octet-stream" } });
      await db.prepare(`DELETE FROM drive_file_blobs WHERE org_id = ? AND file_id = ?`).bind(orgId, id).run();
    } else {
      const dataUrl = dataUrlFromBytes(chunk, safeMime || "application/octet-stream");
      const textContent = isEditableTextMime(safeMime, safeName) ? textFromBytes(chunk) : "";
      await saveFileBlob(env, { orgId, fileId: id, storageKey, mime: safeMime, dataUrl, textContent });
    }

    const createdFile = await getFileRecord(env, orgId, id, { includeData: isEditableTextMime(safeMime, safeName) });
    return created("file", createdFile || {
      id,
      parentId: safeParentId,
      name: safeName,
      mime: safeMime,
      size: safeSize,
      storageKey,
      createdAt: t,
      updatedAt: t,
    });
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const upload = form.get("file");
    if (!upload || typeof upload.arrayBuffer !== "function") return bad(400, "FILE_REQUIRED");
    return persistUpload({
      name: form.get("name") || upload.name || "file",
      mime: form.get("mime") || upload.type || "application/octet-stream",
      parentId: form.get("parentId"),
      bytes: new Uint8Array(await upload.arrayBuffer()),
      size: Number(upload.size || 0),
    });
  }

  if (contentType.includes("application/json")) {
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

  const rawName = request.headers.get("x-drive-name") || request.headers.get("x-file-name") || "file";
  const rawMime = request.headers.get("x-drive-mime") || request.headers.get("content-type") || "application/octet-stream";
  const rawParentId = request.headers.get("x-drive-parent-id");
  const rawSize = request.headers.get("x-drive-size");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.byteLength) return bad(400, "FILE_REQUIRED");
  return persistUpload({
    name: rawName,
    mime: rawMime,
    parentId: rawParentId,
    bytes,
    size: Number(rawSize || bytes.byteLength || 0),
  });
}
