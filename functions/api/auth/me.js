import { json } from "../_lib/http.js";
import { requireUser } from "../_lib/auth.js";

export async function onRequestGet({ env, request }) {
  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;
  return json({ ok: true, user: u.user });
}
