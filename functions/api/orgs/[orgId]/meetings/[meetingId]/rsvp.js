import { err, ok, now, uuid, readJSON, requireMethod } from "../../../../_lib/http.js";
import { requireOrgRole } from "../../../../_lib/auth.js";

async function ensureMeetingRsvpsTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS meeting_rsvps (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      meeting_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(org_id, meeting_id, user_id)
    )`
  ).run();

  try {
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_meeting_rsvps_org_meeting ON meeting_rsvps (org_id, meeting_id)"
      )
      .run();
  } catch {
    // ignore
  }
}

function normStatus(s) {
  const v = String(s || "").trim().toLowerCase();
  if (v === "yes" || v === "going" || v === "y") return "yes";
  if (v === "no" || v === "not going" || v === "n") return "no";
  if (v === "maybe" || v === "m") return "maybe";
  return "yes";
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const db = env?.BF_DB || env?.DB;
  const orgId = params.orgId;
  const meetingId = params.meetingId;

  if (!db) return err(500, "NO_DB_BINDING");

  await ensureMeetingRsvpsTable(db);

  if (request.method === "GET") {
    // Admin/owner can view full RSVP list.
    const a = await requireOrgRole({ env, request, orgId, minRole: "admin" });
    if (!a.ok) return a.resp;

    const rows = await db
      .prepare(
        "SELECT user_id, status, note, created_at, updated_at FROM meeting_rsvps WHERE org_id=? AND meeting_id=? ORDER BY updated_at DESC"
      )
      .bind(orgId, meetingId)
      .all();
    return ok({ rsvps: rows?.results || [] });
  }

  const m = requireMethod(request, "POST");
  if (m) return m;

  const a = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!a.ok) return a.resp;

  const body = await readJSON(request);

  const status = normStatus(body.status);
  const note = String(body.note || "").slice(0, 2000);
  const t = now();
  const userId = String(a.user?.sub || "");
  if (!userId) return err(401, "UNAUTHORIZED");

  await db
    .prepare(
      `INSERT INTO meeting_rsvps (id, org_id, meeting_id, user_id, status, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(org_id, meeting_id, user_id) DO UPDATE SET
         status=excluded.status,
         note=excluded.note,
         updated_at=excluded.updated_at`
    )
    .bind(uuid(), orgId, meetingId, userId, status, note, t, t)
    .run();

  return ok({ meeting_id: meetingId, status });
}
