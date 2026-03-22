import { json, bad, now, uuid } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { coerceArray, ensureDriveSchema, getDriveBucket, importDriveFileRecord, normalizeParentId, normalizeString, normalizeTags } from "../../../_lib/drive.js";

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return bad(400, "INVALID_JSON");

  const db = env.BF_DB;
  const bucket = getDriveBucket(env);
  await ensureDriveSchema(db);

  const ts = now();
  const folders = coerceArray(body.folders);
  const notes = coerceArray(body.notes);
  const templates = coerceArray(body.templates);
  const files = coerceArray(body.files);

  for (const item of folders) {
    const id = String(item?.id || uuid());
    await db.prepare(`INSERT OR REPLACE INTO drive_folders (id, org_id, parent_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, orgId, normalizeParentId(item?.parent_id ?? item?.parentId), normalizeString(item?.name || "untitled folder"), Number(item?.created_at || item?.createdAt || ts), Number(item?.updated_at || item?.updatedAt || ts))
      .run();
  }

  for (const item of notes) {
    const id = String(item?.id || uuid());
    await db.prepare(`INSERT OR REPLACE INTO drive_notes (id, org_id, parent_id, title, content, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        orgId,
        normalizeParentId(item?.parent_id ?? item?.parentId),
        normalizeString(item?.title || "untitled"),
        normalizeString(item?.content || item?.body || ""),
        normalizeTags(item?.tags),
        Number(item?.created_at || item?.createdAt || ts),
        Number(item?.updated_at || item?.updatedAt || ts)
      )
      .run();
  }

  for (const item of templates) {
    const id = String(item?.id || uuid());
    await db.prepare(`INSERT OR REPLACE INTO drive_templates (id, org_id, name, title, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        orgId,
        normalizeString(item?.name || "template"),
        normalizeString(item?.title || "untitled"),
        normalizeString(item?.content || item?.body || ""),
        Number(item?.created_at || item?.createdAt || ts),
        Number(item?.updated_at || item?.updatedAt || ts)
      )
      .run();
  }

  for (const item of files) {
    await importDriveFileRecord({ db, bucket, orgId, item, timestamp: ts });
  }

  return json({ ok: true, counts: { folders: folders.length, notes: notes.length, files: files.length, templates: templates.length } });
}
