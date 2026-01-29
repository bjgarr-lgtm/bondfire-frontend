import { json } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";

async function safeFirst(env, sql, binds = [], fallback = null) {
  try {
    const stmt = env.BF_DB.prepare(sql);
    const res = Array.isArray(binds) ? await stmt.bind(...binds).first() : await stmt.first();
    return res ?? fallback;
  } catch (e) {
    console.warn("dashboard safeFirst failed", e);
    return fallback;
  }
}

async function safeAll(env, sql, binds = [], fallback = []) {
  try {
    const stmt = env.BF_DB.prepare(sql);
    const res = Array.isArray(binds) ? await stmt.bind(...binds).all() : await stmt.all();
    return Array.isArray(res?.results) ? res.results : fallback;
  } catch (e) {
    console.warn("dashboard safeAll failed", e);
    return fallback;
  }
}

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;

  // The dashboard should never hard-crash because one table is missing
  // (migrations happen, humans forget things, etc.).

  const peopleCount = await safeFirst(
    env,
    "SELECT COUNT(*) as c FROM people WHERE org_id = ?",
    [orgId],
    { c: 0 }
  );

  const needsOpenCount = await safeFirst(
    env,
    "SELECT COUNT(*) as c FROM needs WHERE org_id = ? AND status = 'open'",
    [orgId],
    { c: 0 }
  );

  const needsAllCount = await safeFirst(
    env,
    "SELECT COUNT(*) as c FROM needs WHERE org_id = ?",
    [orgId],
    { c: 0 }
  );

  const inventoryCount = await safeFirst(
    env,
    "SELECT COUNT(*) as c FROM inventory WHERE org_id = ?",
    [orgId],
    { c: 0 }
  );

  const nowMs = Date.now();
  const meetingsUpcomingCount = await safeFirst(
    env,
    "SELECT COUNT(*) as c FROM meetings WHERE org_id = ? AND starts_at IS NOT NULL AND starts_at >= ?",
    [orgId, nowMs],
    { c: 0 }
  );

  const nextMeeting = await safeFirst(
    env,
    "SELECT id, title, starts_at FROM meetings WHERE org_id = ? AND starts_at IS NOT NULL AND starts_at >= ? ORDER BY starts_at ASC LIMIT 1",
    [orgId, nowMs],
    null
  );

  const people = await safeAll(
    env,
    "SELECT id, name, email FROM people WHERE org_id = ? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 5",
    [orgId],
    []
  );

  const needs = await safeAll(
    env,
    "SELECT id, title, status FROM needs WHERE org_id = ? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 5",
    [orgId],
    []
  );

  const inventory = await safeAll(
    env,
    "SELECT id, name, qty, unit FROM inventory WHERE org_id = ? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 5",
    [orgId],
    []
  );

  const activity = await safeAll(
    env,
    "SELECT id, kind, message, actor_user_id, created_at FROM activity WHERE org_id = ? ORDER BY created_at DESC LIMIT 25",
    [orgId],
    []
  );

  return json({
    ok: true,
    counts: {
      people: peopleCount?.c || 0,
      needsOpen: needsOpenCount?.c || 0,
      needsAll: needsAllCount?.c || 0,
      inventory: inventoryCount?.c || 0,
      meetingsUpcoming: meetingsUpcomingCount?.c || 0,
    },
    nextMeeting: nextMeeting || null,
    people,
    needs,
    inventory,
    activity,
  });
}
