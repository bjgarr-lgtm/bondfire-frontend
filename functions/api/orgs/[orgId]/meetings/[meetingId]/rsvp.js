import { json, error } from "../../../../_lib/http";
import { requireUser, requireOrgRole } from "../../../../_lib/auth";

function normStatus(s) {
  const v = String(s || "").trim().toLowerCase();
  if (v === "yes" || v === "going" || v === "y") return "yes";
  if (v === "no" || v === "not going" || v === "n") return "no";
  if (v === "maybe" || v === "m") return "maybe";
  return "yes";
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const db = env.DB;
  const orgId = params.orgId;
  const meetingId = params.meetingId;

  const user = await requireUser(ctx);
  // Any org member can RSVP.
  await requireOrgRole(db, orgId, user.id, "member");

  if (request.method === "GET") {
    // Admin/owner can view full RSVP list (optional)
    const roleRow = await db
      .prepare("SELECT role FROM org_members WHERE org_id=? AND user_id=?")
      .bind(orgId, user.id)
      .first();
    const role = String(roleRow?.role || "");
    const isAdmin = role === "admin" || role === "owner";
    if (!isAdmin) return error(403, "FORBIDDEN");

    const rows = await db
      .prepare(
        "SELECT user_id, status, note, created_at, updated_at FROM meeting_rsvps WHERE org_id=? AND meeting_id=? ORDER BY updated_at DESC"
      )
      .bind(orgId, meetingId)
      .all();
    return json({ ok: true, rsvps: rows?.results || [] });
  }

  if (request.method !== "POST") return error(405, "METHOD_NOT_ALLOWED");

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const status = normStatus(body.status);
  const note = String(body.note || "").slice(0, 2000);
  const now = Date.now();

  // Requires table meeting_rsvps.
  // PRIMARY KEY(org_id, meeting_id, user_id)
  await db
    .prepare(
      `INSERT INTO meeting_rsvps (org_id, meeting_id, user_id, status, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(org_id, meeting_id, user_id) DO UPDATE SET
         status=excluded.status,
         note=excluded.note,
         updated_at=excluded.updated_at`
    )
    .bind(orgId, meetingId, user.id, status, note, now, now)
    .run();

  return json({ ok: true, meeting_id: meetingId, status });
}
