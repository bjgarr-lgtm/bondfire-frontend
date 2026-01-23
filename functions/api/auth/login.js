import { json, bad } from "../_lib/http.js";
import { signJwt } from "../_lib/jwt.js";

function fromB64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyPass(pass, stored) {
  const raw = fromB64(stored);
  const salt = raw.slice(0, 16);
  const expected = raw.slice(16);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pass),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  const got = new Uint8Array(bits);

  if (got.length !== expected.length) return false;
  for (let i = 0; i < got.length; i++) if (got[i] !== expected[i]) return false;
  return true;
}

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  const user = await env.BF_DB.prepare(
    "SELECT id, email, name, password_hash FROM users WHERE email = ?"
  ).bind(email).first();

  if (!user) return bad(401, "INVALID_LOGIN");

  const ok = await verifyPass(password, user.password_hash);
  if (!ok) return bad(401, "INVALID_LOGIN");

  const token = await signJwt(env.JWT_SECRET, { sub: user.id, email: user.email, name: user.name }, 3600 * 24 * 7);
  return json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name } });
}
