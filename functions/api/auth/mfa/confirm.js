import { ok, bad } from "../../_lib/http.js";
import { requireUser } from "../../_lib/auth.js";
import { aesGcmDecrypt, totpVerify, sha256Hex } from "../../_lib/crypto.js";

function randomCode() {
  // 12 chars: human-ish but still strong enough for backup codes.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid ambiguous chars
  const raw = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (let i = 0; i < raw.length; i++) out += alphabet[raw[i] % alphabet.length];
  return out;
}

export async function onRequestPost({ env, request }) {
  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;

  const body = await request.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  if (!code) return bad(400, "MISSING_CODE");

  const userId = String(u.user.sub);
  const mfa = await env.BF_DB.prepare(
    "SELECT totp_secret_encrypted FROM user_mfa WHERE user_id = ?"
  ).bind(userId).first();
  if (!mfa?.totp_secret_encrypted) return bad(400, "MFA_NOT_SETUP");

  const encKey = env.MFA_ENC_KEY || env.JWT_SECRET;
  const secret = await aesGcmDecrypt(encKey, mfa.totp_secret_encrypted);
  const okTotp = await totpVerify({ secretBase32: secret, code, window: 1, step: 30, digits: 6 });
  if (!okTotp) return bad(401, "INVALID_MFA");

  await env.BF_DB.prepare(
    "UPDATE user_mfa SET mfa_enabled = 1 WHERE user_id = ?"
  ).bind(userId).run();

  // Generate and persist recovery codes (hashed). Return the plaintext once.
  const codes = [];
  for (let i = 0; i < 10; i++) codes.push(randomCode());

  const now = Date.now();
  for (const c of codes) {
    const id = crypto.randomUUID();
    const h = await sha256Hex(c);
    await env.BF_DB.prepare(
      "INSERT INTO user_mfa_recovery_codes (id, user_id, code_hash, used, created_at) VALUES (?, ?, ?, 0, ?)"
    ).bind(id, userId, h, now).run();
  }

  return ok({ recovery_codes: codes });
}
