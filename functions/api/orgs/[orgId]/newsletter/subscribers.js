import { ok, err } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { getDB } from "../../../_bf.js";
import { ensureZkSchema } from "../../../_lib/zkSchema.js";



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

  // ensure additive zk columns exist (encrypted_blob/key_version)
  try {
    await ensureZkSchema(env);
  } catch (_) {
    // ignore
  }

  // Any member can view subscribers in settings (you can tighten this later).
  const auth = await requireOrgRole({ env, request, orgId: orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;
const url = new URL(request.url);
  const wantCsv = (url.searchParams.get("format") || "").toLowerCase() === "csv";

  const r = await db
    .prepare(
      `SELECT id, email, name, created_at, encrypted_blob, key_version
         FROM newsletter_subscribers
        WHERE org_id = ?
        ORDER BY created_at DESC
        LIMIT 5000`
    )
    .bind(orgId)
    .all();

  const rows = Array.isArray(r?.results) ? r.results : [];

  if (!wantCsv) return ok({ subscribers: rows });

  // If the list is ZK-encrypted, exporting decrypted CSV from the server would defeat the point.
  // Export should be done client-side after decrypt.
  if (rows.some((r) => r?.encrypted_blob)) {
    return err(400, "ZK_CSV_EXPORT_DISABLED");
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

export async function onRequestPost(ctx) {
  const { params, env, request } = ctx;
  const orgId = String(params.orgId || "");
  if (!orgId) return err(400, "BAD_ORG_ID");

  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");

  const auth = await requireOrgRole({ env, request, orgId: orgId, minRole: "admin" });
  if (!auth.ok) return auth.resp;

  try {
    await ensureZkSchema(env);
  } catch (_) {}

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const updates = Array.isArray(body?.updates) ? body.updates : [];
  if (updates.length === 0) return ok({ updated: 0 });

  const now = Date.now();
  let n = 0;

  for (const u of updates) {
    const id = String(u?.id || "").trim();
    const blob = u?.encrypted_blob;
    const kv = Number(u?.key_version || u?.keyVersion || 1);
    if (!id || !blob) continue;

    await db
      .prepare(
        "UPDATE newsletter_subscribers SET encrypted_blob = ?, key_version = ?, email = '', name = '' WHERE org_id = ? AND id = ?"
      )
      .bind(String(blob), kv, orgId, id)
      .run();
    n++;
  }

  return ok({ updated: n, updated_at: now });
}