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

async function persistUpload({ env, orgId, id, parentId, name, mime, size, bytes, textContent }) {
  const db = getDb(env);
  const t = now();
  const storageKey = `${orgId}/drive/files/${id}/${encodeURIComponent(name)}`;
  const bucket = getDriveBucket(env);
  let storedInBucket = false;

  if (bucket && bytes && bytes.byteLength) {
    try {
      await bucket.put(storageKey, bytes, { httpMetadata: { contentType: mime || "application/octet-stream" } });
      storedInBucket = true;
    } catch (err) {
      storedInBucket = false;
    }
  }

  if (!storedInBucket) {
    const tooLargeForInline = (bytes?.byteLength || 0) > 4 * 1024 * 1024 && !isEditableTextMime(mime, name);
    if (tooLargeForInline) return { error: bad(500, "FILE_STORAGE_FAILED", { detail: "Drive bucket unavailable for large binary upload" }) };
    const dataUrl = dataUrlFromBytes(bytes || new Uint8Array(), mime || "application/octet-stream");
    await saveFileBlob(env, { orgId, fileId: id, storageKey, mime, dataUrl, textContent: textContent || "" });
  }

  await db.prepare(`INSERT INTO drive_files (id, org_id, parent_id, name, mime, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, orgId, parentId, name, mime, Number(size || bytes?.byteLength || 0), storageKey, t, t).run();

  const createdFile = await getFileRecord(env, orgId, id, { includeData: isEditableTextMime(mime, name) });
  return { file: createdFile || { id, parentId, name, mime, size: Number(size || bytes?.byteLength || 0), storageKey, createdAt: t, updatedAt: t } };
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env);

  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  const id = uuid();
  const headerName = String(request.headers.get("x-drive-name") || "").trim();

  if (headerName) {
    const mime = String(request.headers.get("x-drive-mime") || contentType || "application/octet-stream");
    const parentId = normalizeNullableId(request.headers.get("x-drive-parent-id"));
    const size = Number(request.headers.get("x-drive-size") || 0);
    const bytes = new Uint8Array(await request.arrayBuffer());
    const textContent = isEditableTextMime(mime, headerName) ? textFromBytes(bytes) : "";
    const saved = await persistUpload({ env, orgId, id, parentId, name: headerName, mime, size, bytes, textContent });
    if (saved.error) return saved.error;
    return created("file", saved.file);
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const upload = form.get("file");
    if (!upload || typeof upload.arrayBuffer !== "function") return bad(400, "FILE_REQUIRED");

    const name = String(form.get("name") || upload.name || "file").trim() || "file";
    const mime = String(form.get("mime") || upload.type || "application/octet-stream");
    const parentId = normalizeNullableId(form.get("parentId"));
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const textContent = isEditableTextMime(mime, name) ? (typeof upload.text === "function" ? await upload.text().catch(() => textFromBytes(bytes)) : textFromBytes(bytes)) : "";
    const saved = await persistUpload({ env, orgId, id, parentId, name, mime, size: Number(upload.size || bytes.byteLength || 0), bytes, textContent });
    if (saved.error) return saved.error;
    return created("file", saved.file);
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "file").trim() || "file";
  const mime = String(body.mime || "application/octet-stream");
  const parentId = normalizeNullableId(body.parentId);
  const dataUrl = String(body.dataUrl || "");
  const db = getDb(env);
  const t = now();
  const storageKey = `${orgId}/drive/files/${id}/${encodeURIComponent(name)}`;
  await db.prepare(`INSERT INTO drive_files (id, org_id, parent_id, name, mime, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, orgId, parentId, name, mime, Number(body.size || 0), storageKey, t, t).run();
  await saveFileBlob(env, { orgId, fileId: id, storageKey, mime, dataUrl, textContent: String(body.textContent || "") });
  const createdFile = await getFileRecord(env, orgId, id, { includeData: isEditableTextMime(mime, name) });
  return created("file", createdFile || { id, parentId, name, mime, size: Number(body.size || 0), storageKey, createdAt: t, updatedAt: t });
}
