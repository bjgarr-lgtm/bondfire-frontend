import { ok, err, readJSON } from "../../../../_lib/http.js";
import { getDb, requireOrgRole } from "../../../../_lib/auth.js";

function normStatus(s) {
  const v = String(s || "").trim().toLowerCase();
  if (v === "yes" || v === "going" || v === "y") return "yes";
  if (v === "no" || v === "not going" || v === "n") return "no";
  if (v === "maybe" || v === "m") return "maybe";
  return "yes";
}

async function getTableColumns(db, table) {
  const r = await db.prepare(`PRAGMA table_info(${table})`).all();
  const cols = (r?.results || []).map((x) => String(x?.name || "")).filter(Boolean);
  return new Set(cols);
}

async function ensureRsvpTable(db) {
  // Create if missing. If it already exists with a different schema, we do NOT try to alter it here.
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS meeting_rsvps (
      id TEXT,
      org_id TEXT NOT NULL,
      meeting_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER
    )
  `).run();

  // Ensure the upsert target exists for ON CONFLICT(org_id, meeting_id, user_id)
  // If the table already exists without this constraint, CREATE INDEX IF NOT EXISTS is safe.
  await db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS meeting_rsvps_unique
    ON meeting_rsvps (org_id, meeting_id, user_id)
  `).run();
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const orgId = params.orgId;
  const meetingId = params.meetingId;

  const db = getDb(env);
  if (!db) return err(500, "NO_DB_BINDING");

  // Ensure table + unique index exist (safe no-op if already present).
  await ensureRsvpTable(db);

  // Introspect actual columns so we work even if an older table exists (e.g., missing id/updated_at).
  const cols = await getTableColumns(db, "meeting_rsvps");
  const hasUpdatedAt = cols.has("updated_at");
  const hasCreatedAt = cols.has("created_at");

  if (request.method === "GET") {
    // Admin only: list all RSVPs for a meeting.
    const a = await requireOrgRole({ env, request, orgId, minRole: "admin" });
    if (!a.ok) return a.resp;

    const selectCols = [
      "user_id",
      "status",
      "note",
      hasCreatedAt ? "created_at" : null,
      hasUpdatedAt ? "updated_at" : null,
    ].filter(Boolean);

    const orderBy = hasUpdatedAt ? "updated_at" : (hasCreatedAt ? "created_at" : "status");

    const q = `SELECT ${selectCols.join(", ")} FROM meeting_rsvps
               WHERE org_id=? AND meeting_id=?
               ORDER BY ${orderBy} DESC`;
    const rows = await db.prepare(q).bind(orgId, meetingId).all();
    return ok({ rsvps: rows?.results || [] });
  }

  if (request.method !== "POST") return err(405, "METHOD_NOT_ALLOWED");

  // Any member can set their own RSVP.
  const m = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!m.ok) return m.resp;

  const body = await readJSON(request);
  const status = normStatus(body.status);
  const note = String(body.note || "").slice(0, 2000);
  const nowMs = Date.now();

  // Build INSERT / UPSERT based on actual columns present.
  const insertCols = ["org_id", "meeting_id", "user_id", "status", "note"];
  const insertVals = [orgId, meetingId, m.user.sub, status, note];

  if (hasCreatedAt) {
    insertCols.push("created_at");
    insertVals.push(nowMs);
  }
  if (hasUpdatedAt) {
    insertCols.push("updated_at");
    insertVals.push(nowMs);
  }

  const placeholders = insertCols.map(() => "?").join(", ");

  const updateParts = ["status=excluded.status", "note=excluded.note"];
  if (hasUpdatedAt) updateParts.push("updated_at=excluded.updated_at");
  else if (hasCreatedAt) updateParts.push("created_at=excluded.created_at");

  const sql = `
    INSERT INTO meeting_rsvps (${insertCols.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT(org_id, meeting_id, user_id) DO UPDATE SET
      ${updateParts.join(", ")}
  `;

  await db.prepare(sql).bind(...insertVals).run();

  return ok({ meeting_id: meetingId, status });
}
