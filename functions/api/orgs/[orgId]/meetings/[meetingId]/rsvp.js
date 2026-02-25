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

async function getTableCols(db) {
  try {
    const info = await db.prepare("PRAGMA table_info(meeting_rsvps)").all();
    return new Set((info?.results || []).map((r) => String(r?.name || "").toLowerCase()));
  } catch {
    return new Set();
  }
}

function has(cols, name) {
  return cols && cols.has(String(name || "").toLowerCase());
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const orgId = String(params.orgId || "");
  const meetingId = String(params.meetingId || "");

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");

  await ensureRsvpTable(db);
  const cols = await getTableCols(db);

  // Any org member can RSVP.
  const gate = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!gate.ok) return gate.resp;

  if (request.method === "GET") {
    // Members can read *their own* RSVP.
    // Admin/owner can read everyone.
    const role = String(gate.role || "");
    const isAdmin = role === "admin" || role === "owner";
    const userId = String(gate.user?.sub || gate.user?.id || "");
    if (!userId) return bad(401, "UNAUTHORIZED");

    if (!isAdmin) {
      const row = await db
        .prepare(
          "SELECT status, note" + (has(cols, "created_at") ? ", created_at" : "") + (has(cols, "updated_at") ? ", updated_at" : "") +
            " FROM meeting_rsvps WHERE org_id=? AND meeting_id=? AND user_id=? LIMIT 1"
        )
        .bind(orgId, meetingId, userId)
        .first();
      return ok({ my_rsvp: row || null });
    }

    const sel = ["user_id", "status", "note"];
    if (has(cols, "created_at")) sel.push("created_at");
    if (has(cols, "updated_at")) sel.push("updated_at");
    const orderBy = has(cols, "updated_at") ? "updated_at" : has(cols, "created_at") ? "created_at" : "rowid";

    const rows = await db
      .prepare(
        `SELECT ${sel.join(", ")} FROM meeting_rsvps WHERE org_id=? AND meeting_id=? ORDER BY ${orderBy} DESC`
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

  // Build an UPSERT that only references existing columns.
  const insertCols = ["org_id", "meeting_id", "user_id", "status"];
  const insertVals = [orgId, meetingId, userId, status];
  if (has(cols, "note")) {
    insertCols.push("note");
    insertVals.push(note);
  }
  if (has(cols, "created_at")) {
    insertCols.push("created_at");
    insertVals.push(ts);
  }
  if (has(cols, "updated_at")) {
    insertCols.push("updated_at");
    insertVals.push(ts);
  }

  const updates = ["status=excluded.status"];
  if (has(cols, "note")) updates.push("note=excluded.note");
  if (has(cols, "updated_at")) updates.push("updated_at=excluded.updated_at");

  const insertSql = `INSERT INTO meeting_rsvps (${insertCols.join(", ")})
    VALUES (${insertCols.map(() => "?").join(", ")})`;

  // Prefer a real UPSERT when the table has a PK/UNIQUE constraint.
  // If this install created meeting_rsvps earlier without a constraint, SQLite will throw.
  try {
    await db
      .prepare(
        `${insertSql}
         ON CONFLICT(org_id, meeting_id, user_id) DO UPDATE SET ${updates.join(", ")}`
      )
      .bind(...insertVals)
      .run();
  } catch (e) {
    // Fallback: UPDATE then INSERT.
    const setParts = ["status=?"];
    const updVals = [status];
    if (has(cols, "note")) {
      setParts.push("note=?");
      updVals.push(note);
    }
    if (has(cols, "updated_at")) {
      setParts.push("updated_at=?");
      updVals.push(ts);
    }

    const upd = await db
      .prepare(
        `UPDATE meeting_rsvps SET ${setParts.join(", ")} WHERE org_id=? AND meeting_id=? AND user_id=?`
      )
      .bind(...updVals, orgId, meetingId, userId)
      .run();

    const changed = Number(upd?.meta?.changes || upd?.changes || 0);
    if (!changed) {
      await db.prepare(insertSql).bind(...insertVals).run();
    }
  }

  return ok({ meeting_id: meetingId, status, my_rsvp: { status, note } });
}
