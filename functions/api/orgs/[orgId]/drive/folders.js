import { json, bad, now, uuid } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { ensureDriveSchema, normalizeParentId, normalizeString } from "../../../_lib/drive.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env.BF_DB);
  const rows = await env.BF_DB.prepare(`SELECT id, org_id, parent_id, name, created_at, updated_at FROM drive_folders WHERE org_id = ? ORDER BY lower(name) ASC, created_at ASC`).bind(orgId).all();
  return json({ ok: true, folders: rows?.results || [] });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  const body = await request.json().catch(() => ({}));
  const name = normalizeString(body.name || "").trim();
  if (!name) return bad(400, "MISSING_NAME");
  await ensureDriveSchema(env.BF_DB);
  const id = uuid();
  const t = now();
  await env.BF_DB.prepare(`INSERT INTO drive_folders (id, org_id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, orgId, normalizeParentId(body.parent_id ?? body.parentId), name, t, t).run();
  return json({ ok: true, folder: { id, org_id: orgId, parent_id: normalizeParentId(body.parent_id ?? body.parentId), name, created_at: t, updated_at: t } });
}
