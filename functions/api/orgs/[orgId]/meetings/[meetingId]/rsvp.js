import { ok, bad } from "../../../../_lib/http.js";
import { getDb, requireOrgRole } from "../../../../_lib/auth.js";

function normStatus(s) {
  const v = String(s || "").trim().toLowerCase();
  if (v === "yes" || v === "going" || v === "y") return "yes";
  if (v === "no" || v === "not going" || v === "n") return "no";
  if (v === "maybe" || v === "m") return "maybe";
  return "yes";
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function ensureSchema(db) {
  // Keep schema creation D1-safe. IF NOT EXISTS is supported.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS meeting_rsvps (
        org_id TEXT NOT NULL,
        meeting_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        note TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )`
    )
    .run();

  // Unique key for upserts.
  await db
    .prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS meeting_rsvps_uniq
         ON meeting_rsvps(org_id, meeting_id, user_id)`
    )
    .run();
}

async function getTableColumns(db) {
  try {
    const r = await db.prepare("PRAGMA table_info(meeting_rsvps)").all();
    const cols = new Set((r?.results || []).map((x) => String(x?.name || "")));
    return cols;
  } catch {
    return new Set();
  }
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const orgId = String(params.orgId || "");
  const meetingId = String(params.meetingId || "");
  if (!orgId || !meetingId) return bad(400, "BAD_PARAMS");

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");

  // Ensure table exists (no-op if already there).
  await ensureSchema(db);

  // Any member can RSVP and can read their own RSVP.
  const gateMember = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!gateMember.ok) return gateMember.resp;

  const userId = String(gateMember.user?.sub || "");
  if (!userId) return bad(401, "UNAUTHORIZED");

  if (request.method === "GET") {
    // Admin/owner can view full list.
    const gateAdmin = await requireOrgRole({ env, request, orgId, minRole: "admin" });
    if (gateAdmin.ok) {
      const rows = await db
        .prepare(
          "SELECT user_id, status, note, created_at, updated_at FROM meeting_rsvps WHERE org_id=? AND meeting_id=? ORDER BY COALESCE(updated_at, created_at) DESC"
        )
        .bind(orgId, meetingId)
        .all();
      return ok({ rsvps: rows?.results || [] });
    }

    // Non-admin: return only the caller's RSVP.
    const row = await db
      .prepare(
        "SELECT user_id, status, note, created_at, updated_at FROM meeting_rsvps WHERE org_id=? AND meeting_id=? AND user_id=? LIMIT 1"
      )
      .bind(orgId, meetingId, userId)
      .first();

    return ok({ rsvp: row || null });
  }

  if (request.method !== "POST") return bad(405, "METHOD_NOT_ALLOWED");

  const body = await readJson(request);
  const status = normStatus(body.status);
  const note = String(body.note || "").slice(0, 2000);
  const now = Date.now();

  // Be robust to whatever legacy schema exists in D1.
  const cols = await getTableColumns(db);

  const hasUpdated = cols.has("updated_at");
  const hasCreated = cols.has("created_at");
  const hasNote = cols.has("note");

  const insertCols = ["org_id", "meeting_id", "user_id", "status"];
  const insertVals = [orgId, meetingId, userId, status];

  if (hasNote) {
    insertCols.push("note");
    insertVals.push(note);
  }
  if (hasCreated) {
    insertCols.push("created_at");
    insertVals.push(now);
  }
  if (hasUpdated) {
    insertCols.push("updated_at");
    insertVals.push(now);
  }

  const setParts = ["status=excluded.status"];
  if (hasNote) setParts.push("note=excluded.note");
  if (hasUpdated) setParts.push("updated_at=excluded.updated_at");

  const sql = `INSERT INTO meeting_rsvps (${insertCols.join(",")})
               VALUES (${insertCols.map(() => "?").join(",")})
               ON CONFLICT(org_id, meeting_id, user_id) DO UPDATE SET ${setParts.join(", ")}`;

  await db.prepare(sql).bind(...insertVals).run();

  return ok({ meeting_id: meetingId, status });
}
