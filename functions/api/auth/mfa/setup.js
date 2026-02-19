import { ok, bad } from "../../_lib/http.js";
import { requireUser } from "../../_lib/auth.js";
import { randomBase32, aesGcmEncrypt } from "../../_lib/crypto.js";

export async function onRequestPost({ env, request }) {
  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;

  const userId = String(u.user.sub);
  const issuer = String(env.TOTP_ISSUER || "Bondfire");

  const secret = randomBase32(20);
  const encKey = env.MFA_ENC_KEY || env.JWT_SECRET;
  const enc = await aesGcmEncrypt(encKey, secret);

  // Upsert row; keep disabled until confirmed.
  await env.BF_DB.prepare(
    "INSERT INTO user_mfa (user_id, totp_secret_encrypted, mfa_enabled, created_at) VALUES (?, ?, 0, ?) " +
      "ON CONFLICT(user_id) DO UPDATE SET totp_secret_encrypted = excluded.totp_secret_encrypted, mfa_enabled = 0"
  ).bind(userId, enc, Date.now()).run();

  const email = String(u.user.email || "");
  const label = encodeURIComponent(email || userId);
  const iss = encodeURIComponent(issuer);
  const uri = `otpauth://totp/${iss}:${label}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;

  // The secret is included so the client can render a QR code.
  return ok({ uri, secret });
}
