import { bad, ok, readJSON, requireMethod } from "../../_lib/http.js";
import { getDb, requireUser } from "../../_lib/auth.js";
import { aesGcmDecrypt, totpVerify } from "../../_lib/crypto.js";

/**
 * POST /api/auth/mfa/disable
 * Body: { code: "123456" }
 *
 * Disables TOTP MFA for the current user after verifying a valid TOTP code.
 * Clears recovery codes and any pending MFA login challenges for the user.
 */
export async function onRequest(context) {
  try {
    const { request, env } = context;
    requireMethod(request, "POST");

    const body = await readJSON(request);
    const codeRaw = (body?.code ?? "").toString();
    const code = codeRaw.replace(/\s+/g, "");
    if (!/^[0-9]{6}$/.test(code)) return bad("INVALID_MFA_CODE", 400);

    const user = await requireUser(context);
    const db = getDb(env);

    const row = await db
      .prepare(
        "SELECT totp_secret_encrypted, mfa_enabled FROM user_mfa WHERE user_id = ?"
      )
      .bind(user.id)
      .first();

    if (!row || !row.mfa_enabled) return bad("MFA_NOT_ENABLED", 400);

    // Stored as JSON string (preferred) or already-parsed object/string from earlier versions
    let enc = row.totp_secret_encrypted;
    if (!enc) return bad("MFA_SECRET_MISSING", 400);

    // If it's a JSON string, parse it.
    if (typeof enc === "string") {
      try {
        const parsed = JSON.parse(enc);
        enc = parsed;
      } catch {
        // It might be a legacy raw string; keep as-is
      }
    }

    const encKey = env.MFA_ENC_KEY || env.JWT_SECRET;
    if (!encKey) return bad("MFA_ENC_KEY_MISSING", 500);

    let secret;
    try {
      secret = await aesGcmDecrypt(encKey, enc);
    } catch (e) {
      return bad("MFA_SECRET_DECRYPT_FAILED", 400);
    }

    const okTotp = await totpVerify(secret, code, { window: 1 });
    if (!okTotp) return bad("INVALID_MFA_CODE", 400);

    // Disable MFA and wipe recovery codes + pending challenges
    const now = Date.now();
    await db
      .prepare(
        "UPDATE user_mfa SET mfa_enabled = 0, totp_secret_encrypted = NULL WHERE user_id = ?"
      )
      .bind(user.id)
      .run();

    await db
      .prepare("DELETE FROM user_mfa_recovery_codes WHERE user_id = ?")
      .bind(user.id)
      .run();

    await db
      .prepare("DELETE FROM login_mfa_challenges WHERE user_id = ?")
      .bind(user.id)
      .run();

    return ok({ ok: true, disabled_at: now });
  } catch (e) {
    // Avoid leaking internals; return structured error
    return bad("MFA_DISABLE_FAILED", 500);
  }
}
