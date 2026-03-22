import { json, bad, now, uuid } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { decryptDriveValue, encryptDriveValue, ensureDriveSchema, normalizeParentId, normalizeString, normalizeTags, parseTags } from "../../../_lib/drive.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env.BF_DB);
  const rows = await env.BF_DB.prepare(`SELECT id, org_id, parent_id, title, content, tags, created_at, updated_at FROM drive_notes WHERE org_id = ? ORDER BY lower(title) ASC, updated_at DESC`).bind(orgId).all();
  const notes = [];
  for (const row of rows?.results || []) {
    notes.push({ ...row, content: await decryptDriveValue(row.content, env), tags: parseTags(row.tags) });
  }
  return json({ ok: true, notes });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  const body = await request.json().catch(() => ({}));
  const title = normalizeString(body.title || "untitled").trim() || "untitled";
  const content = await encryptDriveValue(normalizeString(body.content || ""), env);
  const parentId = normalizeParentId(body.parent_id ?? body.parentId);
  const tags = normalizeTags(body.tags);
  await ensureDriveSchema(env.BF_DB);
  const id = uuid();
  const t = now();
  await env.BF_DB.prepare(`INSERT INTO drive_notes (id, org_id, parent_id, title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, orgId, parentId, title, content, tags, t, t).run();
  return json({ ok: true, note: { id, org_id: orgId, parent_id: parentId, title, content: await decryptDriveValue(content, env), tags: parseTags(tags), created_at: t, updated_at: t } });
}
