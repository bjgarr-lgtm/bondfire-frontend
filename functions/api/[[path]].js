export async function onRequest(context) {
  const { request, env, params } = context;

  const upstreamBase = (env.BACKEND_URL || "").replace(/\/+$/, "");
  if (!upstreamBase) {
    return new Response("BACKEND_URL is not set.", { status: 500 });
  }

  // In Cloudflare Pages Functions, [[path]] returns an array of segments (or undefined)
  // for multi-depth matches. :contentReference[oaicite:2]{index=2}
  const segs = Array.isArray(params.path)
    ? params.path
    : (typeof params.path === "string" ? [params.path] : []);

  const upstreamUrl = new URL(`${upstreamBase}/api/${segs.join("/")}`);

  // Preserve query string
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.set("host", upstreamUrl.host);

  const init = {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer(),
    redirect: "manual",
  };

  const upstreamResp = await fetch(upstreamUrl.toString(), init);

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: upstreamResp.headers,
  });
}
