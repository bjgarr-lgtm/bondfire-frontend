import { ok, bad, readJSON, now } from "../../../../_lib/http.js";
import { getDb, requireOrgRole } from "../../../../_lib/auth.js";

function normStatus(s) {
  const v = String(s || "").trim().toLowerCase();
  if (v === "yes" || v === "going" || v === "y") return "yes";
  if (v === "no" || v === "not going" || v === "n") return "no";
  if (v === "maybe" || v === "m") return "maybe";
  return "yes";
}

async function ensureRsvpTable(db) {
  // Keep schema tolerant. D1 + existing installs may already have the table.
  // We do NOT require an id column.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS meeting_rsvps (
        org_id TEXT NOT NULL,
        meeting_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        note TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        PRIMARY KEY (org_id, meeting_id, user_id)
      )`
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_meeting_rsvps_meeting ON meeting_rsvps(org_id, meeting_id, updated_at)"
    )
    .run();
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const orgId = String(params.orgId || "");
  const meetingId = String(params.meetingId || "");

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");

  await ensureRsvpTable(db);

  // Any org member can RSVP.
  const gate = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!gate.ok) return gate.resp;

  if (request.method === "GET") {
    // Admin/owner only.
    const role = String(gate.role || "");
    const isAdmin = role === "admin" || role === "owner";
    if (!isAdmin) return bad(403, "FORBIDDEN");

    const rows = await db
      .prepare(
        "SELECT user_id, status, note, created_at, updated_at FROM meeting_rsvps WHERE org_id=? AND meeting_id=? ORDER BY updated_at DESC"
      )
      .bind(orgId, meetingId)
      .all();
    return ok({ rsvps: rows?.results || [] });
  }

  if (request.method !== "POST") return bad(405, "METHOD_NOT_ALLOWED");

  const body = await readJSON(request);
  const status = normStatus(body.status);
  const note = String(body.note || "").slice(0, 2000);
  const ts = now();
  const userId = String(gate.user?.sub || gate.user?.id || "");
  if (!userId) return bad(401, "UNAUTHORIZED");

  await db
    .prepare(
      `INSERT INTO meeting_rsvps (org_id, meeting_id, user_id, status, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(org_id, meeting_id, user_id) DO UPDATE SET
         status=excluded.status,
         note=excluded.note,
         updated_at=excluded.updated_at`
    )
    .bind(orgId, meetingId, userId, status, note, ts, ts)
    .run();

  return ok({ meeting_id: meetingId, status });
}
