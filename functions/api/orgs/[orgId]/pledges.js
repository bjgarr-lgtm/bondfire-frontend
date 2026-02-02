import {
  getDB,
  json,
  bad,
  readJson,
  getUserIdFromRequest,
  requireMemberRole,
  normalizeEmail,
} from "../../_bf.js";

function normStatus(s) {
  const v = String(s || "").toLowerCase().trim();
  const allowed = new Set(["offered", "accepted", "fulfilled", "cancelled"]);
  return allowed.has(v) ? v : "offered";
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = getDB(env);
  if (!db) return bad("DB_NOT_CONFIGURED", 500);

  const orgId = String(params.orgId || "");
  const userId = getUserIdFromRequest(request);

  if (request.method === "GET") {
    const roleCheck = await requireMemberRole(db, orgId, userId, "member");
    if (!roleCheck.ok) return bad(roleCheck.error, roleCheck.status);

    const rows = await db
      .prepare(
        `SELECT id, org_id, need_id, pledger_name, pledger_email, type, amount, unit,
                note, status, is_public, created_by, created_at, updated_at
         FROM pledges
         WHERE org_id = ?
         ORDER BY created_at DESC`
      )
      .bind(orgId)
      .all();

    return json({ ok: true, pledges: Array.isArray(rows?.results) ? rows.results : [] });
  }

  if (request.method === "POST") {
    const roleCheck = await requireMemberRole(db, orgId, userId, "member");
    if (!roleCheck.ok) return bad(roleCheck.error, roleCheck.status);

    const body = await readJson(request);
    if (!body) return bad("BAD_JSON", 400);

    const id = crypto.randomUUID();
    const now = Date.now();

    const pledger_name = String(body.pledger_name || "").trim();
    const pledger_email = normalizeEmail(body.pledger_email);
    const type = String(body.type || "").trim();
    const amount = String(body.amount || "").trim();
    const unit = String(body.unit || "").trim();
    const note = String(body.note || "").trim();
    const status = normStatus(body.status);
    const need_id = body.need_id ? String(body.need_id) : null;
    const is_public = body.is_public ? 1 : 0;

    await db
      .prepare(
        `INSERT INTO pledges
         (id, org_id, need_id, pledger_name, pledger_email, type, amount, unit,
          note, status, is_public, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        orgId,
        need_id,
        pledger_name,
        pledger_email,
        type,
        amount,
        unit,
        note,
        status,
        is_public,
        userId,
        now,
        now
      )
      .run();

    return json({ ok: true, pledge: { id } }, 201);
  }

  if (request.method === "PUT") {
    const roleCheck = await requireMemberRole(db, orgId, userId, "member");
    if (!roleCheck.ok) return bad(roleCheck.error, roleCheck.status);

    const body = await readJson(request);
    if (!body) return bad("BAD_JSON", 400);

    const id = String(body.id || "").trim();
    if (!id) return bad("MISSING_ID", 400);

    const now = Date.now();

    const patch = {
      need_id: body.need_id === null || body.need_id === "" ? null : body.need_id ? String(body.need_id) : undefined,
      pledger_name: body.pledger_name !== undefined ? String(body.pledger_name || "").trim() : undefined,
      pledger_email: body.pledger_email !== undefined ? normalizeEmail(body.pledger_email) : undefined,
      type: body.type !== undefined ? String(body.type || "").trim() : undefined,
      amount: body.amount !== undefined ? String(body.amount || "").trim() : undefined,
      unit: body.unit !== undefined ? String(body.unit || "").trim() : undefined,
      note: body.note !== undefined ? String(body.note || "").trim() : undefined,
      status: body.status !== undefined ? normStatus(body.status) : undefined,
      is_public: body.is_public !== undefined ? (body.is_public ? 1 : 0) : undefined,
    };

    const fields = [];
    const binds = [];

    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      fields.push(`${k} = ?`);
      binds.push(v);
    }

    fields.push("updated_at = ?");
    binds.push(now);

    if (fields.length === 1) return bad("NO_CHANGES", 400);

    // ensure pledge belongs to org
    const exists = await db
      .prepare(`SELECT id FROM pledges WHERE id = ? AND org_id = ? LIMIT 1`)
      .bind(id, orgId)
      .first();

    if (!exists?.id) return bad("NOT_FOUND", 404);

    await db
      .prepare(`UPDATE pledges SET ${fields.join(", ")} WHERE id = ? AND org_id = ?`)
      .bind(...binds, id, orgId)
      .run();

    return json({ ok: true });
  }

  if (request.method === "DELETE") {
    const roleCheck = await requireMemberRole(db, orgId, userId, "admin");
    if (!roleCheck.ok) return bad(roleCheck.error, roleCheck.status);

    const body = await readJson(request);
    if (!body) return bad("BAD_JSON", 400);

    const id = String(body.id || "").trim();
    if (!id) return bad("MISSING_ID", 400);

    await db
      .prepare(`DELETE FROM pledges WHERE id = ? AND org_id = ?`)
      .bind(id, orgId)
      .run();

    return json({ ok: true });
  }

  return bad("METHOD_NOT_ALLOWED", 405);
}
