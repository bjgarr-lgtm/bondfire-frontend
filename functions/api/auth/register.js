import { json, bad, now, uuid } from "../_lib/http.js";
import { issueAccessToken, randomToken, sha256Hex, cookieHeadersForAuth } from "../_lib/session.js";

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


    const user = { id: userId, email, name: name || "" };
    const accessToken = await issueAccessToken(env, user, 60 * 15);
    const refreshToken = randomToken(32);
    const refreshHash = await sha256Hex(refreshToken);
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;

    await env.BF_DB.prepare(
      "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), userId, refreshHash, expiresAt).run();

    const isProd = (env?.ENV || env?.NODE_ENV || "").toLowerCase() === "production";
    const setCookies = cookieHeadersForAuth({ accessToken, refreshToken, isProd });

    const resp = json({
      ok: true,
      user,
      org: { id: orgId, name: orgName, role: "owner" },
    });
    for (const c of setCookies) resp.headers.append("set-cookie", c);
    return resp;
  } catch (e) {
    console.error("REGISTER_THROW", e);
    const msg = e?.message ? String(e.message) : "REGISTER_FAILED";
    return bad(500, msg);
  }
}
