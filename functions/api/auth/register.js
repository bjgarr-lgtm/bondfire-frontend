import { json, bad, now, uuid } from "../_lib/http.js";
import { signJwt } from "../_lib/jwt.js";
import { sha256Hex } from "../_lib/crypto.js";

const PBKDF2_ITERS = 100000;

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
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    key,
    256
  );
  const out = new Uint8Array(16 + 32);
  out.set(salt, 0);
  out.set(new Uint8Array(bits), 16);
  return btoa(String.fromCharCode(...out));
}

export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    const orgName = String(body.orgName || "").trim() || "My Org";

    if (!email || !password) return bad(400, "MISSING_FIELDS");
    if (!env.BF_DB) return bad(500, "BF_DB_MISSING");
    if (!env.JWT_SECRET) return bad(500, "JWT_SECRET_MISSING");

    const exists = await env.BF_DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();
    if (exists) return bad(409, "EMAIL_EXISTS");

    const userId = uuid();
    const orgId = uuid();
    const t = now();
    const passwordHash = await hashPass(password);

    // Create user + org + membership as one batch (prevents partial state)
    try {
      await env.BF_DB.batch([
        env.BF_DB.prepare(
          "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?,?,?,?,?)"
        ).bind(userId, email, name || "", passwordHash, t),

        env.BF_DB.prepare(
          "INSERT INTO orgs (id, name, created_at) VALUES (?,?,?)"
        ).bind(orgId, orgName, t),

        env.BF_DB.prepare(
          "INSERT INTO org_memberships (org_id, user_id, role, created_at) VALUES (?,?,?,?)"
        ).bind(orgId, userId, "owner", t),
      ]);
    } catch (e) {
      console.error("REGISTER_BATCH_FAILED", e);
      const msg = e?.message ? String(e.message) : "REGISTER_FAILED";
      return bad(500, msg);
    }


    const token = await signJwt(
      env.JWT_SECRET,
      { sub: userId, email, name: name || "" },
      3600 * 24 * 7
    );

    return json({
      ok: true,
      token,
      user: { id: userId, email, name: name || "" },
      org: { id: orgId, name: orgName, role: "owner" },
    });
  } catch (e) {
    console.error("REGISTER_THROW", e);
    const msg = e?.message ? String(e.message) : "REGISTER_FAILED";
    return bad(500, msg);
  }
}function makeRefreshToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return `${crypto.randomUUID()}.${s}`;
}

async function setSessionCookies(env, user) {
  const accessTtl = 60 * 15; // 15 minutes
  const refreshTtl = 60 * 60 * 24 * 30; // 30 days

  const at = await signJwt(env.JWT_SECRET, { sub: user.id, email: user.email, name: user.name }, accessTtl);

  const rt = makeRefreshToken();
  const rtHash = await sha256Hex(`${env.JWT_SECRET}:${rt}`);
  const expiresAt = Date.now() + refreshTtl * 1000;

  await env.BF_DB.prepare(
    "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), user.id, rtHash, expiresAt).run();

  const headers = new Headers();
  headers.append("set-cookie", cookie("bf_at", at, { httpOnly: true, sameSite: "Lax", path: "/", maxAge: accessTtl }));
  headers.append("set-cookie", cookie("bf_rt", rt, { httpOnly: true, sameSite: "Strict", path: "/api/auth", maxAge: refreshTtl }));
  return { headers, accessToken: at };
}

