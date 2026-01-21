import { slugify, uniqueSlug, getPublicCfg, setPublicCfg, setSlugMapping, removeSlugMapping } from "../../../_lib/publicPageStore.js";

function authOk(env, request) {
  // Temporary: allow until you wire real auth.
  // Set BF_WRITE_LOCKED="true" later to require an auth header.
  if (env.BF_WRITE_LOCKED === "true") {
    const auth = request.headers.get("authorization") || "";
    return auth.startsWith("Bearer ");
  }
  return true;
}

export async function onRequestPost({ env, request, params }) {
  if (!authOk(env, request)) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const orgId = params.orgId;

  const prev = await getPublicCfg(env, orgId);
  const base = slugify(prev.title) || slugify(orgId) || "org";
  const final = await uniqueSlug(env, base, orgId);

  if (prev.slug) {
    const mapped = await env.BF_PUBLIC.get(`slug:${prev.slug}`);
    if (mapped === orgId) await removeSlugMapping(env, prev.slug);
  }

  await setSlugMapping(env, final, orgId);

  const saved = { ...prev, slug: final };
  await setPublicCfg(env, orgId, saved);

  return Response.json({ ok: true, public: saved });
}
