import { ok, err } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { getDB } from "../../../_bf.js";

// D1 table expected:
// - newsletter_subscribers(id TEXT PRIMARY KEY, org_id TEXT, email TEXT, name TEXT, created_at INTEGER)

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes("\n") || s.includes("\r") || s.includes(",") || s.includes('"')) {
    return '"' + s.replaceAll('"', '""') + '"';
  }
  return s;
}

export async function onRequestGet(ctx) {
  const { params, env, request } = ctx;
  const orgId = String(params.orgId || "");
  if (!orgId) return err(400, "BAD_ORG_ID");

  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");

  // Any member can view subscribers in settings (you can tighten this later).
  const auth = await requireOrgRole(ctx, orgId, "member");
  if (!auth.ok) return err(auth.status, auth.error);

  const url = new URL(request.url);
  const wantCsv = (url.searchParams.get("format") || "").toLowerCase() === "csv";

  const r = await db.prepare(
    `SELECT id, email, name, created_at
       FROM newsletter_subscribers
      WHERE org_id = ?
      ORDER BY created_at DESC
      LIMIT 5000`
  ).bind(orgId).all();

  const rows = Array.isArray(r?.results) ? r.results : [];

  if (!wantCsv) {
    return ok({ subscribers: rows });
  }

  const header = ["email", "name", "joined"].join(",");
  const lines = rows.map((s) => {
    const joined = s.created_at ? new Date(Number(s.created_at)).toISOString() : "";
    return [csvEscape(s.email), csvEscape(s.name), csvEscape(joined)].join(",");
  });
  const csv = [header, ...lines].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="subscribers-${orgId}.csv"`,
    },
  });
}
