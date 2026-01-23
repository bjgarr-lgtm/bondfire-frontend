export async function onRequest(context) {
  const { request, env, params } = context;

  const url = new URL(request.url);
  const segments = Array.isArray(params?.path) ? params.path : (params?.path ? [params.path] : []);

  // Local invite codes (KV backed)
  // Route: /api/orgs/:orgId/invites  (GET, POST)
  // This lets the frontend create and list invite codes without requiring changes in the upstream backend.
  // Requires a KV binding named BF_INVITES (Cloudflare Pages -> Settings -> Functions -> KV bindings).
  if (segments.length === 3 && segments[0] === "orgs" && segments[2] === "invites") {
    const orgId = decodeURIComponent(segments[1] || "");
    const kv = env.BF_INVITES;

    if (!kv) {
      return json({ ok: false, error: "Invite storage not configured (BF_INVITES KV binding missing)." }, 500);
    }

    const key = `org:${orgId}:invites`;
    const now = Date.now();

    if (request.method === "GET") {
      const raw = await kv.get(key);
      const invites = raw ? safeJson(raw, []) : [];
      // prune expired
      const pruned = invites.filter((i) => !i.expires_at || i.expires_at > now);
      if (pruned.length !== invites.length) await kv.put(key, JSON.stringify(pruned));
      return json({ ok: true, invites: pruned });
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const role = (body?.role || "member").toString();
      const expiresInDays = clampInt(body?.expiresInDays, 14, 1, 365);
      const maxUses = clampInt(body?.maxUses, 1, 1, 100);

      const raw = await kv.get(key);
      const invites = raw ? safeJson(raw, []) : [];

      const code = makeCode();
      const invite = {
        code,
        role,
        uses: 0,
        max_uses: maxUses,
        expires_at: now + expiresInDays * 24 * 60 * 60 * 1000,
        created_at: now,
      };

      invites.unshift(invite);
      await kv.put(key, JSON.stringify(invites));
      return json({ ok: true, invite });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const upstreamBase = (env.BACKEND_URL || "").replace(/\/+$/, "");
  if (!upstreamBase) {
    return new Response("BACKEND_URL is not set.", { status: 500 });
  }

  const upstreamUrl = new URL(upstreamBase + "/api/" + segments.map(encodeURIComponent).join("/"));

  // Copy query string
  upstreamUrl.search = url.search;

  // Forward headers (strip host)
  const headers = new Headers(request.headers);
  headers.delete("host");

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
  };

  const res = await fetch(upstreamUrl.toString(), init);
  const outHeaders = new Headers(res.headers);

  // CORS for local dev
  outHeaders.set("Access-Control-Allow-Origin", "*");
  outHeaders.set("Access-Control-Allow-Headers", "authorization, content-type");
  outHeaders.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: outHeaders });
  }

  return new Response(res.body, { status: res.status, headers: outHeaders });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
  });
}

function safeJson(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

function clampInt(v, def, min, max) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function makeCode() {
  // short, human pasteable, no ambiguous chars
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
