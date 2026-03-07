import { ok, err } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { getDB } from "../../../_bf.js";

function clean(v, max = 4000) {
  return String(v || "").trim().slice(0, max);
}

function normReviewStatus(v) {
  const s = String(v || "").trim().toLowerCase();
  if (["reviewed", "contacted", "closed"].includes(s)) return s;
  return "new";
}

function normType(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "rsvp") return "rsvp";
  return "intake";
}

async function ensureTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS public_intakes (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    name TEXT,
    contact TEXT,
    details TEXT,
    extra TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_public_intakes_org_created ON public_intakes(org_id, created_at DESC)`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS public_meeting_rsvps (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    meeting_id TEXT NOT NULL,
    name TEXT,
    contact TEXT,
    status TEXT NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_public_meeting_rsvps_lookup ON public_meeting_rsvps(org_id, meeting_id, created_at DESC)`).run();

  for (const sql of [
    "ALTER TABLE public_intakes ADD COLUMN admin_note TEXT",
    "ALTER TABLE public_meeting_rsvps ADD COLUMN admin_status TEXT DEFAULT 'new'",
    "ALTER TABLE public_meeting_rsvps ADD COLUMN admin_note TEXT"
  ]) {
    try {
      await db.prepare(sql).run();
    } catch (e) {
      const msg = String(e?.message || e).toLowerCase();
      if (!msg.includes("duplicate") && !msg.includes("exists")) throw e;
    }
  }
}

async function listInbox(db, orgId) {
  const [intakesRes, rsvpsRes] = await Promise.all([
    db.prepare(`SELECT id, kind, name, contact, details, extra, status, admin_note, created_at, updated_at
                FROM public_intakes
                WHERE org_id=?
                ORDER BY created_at DESC`).bind(orgId).all(),
    db.prepare(`SELECT r.id, r.meeting_id, r.name, r.contact, r.status, r.note, r.admin_status, r.admin_note, r.created_at, r.updated_at,
                       m.title AS meeting_title, m.starts_at, m.location
                FROM public_meeting_rsvps r
                LEFT JOIN meetings m ON m.id = r.meeting_id AND m.org_id = r.org_id
                WHERE r.org_id=?
                ORDER BY r.created_at DESC`).bind(orgId).all(),
  ]);

  const intakes = (intakesRes.results || []).map((row) => ({
    id: row.id,
    type: "intake",
    source_kind: row.kind || "",
    title:
      row.kind === "get_help"
        ? "Get Help"
        : row.kind === "offer_resources"
        ? "Offer Resources"
        : row.kind === "volunteer"
        ? "Volunteer"
        : "Public Intake",
    name: row.name || "",
    contact: row.contact || "",
    details: row.details || "",
    extra: row.extra || "",
    attendee_status: "",
    review_status: row.status || "new",
    admin_note: row.admin_note || "",
    created_at: row.created_at || 0,
    updated_at: row.updated_at || 0,
    meeting_id: "",
    meeting_title: "",
    starts_at: null,
    location: "",
  }));

  const rsvps = (rsvpsRes.results || []).map((row) => ({
    id: row.id,
    type: "rsvp",
    source_kind: "meeting_rsvp",
    title: row.meeting_title || "Meeting RSVP",
    name: row.name || "",
    contact: row.contact || "",
    details: row.note || "",
    extra: "",
    attendee_status: row.status || "yes",
    review_status: row.admin_status || "new",
    admin_note: row.admin_note || "",
    created_at: row.created_at || 0,
    updated_at: row.updated_at || 0,
    meeting_id: row.meeting_id || "",
    meeting_title: row.meeting_title || "",
    starts_at: row.starts_at || null,
    location: row.location || "",
  }));

  return [...intakes, ...rsvps].sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
}

export async function onRequest(context) {
  const { env, request, params } = context;
  const orgId = String(params?.orgId || "").trim();
  if (!orgId) return err(400, "BAD_ORG_ID");

  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");
  await ensureTables(db);

  const gate = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!gate.ok) return gate.resp;

  try {
    if (request.method === "GET") {
      const items = await listInbox(db, orgId);
      return ok({ items });
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const type = normType(body?.type);
      const id = clean(body?.id, 128);
      if (!id) return err(400, "MISSING_ID");
      const reviewStatus = normReviewStatus(body?.review_status);
      const adminNote = clean(body?.admin_note, 4000);
      const t = Date.now();

      if (type === "intake") {
        await db.prepare(`UPDATE public_intakes SET status=?, admin_note=?, updated_at=? WHERE org_id=? AND id=?`).bind(
          reviewStatus,
          adminNote,
          t,
          orgId,
          id,
        ).run();
      } else {
        await db.prepare(`UPDATE public_meeting_rsvps SET admin_status=?, admin_note=?, updated_at=? WHERE org_id=? AND id=?`).bind(
          reviewStatus,
          adminNote,
          t,
          orgId,
          id,
        ).run();
      }

      const items = await listInbox(db, orgId);
      return ok({ items });
    }

    return err(405, "METHOD_NOT_ALLOWED");
  } catch (e) {
    return err(500, "SERVER_ERROR", { message: String(e?.message || e) });
  }
}
