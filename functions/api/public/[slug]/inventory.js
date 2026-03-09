export async function onRequestGet(context) {
  const { request, env, params } = context;
  try {
    const slug = String(params?.slug || "").trim().toLowerCase();
    if (!slug) {
      return Response.json({ ok: false, error: "BAD_SLUG" }, { status: 400 });
    }

    const db = env.DB;
    if (!db) {
      return Response.json({ ok: false, error: "NO_DB" }, { status: 500 });
    }

    const pub = await db
      .prepare(`select org_id from public_pages where lower(slug) = ? and enabled = 1 limit 1`)
      .bind(slug)
      .first();

    if (!pub?.org_id) {
      return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const rows = await db
      .prepare(
        `select
          i.id,
          i.name,
          i.qty,
          i.unit,
          i.category,
          i.notes,
          i.location,
          i.is_public,
          i.encrypted_blob,
          coalesce(ip.par, null) as par
         from inventory i
         left join inventory_pars ip
           on ip.org_id = i.org_id and ip.inventory_id = i.id
         where i.org_id = ?
           and coalesce(i.is_public, 0) = 1
           and coalesce(i.qty, 0) > 0
         order by lower(coalesce(i.category, '')), lower(coalesce(i.name, ''))`
      )
      .bind(pub.org_id)
      .all();

    return Response.json({ ok: true, items: Array.isArray(rows?.results) ? rows.results : [] });
  } catch (err) {
    return Response.json(
      { ok: false, error: "INTERNAL", detail: String(err?.message || err || "") },
      { status: 500 }
    );
  }
}
