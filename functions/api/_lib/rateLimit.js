// functions/api/_lib/rateLimit.js
// Tiny D1-backed limiter. If the `rate_limits` table doesn't exist, it no-ops.
// Intended for auth endpoints (login/mfa) to slow brute force.

function ipFromRequest(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function rateLimit(env, request, action, { limit = 10, windowSec = 600 } = {}) {
  const ip = ipFromRequest(request);
  const key = `${action}:${ip}`;

  // Try to touch the table. If it doesn't exist, allow.
  const now = Date.now();
  const resetAt = now + windowSec * 1000;

  try {
    const row = await env.BF_DB.prepare(
      "SELECT count, reset_at FROM rate_limits WHERE key = ?"
    ).bind(key).first();

    if (!row) {
      await env.BF_DB.prepare(
        "INSERT INTO rate_limits (key, count, reset_at) VALUES (?, ?, ?)"
      ).bind(key, 1, resetAt).run();
      return { ok: true, remaining: limit - 1, reset_at: resetAt };
    }

    if (Number(row.reset_at) <= now) {
      await env.BF_DB.prepare(
        "UPDATE rate_limits SET count = ?, reset_at = ? WHERE key = ?"
      ).bind(1, resetAt, key).run();
      return { ok: true, remaining: limit - 1, reset_at: resetAt };
    }

    const count = Number(row.count) + 1;
    if (count > limit) {
      return { ok: false, remaining: 0, reset_at: Number(row.reset_at) };
    }

    await env.BF_DB.prepare(
      "UPDATE rate_limits SET count = ? WHERE key = ?"
    ).bind(count, key).run();

    return { ok: true, remaining: Math.max(0, limit - count), reset_at: Number(row.reset_at) };
  } catch (e) {
    // Likely "no such table: rate_limits" or D1 not bound in preview.
    return { ok: true, remaining: limit, reset_at: resetAt, noop: true };
  }
}
