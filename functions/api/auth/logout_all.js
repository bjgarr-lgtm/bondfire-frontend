import { ok } from "../_lib/http.js";
import { getDb, requireUser } from "../_lib/auth.js";

export async function onRequestPost({ env, request }) {
  const auth = await requireUser(env, request);
  if (!auth.ok) return auth.resp;

  const db = getDb(env);
  await db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").bind(auth.userId).run();

  const headers = new Headers();
  headers.append("set-cookie", "bf_at=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax");
  headers.append("set-cookie", "bf_rt=; Max-Age=0; Path=/api/auth; Secure; HttpOnly; SameSite=Strict");
  return ok({}, { headers });
}
