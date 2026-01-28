import { json } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;

  const gate = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!gate.ok) return gate.resp;

  const db = env.BF_DB;
  if (!db) return json({ ok: false, error: "NO_DB_BINDING" }, 500);

  const nowMs = Date.now();

  const peopleCount = await db
    .prepare("SELECT COUNT(*) as c FROM people WHERE org_id = ?")
    .bind(orgId)
    .first();

  const needsOpen = await db
    .prepare("SELECT COUNT(*) as c FROM needs WHERE org_id = ? AND status = 'open'")
    .bind(orgId)
    .first();

  const needsAll = await db
    .prepare("SELECT COUNT(*) as c FROM needs WHERE org_id = ?")
    .bind(orgId)
    .first();

  const inventoryCount = await db
    .prepare("SELECT COUNT(*) as c FROM inventory WHERE org_id = ?")
    .bind(orgId)
    .first();

  const meetingsUpcoming = await db
    .prepare(
      "SELECT COUNT(*) as c FROM meetings WHERE org_id = ? AND (starts_at IS NULL OR starts_at >= ?)"
    )
    .bind(orgId, nowMs)
    .first();

  // Small previews for the dashboard cards
  const people = await db
    .prepare(
      "SELECT id, name, email FROM people WHERE org_id = ? ORDER BY created_at DESC LIMIT 5"
    )
    .bind(orgId)
    .all();

  const inventory = await db
    .prepare(
      "SELECT id, name, qty, unit FROM inventory WHERE org_id = ? ORDER BY created_at DESC LIMIT 5"
    )
    .bind(orgId)
    .all();

  const needs = await db
    .prepare(
      "SELECT id, title, status FROM needs WHERE org_id = ? ORDER BY created_at DESC LIMIT 5"
    )
    .bind(orgId)
    .all();

  const meetings = await db
    .prepare(
      `SELECT id, title, starts_at, ends_at, location
       FROM meetings
       WHERE org_id = ? AND (starts_at IS NULL OR starts_at >= ?)
       ORDER BY
         CASE WHEN starts_at IS NULL THEN 1 ELSE 0 END,
         starts_at ASC,
         created_at DESC
       LIMIT 5`
    )
    .bind(orgId, nowMs)
    .all();

  // More useful activity: include actor info if present
  const activity = await db
    .prepare(
      `SELECT
         a.id,
         a.kind,
         a.message,
         a.actor_user_id,
         u.email AS actor_email,
         u.name AS actor_name,
         a.created_at
       FROM activity a
       LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE a.org_id = ?
       ORDER BY a.created_at DESC
       LIMIT 25`
    )
    .bind(orgId)
    .all();

  return json({
    ok: true,
    counts: {
      people: Number(peopleCount?.c || 0),
      needsOpen: Number(needsOpen?.c || 0),
      needsAll: Number(needsAll?.c || 0),
      inventory: Number(inventoryCount?.c || 0),
      meetingsUpcoming: Number(meetingsUpcoming?.c || 0),
    },
    people: people?.results || [],
    inventory: inventory?.results || [],
    needs: needs?.results || [],
    meetings: meetings?.results || [],
    activity: activity?.results || [],
  });
}
