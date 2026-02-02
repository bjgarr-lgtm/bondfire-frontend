import {
  getDB,
  json,
  text,
  bad,
  getUserIdFromRequest,
  requireMemberRole,
  csvEscape,
} from "../../../_bf.js";

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = getDB(env);
  if (!db) return bad("DB_NOT_CONFIGURED", 500);

  const orgId = String(params.orgId || "");

  if (request.method !== "GET") return bad("METHOD_NOT_ALLOWED", 405);

  const userId = getUserIdFromRequest(request);
  const roleCheck = await requireMemberRole(db, orgId, userId, "member");
  if (!roleCheck.ok) return bad(roleCheck.error, roleCheck.status);

  const url = new URL(request.url);
  const format = String(url.searchParams.get("format") || "").toLowerCase();

  const rows = await db
    .prepare(
      `SELECT id, email, name, created_at
       FROM newsletter_subscribers
       WHERE org_id = ?
       ORDER BY created_at DESC`
    )
    .bind(orgId)
    .all();

  const subs = Array.isArray(rows?.results) ? rows.results : [];

  if (format === "csv") {
    const header = ["email", "name", "joined"].join(",") + "\n";
    const body =
      header +
      subs
        .map((s) =>
          [
            csvEscape(s.email || ""),
            csvEscape(s.name || ""),
            csvEscape(s.created_at ? new Date(s.created_at).toISOString() : ""),
          ].join(",")
        )
        .join("\n") +
      "\n";

    return text(body, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="newsletter_subscribers_${orgId}.csv"`,
    });
  }

  return json({ ok: true, subscribers: subs });
}
