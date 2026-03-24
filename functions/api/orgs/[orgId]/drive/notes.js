import { requireOrgRole } from "../../../_lib/auth.js";
import { ensureDriveSchema, getDb, normalizeNullableId, parseTags, created, json, now, uuid } from "../../../_lib/drive.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env);
  const res = await getDb(env).prepare(`SELECT id, parent_id, title, content, tags, encrypted_blob, created_at, updated_at FROM drive_notes WHERE org_id = ? ORDER BY updated_at DESC`).bind(orgId).all();
  return json({ ok: true, notes: (res.results || []).map((row) => ({ id: row.id, parentId: row.parent_id || null, title: row.encrypted_blob ? "encrypted note" : row.title || "untitled", body: row.encrypted_blob ? "" : row.content || "", tags: row.encrypted_blob ? [] : parseTags(row.tags), encryptedBlob: row.encrypted_blob || "", createdAt: Number(row.created_at || 0), updatedAt: Number(row.updated_at || 0) })) });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env);
  const body = await request.json().catch(() => ({}));
  const id = uuid();
  const t = now();
  const note = { id, parentId: normalizeNullableId(body.parentId), title: String(body.title || "untitled").trim() || "untitled", body: String(body.body || body.content || ""), tags: parseTags(body.tags), encryptedBlob: String(body.encryptedBlob || ""), createdAt: t, updatedAt: t };
  await getDb(env).prepare(`INSERT INTO drive_notes (id, org_id, parent_id, title, content, tags, encrypted_blob, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, orgId, note.parentId, note.encryptedBlob ? "encrypted note" : note.title, note.encryptedBlob ? "" : note.body, note.encryptedBlob ? "" : note.tags.join(","), note.encryptedBlob || null, t, t).run();
  return created("note", note);
}
