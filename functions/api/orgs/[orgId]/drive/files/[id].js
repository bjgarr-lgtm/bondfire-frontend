import { bad } from "../../../../_lib/http.js";
import { requireOrgRole } from "../../../../_lib/auth.js";
import { ensureDriveSchema, getDb, normalizeNullableId, json, now, getFileRecord, saveFileBlob, deleteFileBlob } from "../../../../_lib/drive.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const fileId = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;
  const includeData = new URL(request.url).searchParams.get("includeData") === "1";
  const existingMeta = await getFileRecord(env, orgId, fileId, { includeData: includeData });
  if (!existingMeta) return bad(404, "NOT_FOUND");
  return json({ ok: true, file: existingMeta });
}

export async function onRequestPatch({ env, request, params }) {
  const orgId = params.orgId;
  const fileId = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env);
  const db = getDb(env);
  const existing = await db.prepare(`SELECT * FROM drive_files WHERE org_id = ? AND id = ?`).bind(orgId, fileId).first();
  if (!existing) return bad(404, "NOT_FOUND");
  const body = await request.json().catch(() => ({}));
  const encrypted = body.encryptedPayload !== undefined || body.encryptedBlob !== undefined || Number(existing.encrypted || 0) === 1;
  const nextName = encrypted ? "encrypted file" : (body.name === undefined ? existing.name : String(body.name || "file").trim() || "file");
  const nextMime = encrypted ? "application/octet-stream" : (body.mime === undefined ? existing.mime : String(body.mime || "application/octet-stream"));
  const nextSize = body.size === undefined ? Number(existing.size || 0) : Number(body.size || 0);
  const nextParentId = Object.prototype.hasOwnProperty.call(body, "parentId") ? normalizeNullableId(body.parentId) : existing.parent_id || null;
  const nextEncryptedBlob = body.encryptedBlob === undefined ? existing.encrypted_blob || null : String(body.encryptedBlob || "") || null;
  await db.prepare(`UPDATE drive_files SET parent_id = ?, name = ?, mime = ?, size = ?, encrypted = ?, encrypted_blob = ?, updated_at = ? WHERE org_id = ? AND id = ?`).bind(nextParentId, nextName, nextMime, nextSize, encrypted ? 1 : 0, nextEncryptedBlob, now(), orgId, fileId).run();
  if (body.dataUrl !== undefined || body.textContent !== undefined || body.mime !== undefined || body.encryptedPayload !== undefined) {
    await saveFileBlob(env, { orgId, fileId, storageKey: existing.storage_key, mime: nextMime, dataUrl: body.dataUrl === undefined ? (await getFileRecord(env, orgId, fileId, { includeData: true }))?.dataUrl || "" : String(body.dataUrl || ""), textContent: body.textContent === undefined ? (await getFileRecord(env, orgId, fileId, { includeData: true }))?.textContent || "" : String(body.textContent || ""), encryptedPayload: body.encryptedPayload === undefined ? (await getFileRecord(env, orgId, fileId, { includeData: true }))?.encryptedPayload || "" : String(body.encryptedPayload || ""), encrypted });
  }
  const file = await getFileRecord(env, orgId, fileId, { includeData: false });
  return json({ ok: true, file });
}

export async function onRequestDelete({ env, request, params }) {
  const orgId = params.orgId;
  const fileId = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env);
  const db = getDb(env);
  const existing = await db.prepare(`SELECT storage_key FROM drive_files WHERE org_id = ? AND id = ?`).bind(orgId, fileId).first();
  if (!existing) return bad(404, "NOT_FOUND");
  await deleteFileBlob(env, { orgId, fileId, storageKey: existing.storage_key || null });
  await db.prepare(`DELETE FROM drive_files WHERE org_id = ? AND id = ?`).bind(orgId, fileId).run();
  return json({ ok: true, deleted: true, id: fileId });
}
