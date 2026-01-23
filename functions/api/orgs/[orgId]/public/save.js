import { slugify, uniqueSlug, getPublicCfg, setPublicCfg, setSlugMapping, removeSlugMapping } from "../../../_lib/publicPageStore.js";

function authOk(env, request) {
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
  const body = await request.json().catch(() => ({}));

  const { enabled, title, about, features, links, slug } = body || {};

  const prev = await getPublicCfg(env, orgId);
  let newSlug = prev.slug;

  if (typeof slug === "string" && slug.trim()) {
    const base = slugify(slug);
    if (!base) return Response.json({ ok: false, error: "BAD_SLUG" }, { status: 400 });

    if (prev.slug) {
      const mapped = await env.BF_PUBLIC.get(`slug:${prev.slug}`);
      if (mapped === orgId) await removeSlugMapping(env, prev.slug);
    }

    const final = await uniqueSlug(env, base, orgId);
    await setSlugMapping(env, final, orgId);
    newSlug = final;
  } else if (!prev.slug) {
    const base = slugify(title) || slugify(orgId) || "org";
    const final = await uniqueSlug(env, base, orgId);
    await setSlugMapping(env, final, orgId);
    newSlug = final;
  }

  const cleaned = {
    enabled: !!enabled,
    slug: newSlug,
    title: (title || "").trim(),
    about: (about || "").trim(),
    features: Array.isArray(features) ? features.filter(Boolean).slice(0, 50) : [],
    links: Array.isArray(links) ? links.filter((l) => l && l.text && l.url).slice(0, 20) : [],
  };

  await setPublicCfg(env, orgId, cleaned);

  return Response.json({ ok: true, public: cleaned });
}
