import { json, err } from "../../../../_lib/http.js";
import { getOrgIdBySlug } from "../../../../_lib/public.js";

export async function onRequest(context) {
  const { request, env, params } = context;
  const slug = String(params.slug || "").trim();

  if (request.method !== "POST") return err("METHOD_NOT_ALLOWED", 405);

  const orgId = await getOrgIdBySlug(env, slug);
  if (!orgId) return err("NOT_FOUND", 404);

  const cfgRaw = await env.BF_PUBLIC.get(`org:${orgId}`);
  const cfg = cfgRaw ? JSON.parse(cfgRaw) : {};
  if (!cfg.enabled || !cfg.pledges_enabled) return err("NOT_ENABLED", 403);

  const body = await request.json().catch(() => ({}));

  const now = Date.now();
  const id = crypto.randomUUID();

  const pledger_name = String(body.pledger_name || "").trim();
  const pledger_email = String(body.pledger_email || "").trim();
  const need_id = body.need_id ? String(body.need_id) : null;

  const type = String(body.type || "").trim();
  const amount = String(body.amount || "").trim();
  const unit = String(body.unit || "").trim();
  const note = String(body.note || "").trim();

  if (!pledger_name) return err("MISSING_NAME", 400);

  await env.DB.prepare(
    `INSERT INTO pledges
     (id, org_id, need_id, pledger_name, pledger_email, type, amount, unit, note,
      status, is_public, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'offered', 1, NULL, ?, ?)`
  ).bind(
    id, orgId, need_id,
    pledger_name, pledger_email || null,
    type || null, amount || null, unit || null, note || null,
    now, now
  ).run();

  return json({ ok: true, id });
}
