export async function onRequest(context) {
  const { request, env, params } = context;

  const upstreamBase = (env.BACKEND_URL || "").replace(/\/+$/, "");
  if (!upstreamBase) {
    return new Response("Missing BACKEND_URL", { status: 500 });
  }

  const pathParts = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const upstreamUrl = new URL(`${upstreamBase}/api/${pathParts.join("/")}`);

  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.set("host", upstreamUrl.host);

  const init = {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    redirect: "manual",
  };

  const upstreamResp = await fetch(upstreamUrl.toString(), init);
  const respHeaders = new Headers(upstreamResp.headers);

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: respHeaders,
  });
}
