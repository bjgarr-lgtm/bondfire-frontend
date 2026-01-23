export function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function uniqueSlug(env, base, orgId) {
  let trySlug = base || "org";
  let n = 0;

  while (true) {
    const existingOrgId = await env.BF_PUBLIC.get(`slug:${trySlug}`);
    if (!existingOrgId || existingOrgId === orgId) return trySlug;
    n += 1;
    trySlug = `${base}-${n}`;
  }
}

export async function getPublicCfg(env, orgId) {
  const raw = await env.BF_PUBLIC.get(`org:${orgId}`);
  return raw ? JSON.parse(raw) : {};
}

export async function setPublicCfg(env, orgId, cfg) {
  await env.BF_PUBLIC.put(`org:${orgId}`, JSON.stringify(cfg));
}

export async function setSlugMapping(env, slug, orgId) {
  await env.BF_PUBLIC.put(`slug:${slug}`, orgId);
}

export async function removeSlugMapping(env, slug) {
  await env.BF_PUBLIC.delete(`slug:${slug}`);
}
