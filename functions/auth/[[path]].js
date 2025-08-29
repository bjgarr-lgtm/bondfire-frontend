export async function onRequest(context) {
  const { request, env } = context;

  // Build target URL to your Worker
  const incoming = new URL(request.url);
  const target = new URL(env.BACKEND_URL + incoming.pathname + incoming.search);

  // Copy headers, drop Host
  const headers = new Headers(request.headers);
  headers.delete("host");

  // Forward body for non-GET/HEAD
  const init = {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.arrayBuffer(),
  };

  const resp = await fetch(target.toString(), init);

  // Pass-through response (status + headers + body)
  return new Response(resp.body, {
    status: resp.status,
    headers: resp.headers,
  });
}
