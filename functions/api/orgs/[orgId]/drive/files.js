import { json, bad, now, uuid } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { buildDriveStorageKey, ensureDriveSchema, getDriveBucket, normalizeParentId, normalizeString, putDriveFileObject } from "../../../_lib/drive.js";

async function readUploadPayload(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") return null;
    return {
      name: String(form.get("name") || file.name || "upload.bin"),
      mime: String(file.type || form.get("mime") || "application/octet-stream"),
      parentId: form.get("parent_id") || form.get("parentId") || null,
      bytes: new Uint8Array(await file.arrayBuffer()),
      size: Number(file.size || 0),
    };
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return null;
  const base64 = String(body.base64 || "");
  const bytes = base64 ? Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)) : new TextEncoder().encode(String(body.textContent || ""));
  return {
    name: normalizeString(body.name || "upload.bin"),
    mime: normalizeString(body.mime || "application/octet-stream"),
    parentId: body.parent_id ?? body.parentId ?? null,
    bytes,
    size: Number(body.size || bytes.byteLength || 0),
  };
}

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env.BF_DB);
  const rows = await env.BF_DB.prepare(`SELECT id, org_id, parent_id, name, mime, size, storage_key, created_at, updated_at FROM drive_files WHERE org_id = ? ORDER BY lower(name) ASC, updated_at DESC`).bind(orgId).all();
  return json({ ok: true, files: rows?.results || [] });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env.BF_DB);
  const payload = await readUploadPayload(request);
  if (!payload?.name || !payload?.bytes) return bad(400, "INVALID_UPLOAD");
  const bucket = getDriveBucket(env);
  if (!bucket) return bad(500, "NO_DRIVE_BUCKET_BINDING");

  const id = uuid();
  const t = now();
  const parentId = normalizeParentId(payload.parentId);
  const name = normalizeString(payload.name || "upload.bin");
  const mime = normalizeString(payload.mime || "application/octet-stream");
  const storageKey = buildDriveStorageKey({ orgId, fileId: id, name });

  await putDriveFileObject(bucket, storageKey, payload.bytes, { httpMetadata: { contentType: mime } });
  await env.BF_DB.prepare(`INSERT INTO drive_files (id, org_id, parent_id, name, mime, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, orgId, parentId, name, mime, Number(payload.size || payload.bytes.byteLength || 0), storageKey, t, t).run();

  return json({ ok: true, file: { id, org_id: orgId, parent_id: parentId, name, mime, size: Number(payload.size || payload.bytes.byteLength || 0), storage_key: storageKey, created_at: t, updated_at: t } });
}
