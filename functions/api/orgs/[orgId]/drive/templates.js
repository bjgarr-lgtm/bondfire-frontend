import { json, bad, now, uuid } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { decryptDriveValue, encryptDriveValue, ensureDriveSchema, normalizeString } from "../../../_lib/drive.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env.BF_DB);
  const rows = await env.BF_DB.prepare(`SELECT id, org_id, name, title, content, created_at, updated_at FROM drive_templates WHERE org_id = ? ORDER BY lower(name) ASC, updated_at DESC`).bind(orgId).all();
  const templates = [];
  for (const row of rows?.results || []) {
    templates.push({ ...row, content: await decryptDriveValue(row.content, env) });
  }
  return json({ ok: true, templates });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  const body = await request.json().catch(() => ({}));
  const name = normalizeString(body.name || "").trim();
  if (!name) return bad(400, "MISSING_NAME");
  const title = normalizeString(body.title || "untitled");
  const content = await encryptDriveValue(normalizeString(body.content || body.body || ""), env);
  await ensureDriveSchema(env.BF_DB);
  const id = uuid();
  const t = now();
  await env.BF_DB.prepare(`INSERT INTO drive_templates (id, org_id, name, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, orgId, name, title, content, t, t).run();
  return json({ ok: true, template: { id, org_id: orgId, name, title, content: await decryptDriveValue(content, env), created_at: t, updated_at: t } });
}
