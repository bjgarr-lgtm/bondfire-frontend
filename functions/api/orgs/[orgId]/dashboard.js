import { json } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";

function extractUuid(s) {
  const m = String(s || "").match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i
  );
  return m ? m[0] : null;
}

function kindToEntityTable(kind) {
  const k = String(kind || "").toLowerCase();
  if (k.startsWith("need.")) return { table: "needs", titleCol: "title" };
  if (k.startsWith("person.")) return { table: "people", titleCol: "name" };
  if (k.startsWith("inventory.")) return { table: "inventory", titleCol: "name" };
  if (k.startsWith("meeting.")) return { table: "meetings", titleCol: "title" };
  return null;
}

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;

  const people = await env.BF_DB.prepare(
    "SELECT COUNT(*) as c FROM people WHERE org_id = ?"
  ).bind(orgId).first();

  const needsOpen = await env.BF_DB.prepare(
    "SELECT COUNT(*) as c FROM needs WHERE org_id = ? AND status = 'open'"
  ).bind(orgId).first();

  const needsAll = await env.BF_DB.prepare(
    "SELECT COUNT(*) as c FROM needs WHERE org_id = ?"
  ).bind(orgId).first();

  const inventory = await env.BF_DB.prepare(
    "SELECT COUNT(*) as c FROM inventory WHERE org_id = ?"
  ).bind(orgId).first();

  const nowMs = Date.now();
  const meetingsUpcoming = await env.BF_DB.prepare(
    "SELECT COUNT(*) as c FROM meetings WHERE org_id = ? AND (starts_at IS NULL OR starts_at >= ?)"
  ).bind(orgId, nowMs).first();

  // Next scheduled meeting (starts_at must be present)
  const nextMeeting = await env.BF_DB.prepare(
    `SELECT id, title, starts_at, location
     FROM meetings
     WHERE org_id = ?
       AND starts_at IS NOT NULL
       AND starts_at >= ?
     ORDER BY starts_at ASC
     LIMIT 1`
  ).bind(orgId, nowMs).first();


  // Pull raw activity
  const activityRes = await env.BF_DB.prepare(
    "SELECT id, kind, message, actor_user_id, created_at FROM activity WHERE org_id = ? ORDER BY created_at DESC LIMIT 10"
  ).bind(orgId).all();

  const raw = activityRes?.results || [];

  // Enrich with entity titles when possible.
  // Strategy:
  // - Try to extract UUID from message.
  // - Infer entity table from kind prefix.
  // - Query that table for title/name if it still exists.
  //
  // Deleted entities won't exist anymore. That is fine.
  // We will still provide entity_id so frontend can show short id.
  const enriched = [];
  for (const row of raw) {
    const entity_id = extractUuid(row.message);
    const info = kindToEntityTable(row.kind);

    let entity_title = null;

    if (entity_id && info) {
      try {
        const found = await env.BF_DB.prepare(
          `SELECT ${info.titleCol} as t FROM ${info.table} WHERE org_id = ? AND id = ?`
        ).bind(orgId, entity_id).first();

        if (found && found.t != null) {
          entity_title = String(found.t || "").trim() || null;
        }
      } catch {
        // ignore enrichment errors; activity still returns
      }
    }

    enriched.push({
      ...row,
      entity_id: entity_id || null,
      entity_title,
    });
  }

  return json({
    ok: true,
    counts: {
      people: people?.c || 0,
      needsOpen: needsOpen?.c || 0,
      needsAll: needsAll?.c || 0,
      inventory: inventory?.c || 0,
      meetingsUpcoming: meetingsUpcoming?.c || 0
    },
    nextMeeting: nextMeeting || null,
    activity: activity?.results || []
  });
}
