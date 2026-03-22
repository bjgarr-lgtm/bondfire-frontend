import { json, bad, now } from "../../../../_lib/http.js";
import { requireOrgRole } from "../../../../_lib/auth.js";
import { decryptDriveValue, encryptDriveValue, ensureDriveSchema, normalizeString } from "../../../../_lib/drive.js";

export async function onRequestPatch({ env, request, params }) {
  const orgId = params.orgId;
  const id = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  const body = await request.json().catch(() => ({}));
  await ensureDriveSchema(env.BF_DB);
  const existing = await env.BF_DB.prepare(`SELECT id, name, title, content, created_at FROM drive_templates WHERE org_id = ? AND id = ?`).bind(orgId, id).first();
  if (!existing) return bad(404, "NOT_FOUND");
  const name = body.name === undefined ? existing.name : normalizeString(body.name).trim();
  if (!name) return bad(400, "MISSING_NAME");
  const title = body.title === undefined ? existing.title : normalizeString(body.title);
  const content = body.content === undefined && body.body === undefined ? existing.content : await encryptDriveValue(normalizeString(body.content ?? body.body), env);
  const updatedAt = now();
  await env.BF_DB.prepare(`UPDATE drive_templates SET name = ?, title = ?, content = ?, updated_at = ? WHERE org_id = ? AND id = ?`).bind(name, title, content, updatedAt, orgId, id).run();
  return json({ ok: true, template: { id, org_id: orgId, name, title, content: await decryptDriveValue(content, env), created_at: existing.created_at, updated_at: updatedAt } });
}

export async function onRequestDelete({ env, request, params }) {
  const orgId = params.orgId;
  const id = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env.BF_DB);
  await env.BF_DB.prepare(`DELETE FROM drive_templates WHERE org_id = ? AND id = ?`).bind(orgId, id).run();
  return json({ ok: true });
}
