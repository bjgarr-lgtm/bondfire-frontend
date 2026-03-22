import { bad } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { ensureDriveSchema, getDb, getDriveBucket, normalizeNullableId, created, json, now, uuid, saveFileBlob, getFileRecord, isEditableTextMime, dataUrlFromBytes, textFromBytes } from "../../../_lib/drive.js";

function mapRow(row) {
  return {
    id: row.id,
    parentId: row.parent_id || null,
    name: row.name || "file",
    mime: row.mime || "application/octet-stream",
    size: Number(row.size || 0),
    storageKey: row.storage_key || null,
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

async function persistUpload(env, { orgId, fileId, name, mime, bytes, textContent }) {
  const storageKey = `${orgId}/drive/files/${fileId}/${encodeURIComponent(name)}`;
  const bucket = getDriveBucket(env);
  const size = Number(bytes?.byteLength || 0);
  let savedToBucket = false;

  if (bucket && storageKey) {
    await bucket.put(storageKey, bytes, {
      httpMetadata: { contentType: mime || "application/octet-stream" },
    });
    savedToBucket = true;
  }

  if (!savedToBucket) {
    const tooLargeForInline = size > 4 * 1024 * 1024 && !isEditableTextMime(mime, name);
    if (tooLargeForInline) {
      throw bad(500, "FILE_STORAGE_FAILED", { detail: "Drive bucket unavailable for large binary upload" });
    }
    const dataUrl = dataUrlFromBytes(bytes, mime || "application/octet-stream");
    await saveFileBlob(env, {
      orgId,
      fileId,
      storageKey,
      mime,
      dataUrl,
      textContent: textContent || "",
    });
  }

  return { storageKey, size };
}

async function insertFileRow(env, { orgId, id, parentId, name, mime, size, storageKey, createdAt }) {
  const db = getDb(env);
  await db.prepare(`INSERT INTO drive_files (id, org_id, parent_id, name, mime, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, orgId, parentId, name, mime, size, storageKey, createdAt, createdAt)
    .run();
  return getFileRecord(env, orgId, id, { includeData: isEditableTextMime(mime, name) });
}

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env);
  const res = await getDb(env).prepare(`SELECT id, parent_id, name, mime, size, storage_key, created_at, updated_at FROM drive_files WHERE org_id = ? ORDER BY LOWER(name) ASC`).bind(orgId).all();
  return json({ ok: true, files: (res.results || []).map(mapRow) });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env);

  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  const id = uuid();
  const t = now();

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const upload = form.get("file");
    if (!upload || typeof upload.arrayBuffer !== "function") return bad(400, "FILE_REQUIRED");

    const name = String(form.get("name") || upload.name || "file").trim() || "file";
    const mime = String(form.get("mime") || upload.type || "application/octet-stream");
    const parentId = normalizeNullableId(form.get("parentId"));
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const textContent = isEditableTextMime(mime, name) ? textFromBytes(bytes) : "";
    const saved = await persistUpload(env, { orgId, fileId: id, name, mime, bytes, textContent });
    const createdFile = await insertFileRow(env, { orgId, id, parentId, name, mime, size: saved.size, storageKey: saved.storageKey, createdAt: t });
    return created("file", createdFile || { id, parentId, name, mime, size: saved.size, storageKey: saved.storageKey, createdAt: t, updatedAt: t });
  }

  if (!contentType.includes("application/json")) {
    const name = String(request.headers.get("x-drive-name") || "file").trim() || "file";
    const mime = String(request.headers.get("x-drive-mime") || contentType || "application/octet-stream");
    const parentId = normalizeNullableId(request.headers.get("x-drive-parent-id"));
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.byteLength) return bad(400, "FILE_REQUIRED");
    const textContent = isEditableTextMime(mime, name) ? textFromBytes(bytes) : "";
    const saved = await persistUpload(env, { orgId, fileId: id, name, mime, bytes, textContent });
    const createdFile = await insertFileRow(env, { orgId, id, parentId, name, mime, size: saved.size, storageKey: saved.storageKey, createdAt: t });
    return created("file", createdFile || { id, parentId, name, mime, size: saved.size, storageKey: saved.storageKey, createdAt: t, updatedAt: t });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "file").trim() || "file";
  const mime = String(body.mime || "application/octet-stream");
  const parentId = normalizeNullableId(body.parentId);
  const textContent = String(body.textContent || "");
  const dataUrl = String(body.dataUrl || "");
  if (!dataUrl && !textContent) return bad(400, "FILE_REQUIRED");

  const storageKey = `${orgId}/drive/files/${id}/${encodeURIComponent(name)}`;
  await saveFileBlob(env, { orgId, fileId: id, storageKey, mime, dataUrl, textContent });
  const size = Number(body.size || 0);
  const createdFile = await insertFileRow(env, { orgId, id, parentId, name, mime, size, storageKey, createdAt: t });
  return created("file", createdFile || { id, parentId, name, mime, size, storageKey, createdAt: t, updatedAt: t });
}
