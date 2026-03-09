function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function onRequestPost(context) {
  const { env, params, request } = context;
  try {
    const slug = String(params?.slug || "").trim().toLowerCase();
    if (!slug) return json({ ok: false, error: "BAD_SLUG" }, 400);

    const db = env.DB;
    if (!db) return json({ ok: false, error: "NO_DB" }, 500);

    const pub = await db
      .prepare(`select org_id from public_pages where lower(slug) = ? and enabled = 1 limit 1`)
      .bind(slug)
      .first();
    if (!pub?.org_id) return json({ ok: false, error: "NOT_FOUND" }, 404);

    const body = await request.json().catch(() => ({}));
    const kind = String(body?.kind || "").trim().toLowerCase();
    const name = String(body?.name || "").trim();
    const contact = String(body?.contact || "").trim();
    const details = String(body?.details || "").trim();
    const extra = String(body?.extra || "").trim();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!kind) return json({ ok: false, error: "BAD_KIND" }, 400);
    if (!name || !contact) return json({ ok: false, error: "MISSING_CONTACT" }, 400);

    const normalizedItems = items
      .map((item) => ({
        inventory_id: item?.inventory_id != null ? String(item.inventory_id) : "",
        name: String(item?.name || "").trim(),
        qty_requested: Math.max(1, Math.floor(Number(item?.qty_requested || 1) || 1)),
        unit: String(item?.unit || "").trim(),
        category: String(item?.category || "").trim(),
      }))
      .filter((item) => item.inventory_id || item.name);

    const detailText =
      kind === "inventory_request" && normalizedItems.length
        ? normalizedItems
            .map((item) => `${item.name || "item"} x ${item.qty_requested}${item.unit ? ` ${item.unit}` : ""}`)
            .join("\n")
        : details;

    const extraText =
      kind === "inventory_request" && normalizedItems.length
        ? JSON.stringify({ note: extra, items: normalizedItems })
        : extra;

    await db.prepare(
      `insert into public_inbox
        (org_id, type, source_kind, name, contact, details, extra, review_status, created_at, updated_at)
       values (?, 'intake', ?, ?, ?, ?, ?, 'new', unixepoch('now') * 1000, unixepoch('now') * 1000)`
    )
      .bind(pub.org_id, kind, name, contact, detailText, extraText)
      .run();

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: "INTERNAL", detail: String(err?.message || err || "") }, 500);
  }
}
