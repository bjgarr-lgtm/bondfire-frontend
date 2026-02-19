import { bad, ok, readJSON, requireMethod } from "../../../_lib/http.js";
import { getDb, requireUser } from "../../../_lib/auth.js";
import { aesGcmDecrypt, totpVerify } from "../../../_lib/crypto.js";

function parseEnc(value) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof value === "object") return value;
  return null;
}

export async function onRequestPost({ env, request }) {
  const m = requireMethod(request, "POST");
  if (m) return m;

  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");

  const body = await readJSON(request);
  const code = String(body.code || body.totp || "").replace(/\s+/g, "");
  if (!code) return bad(400, "MISSING_CODE");

  try {
    const row = await db
      .prepare("SELECT totp_secret_encrypted, mfa_enabled FROM user_mfa WHERE user_id = ?")
      .bind(String(u.user.sub))
      .first();

    if (!row || !row.mfa_enabled) return bad(400, "MFA_NOT_ENABLED");

    const enc = parseEnc(row.totp_secret_encrypted);
    if (!enc) return bad(400, "MFA_SECRET_CORRUPT");

    const encKey = env.MFA_ENC_KEY || env.JWT_SECRET;
    if (!encKey) return bad(500, "MISSING_MFA_ENC_KEY");

    let secret;
    try {
      secret = await aesGcmDecrypt(enc, encKey);
    } catch (e) {
      return bad(400, "MFA_SECRET_DECRYPT_FAILED");
    }

    const valid = await totpVerify(String(secret || ""), code, { window: 1 });
    if (!valid) return bad(400, "INVALID_MFA_CODE");

    await db
      .prepare(
        "UPDATE user_mfa SET mfa_enabled = 0, totp_secret_encrypted = NULL WHERE user_id = ?"
      )
      .bind(String(u.user.sub))
      .run();

    await db
      .prepare("DELETE FROM user_mfa_recovery_codes WHERE user_id = ?")
      .bind(String(u.user.sub))
      .run();

    await db
      .prepare("DELETE FROM login_mfa_challenges WHERE user_id = ?")
      .bind(String(u.user.sub))
      .run();

    return ok({ disabled: true });
  } catch (e) {
    // Surface a stable error code instead of a Cloudflare 500 HTML page.
    return bad(500, "MFA_DISABLE_FAILED", { message: String(e?.message || e) });
  }
}
