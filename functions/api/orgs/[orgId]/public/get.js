import { getPublicCfg } from "../../../_lib/publicPageStore.js";

function authOk(env, request) {
  // match save.js behavior
  if (env.BF_WRITE_LOCKED === "true") {
    const auth = request.headers.get("authorization") || "";
    return auth.startsWith("Bearer ");
  }
  return true;
}

export async function onRequestGet({ env, request, params }) {
  if (!authOk(env, request)) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const orgId = params.orgId;
  const cfg = await getPublicCfg(env, orgId);

  // Always return a stable shape so the UI doesn't explode.
  const cleaned = {
    enabled: !!cfg?.enabled,
    newsletter_enabled: !!cfg?.newsletter_enabled,
    pledges_enabled: !!cfg?.pledges_enabled,
    slug: String(cfg?.slug || ""),
    title: String(cfg?.title || ""),
    about: String(cfg?.about || ""),
    features: Array.isArray(cfg?.features) ? cfg.features : [],
    links: Array.isArray(cfg?.links) ? cfg.links : [],
  };

  return Response.json({ ok: true, public: cleaned });
}
