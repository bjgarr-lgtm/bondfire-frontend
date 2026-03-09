import { getDB } from "../../../_bf.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function mapInboxItem(row) {
  const sourceKind = String(row?.source_kind || "").trim().toLowerCase();
  const type = String(row?.type || "intake").trim().toLowerCase();
  let title = "Public intake";
  if (sourceKind === "get_help") title = "Get Help";
  else if (sourceKind === "volunteer") title = "Volunteer";
  else if (sourceKind === "offer_resources") title = "Offer Resources";
  else if (sourceKind === "inventory_request") title = "Inventory Request";
  else if (type === "rsvp") title = "Meeting RSVP";

  let details = String(row?.details || "").trim();
  let extra = String(row?.extra || "").trim();

  if (sourceKind === "inventory_request" && extra) {
    try {
      const parsed = JSON.parse(extra);
      if (parsed?.note) extra = String(parsed.note || "").trim();
      if (Array.isArray(parsed?.items) && parsed.items.length) {
        details = parsed.items
          .map(
            (item) =>
              `${String(item?.name || "item").trim()} x ${Math.max(
                1,
                Math.floor(Number(item?.qty_requested || 1) || 1)
              )}${item?.unit ? ` ${String(item.unit).trim()}` : ""}`
          )
          .join("\n");
      }
    } catch {
      // keep raw extra/details
    }
  }

  return {
    ...row,
    title,
    details,
    extra,
  };
}

export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const orgId = String(params?.orgId || "").trim();
    if (!orgId) return json({ ok: false, error: "BAD_ORG" }, 400);

    const db = getDB(env);
    if (!db) return json({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);

    const rows = await db
      .prepare(
        `select id, org_id, type, source_kind, name, contact, details, extra, review_status, admin_note, created_at, updated_at
         from public_inbox
         where org_id = ?
         order by coalesce(updated_at, created_at) desc, created_at desc`
      )
      .bind(orgId)
      .all();

    return json({
      ok: true,
      items: (Array.isArray(rows?.results) ? rows.results : []).map(mapInboxItem),
    });
  } catch (err) {
    return json({ ok: false, error: "INTERNAL", detail: String(err?.message || err || "") }, 500);
  }
}

export async function onRequestPut(context) {
  const { env, params, request } = context;
  try {
    const orgId = String(params?.orgId || "").trim();
    if (!orgId) return json({ ok: false, error: "BAD_ORG" }, 400);

    const body = await request.json().catch(() => ({}));
    const id = body?.id != null ? String(body.id) : "";
    if (!id) return json({ ok: false, error: "BAD_ID" }, 400);

    const status = String(body?.review_status || "new").trim().toLowerCase();
    const adminNote = String(body?.admin_note || "");

    const db = getDB(env);
    if (!db) return json({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);

    await db
      .prepare(
        `update public_inbox
         set review_status = ?, admin_note = ?, updated_at = unixepoch('now') * 1000
         where org_id = ? and id = ?`
      )
      .bind(status, adminNote, orgId, id)
      .run();

    const rows = await db
      .prepare(
        `select id, org_id, type, source_kind, name, contact, details, extra, review_status, admin_note, created_at, updated_at
         from public_inbox
         where org_id = ?
         order by coalesce(updated_at, created_at) desc, created_at desc`
      )
      .bind(orgId)
      .all();

    return json({
      ok: true,
      items: (Array.isArray(rows?.results) ? rows.results : []).map(mapInboxItem),
    });
  } catch (err) {
    return json({ ok: false, error: "INTERNAL", detail: String(err?.message || err || "") }, 500);
  }
}