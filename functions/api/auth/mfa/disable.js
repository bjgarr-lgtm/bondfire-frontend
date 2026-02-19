import { ok, bad } from "../../_lib/http.js";
import { requireUser } from "../../_lib/auth.js";
import { aesGcmDecrypt, totpVerify } from "../../_lib/crypto.js";

export async function onRequestPost({ env, request }) {
  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;

  const body = await request.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  if (!code) return bad(400, "MISSING_CODE");

  const userId = String(u.user.sub);
  const mfa = await env.BF_DB.prepare(
    "SELECT totp_secret_encrypted, mfa_enabled FROM user_mfa WHERE user_id = ?"
  ).bind(userId).first();

  if (!mfa || Number(mfa.mfa_enabled) !== 1) return bad(400, "MFA_NOT_ENABLED");

  const encKey = env.MFA_ENC_KEY || env.JWT_SECRET;
  const secret = await aesGcmDecrypt(encKey, mfa.totp_secret_encrypted);
  const okTotp = await totpVerify({ secretBase32: secret, code, window: 1, step: 30, digits: 6 });
  if (!okTotp) return bad(401, "INVALID_MFA");

  await env.BF_DB.prepare(
    "UPDATE user_mfa SET mfa_enabled = 0 WHERE user_id = ?"
  ).bind(userId).run();
  await env.BF_DB.prepare(
    "DELETE FROM user_mfa_recovery_codes WHERE user_id = ?"
  ).bind(userId).run();

  return ok({ disabled: true });
}
