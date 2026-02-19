import { json, bad } from "../../_lib/http.js";
import { signJwt } from "../../_lib/jwt.js";
import { aesGcmDecrypt, totpVerify, sha256Hex } from "../../_lib/crypto.js";
import { rateLimit } from "../../_lib/rateLimit.js";

export async function onRequestPost({ env, request }) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  const body = await request.json().catch(() => ({}));
  const challengeId = String(body.challenge_id || "").trim();
  const code = String(body.code || "").trim();
  const recoveryCode = String(body.recovery_code || "").trim();

  if (!challengeId) return bad(400, "MISSING_CHALLENGE");

  const rl = await rateLimit({ env, key: `mfa:${ip}:${challengeId}`, limit: 12, windowSec: 600 });
  if (!rl.ok) return bad(429, "RATE_LIMIT", { retry_after: rl.retry_after });

  const ch = await env.BF_DB.prepare(
    "SELECT id, user_id, expires_at, verified FROM login_mfa_challenges WHERE id = ?"
  ).bind(challengeId).first();

  if (!ch) return bad(401, "INVALID_CHALLENGE");
  if (Number(ch.verified) === 1) return bad(401, "CHALLENGE_USED");
  if (Number(ch.expires_at) < Date.now()) return bad(401, "CHALLENGE_EXPIRED");

  const mfa = await env.BF_DB.prepare(
    "SELECT totp_secret_encrypted, mfa_enabled FROM user_mfa WHERE user_id = ?"
  ).bind(ch.user_id).first();

  if (!mfa || Number(mfa.mfa_enabled) !== 1) return bad(401, "MFA_NOT_ENABLED");

  let ok = false;

  // Recovery code path
  if (recoveryCode) {
    const h = await sha256Hex(recoveryCode);
    const row = await env.BF_DB.prepare(
      "SELECT id, used FROM user_mfa_recovery_codes WHERE user_id = ? AND code_hash = ?"
    ).bind(ch.user_id, h).first();
    if (row && Number(row.used) === 0) {
      await env.BF_DB.prepare(
        "UPDATE user_mfa_recovery_codes SET used = 1 WHERE id = ?"
      ).bind(row.id).run();
      ok = true;
    }
  }

  // TOTP path
  if (!ok) {
    if (!code) return bad(400, "MISSING_CODE");
    const encKey = env.MFA_ENC_KEY || env.JWT_SECRET;
    const secret = await aesGcmDecrypt(encKey, mfa.totp_secret_encrypted);
    ok = await totpVerify({ secretBase32: secret, code, window: 1, step: 30, digits: 6 });
  }

  if (!ok) return bad(401, "INVALID_MFA");

  await env.BF_DB.prepare(
    "UPDATE login_mfa_challenges SET verified = 1 WHERE id = ?"
  ).bind(challengeId).run();

  const user = await env.BF_DB.prepare(
    "SELECT id, email, name FROM users WHERE id = ?"
  ).bind(ch.user_id).first();

  if (!user) return bad(401, "INVALID_LOGIN");

  const token = await signJwt(
    env.JWT_SECRET,
    { sub: user.id, email: user.email, name: user.name },
    3600 * 24 * 7
  );

  return json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name } });
}
