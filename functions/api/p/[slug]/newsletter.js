import { json, err, readJSON, requireMethod } from "../../../_lib/http.js"; 
import { getOrgIdBySlug } from "../../../_lib/public.js"; 

export async function onRequest(context) {
  const { request, env, params } = context;
  const slug = String(params.slug || "").trim();

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();

    if (!email || !email.includes("@")) return err("INVALID_EMAIL", 400);

    const orgId = await getOrgIdBySlug(env, slug);
    if (!orgId) return err("NOT_FOUND", 404);

    const cfgRaw = await env.BF_PUBLIC.get(`org:${orgId}`);
    const cfg = cfgRaw ? JSON.parse(cfgRaw) : {};
    if (!cfg.enabled || !cfg.newsletter_enabled) return err("NOT_ENABLED", 403);

    const now = Date.now();
    const id = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT OR IGNORE INTO newsletter_subscribers (id, org_id, email, name, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, orgId, email, name || null, now).run();

    return json({ ok: true });
  }

  return err("METHOD_NOT_ALLOWED", 405);
}
