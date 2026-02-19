import { ok, bad } from "../_lib/http.js";
import { requireUser } from "../_lib/auth.js";

export async function onRequestPost({ env, request }) {
  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;

  const body = await request.json().catch(() => ({}));
  const publicKey = body?.public_key;
  const kid = String(body?.kid || "").trim() || crypto.randomUUID();

  if (!publicKey) return bad(400, "MISSING_PUBLIC_KEY");

  // Expect a JWK object, store as JSON.
  let serialized = "";
  try {
    serialized = JSON.stringify(publicKey);
  } catch {
    return bad(400, "INVALID_PUBLIC_KEY");
  }

  await env.BF_DB.prepare(
    "UPDATE users SET public_key = ? WHERE id = ?"
  ).bind(serialized, String(u.user.sub)).run();

  return ok({ saved: true, kid });
}
