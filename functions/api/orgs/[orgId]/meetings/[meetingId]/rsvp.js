import { json, err, readJSON } from "../../../../_lib/http.js";
import { getDb, requireOrgRole } from "../../../../_lib/auth.js";

function normStatus(s) {
  const v = String(s || "").trim().toLowerCase();
  if (v === "yes" || v === "going" || v === "y") return "yes";
  if (v === "no" || v === "not going" || v === "n") return "no";
  if (v === "maybe" || v === "m") return "maybe";
  return "yes";
}

async function ensureSchema(db) {
  // Create if missing. If it already exists, these are harmless no-ops.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS meeting_rsvps (
        org_id TEXT NOT NULL,
        meeting_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      )`
    )
    .run();
  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_rsvps_unique ON meeting_rsvps(org_id, meeting_id, user_id)"
    )
    .run();
}

async function tableCols(db) {
  try {
    const r = await db.prepare("PRAGMA table_info(meeting_rsvps)").all();
    return new Set((r?.results || []).map((x) => String(x?.name || "")));
  } catch {
    return new Set();
  }
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const orgId = params.orgId;
  const meetingId = params.meetingId;

  const gate = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!gate.ok) return gate.resp;

  const db = getDb(env);
  if (!db) return err(500, "NO_DB_BINDING");

  await ensureSchema(db);
  const cols = await tableCols(db);

  const userId = String(gate.user?.sub || "");
  if (!userId) return err(401, "UNAUTHORIZED");

  if (request.method === "GET") {
    const isAdmin = gate.role === "admin" || gate.role === "owner";

    // Admin/owner: full list
    if (isAdmin) {
      const rows = await db
        .prepare(
          "SELECT user_id, status, note, created_at, updated_at FROM meeting_rsvps WHERE org_id=? AND meeting_id=? ORDER BY COALESCE(updated_at, created_at) DESC"
        )
        .bind(orgId, meetingId)
        .all();
      return json({ ok: true, rsvps: rows?.results || [] });
    }

    // Member: only their own RSVP (so the meeting detail pane can show it)
    const row = await db
      .prepare(
        "SELECT status, note, created_at, updated_at FROM meeting_rsvps WHERE org_id=? AND meeting_id=? AND user_id=?"
      )
      .bind(orgId, meetingId, userId)
      .first();
    return json({ ok: true, rsvp: row || null });
  }

  if (request.method !== "POST") return err(405, "METHOD_NOT_ALLOWED");

  const body = await readJSON(request);
  const status = normStatus(body.status);
  const note = String(body.note || "").slice(0, 2000);
  const now = Date.now();

  // Insert only columns that actually exist (older tables may not have id/updated_at).
  const hasUpdated = cols.has("updated_at");
  const sql = hasUpdated
    ? `INSERT INTO meeting_rsvps (org_id, meeting_id, user_id, status, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(org_id, meeting_id, user_id) DO UPDATE SET
         status=excluded.status,
         note=excluded.note,
         updated_at=excluded.updated_at`
    : `INSERT INTO meeting_rsvps (org_id, meeting_id, user_id, status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(org_id, meeting_id, user_id) DO UPDATE SET
         status=excluded.status,
         note=excluded.note`;

  const stmt = db.prepare(sql);
  const binds = hasUpdated
    ? [orgId, meetingId, userId, status, note, now, now]
    : [orgId, meetingId, userId, status, note, now];
  await stmt.bind(...binds).run();

  return json({ ok: true, meeting_id: meetingId, status });
}
