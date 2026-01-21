import { json, bad, now, uuid } from "../_lib/http.js";
import { signJwt } from "../_lib/jwt.js";

async function hashPass(pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pass),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    key,
    256
  );
  const out = new Uint8Array(16 + 32);
  out.set(salt, 0);
  out.set(new Uint8Array(bits), 16);
  return btoa(String.fromCharCode(...out));
}

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const orgName = String(body.orgName || "").trim() || "My Org";

  if (!email || !password) return bad(400, "MISSING_FIELDS");

  const exists = await env.BF_DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (exists) return bad(409, "EMAIL_EXISTS");

  const userId = uuid();
  const passwordHash = await hashPass(password);

  await env.BF_DB.prepare(
    "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?,?,?,?,?)"
  )
    .bind(userId, email, name || "", passwordHash, now())
    .run();

  // bootstrap org + membership
  const orgId = uuid();

  await env.BF_DB.prepare("INSERT INTO orgs (id, name, created_at) VALUES (?,?,?)")
    .bind(orgId, orgName, now())
    .run();

  await env.BF_DB.prepare(
    "INSERT INTO org_memberships (org_id, user_id, role, created_at) VALUES (?,?,?,?)"
  )
    .bind(orgId, userId, "owner", now())
    .run();

  const token = await signJwt(
    env.JWT_SECRET,
    { sub: userId, email, name: name || "" },
    3600 * 24 * 7
  );

  return json({
    ok: true,
    token,
    user: { id: userId, email, name: name || "" },
    org: { id: orgId, name: orgName, role: "owner" }
  });
}
