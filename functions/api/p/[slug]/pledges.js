import { bad, ok } from "../../_lib/http.js";
import { getDB } from "../../_bf.js";
import { getOrgIdBySlug } from "../../_lib/publicPageStore.js";

async function ensurePledgesTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS pledges (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      need_id TEXT NULL,
      title TEXT NOT NULL,
      description TEXT NULL,
      qty REAL NULL,
      unit TEXT NULL,
      contact TEXT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_pledges_org_created
     ON pledges(org_id, created_at DESC)`
  ).run();
}



function coerceStr(v) {
  return v == null ? "" : String(v).trim();
}

export async function onRequestPost(context) {
  const slug = context?.params?.slug ? String(context.params.slug) : "";
  if (!slug) return bad(400, "Missing slug");

  const orgId = await getOrgIdBySlug(context.env, slug);
  if (!orgId) return bad(404, "Not found");

  let body = {};
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }

  const needId = coerceStr(body.need_id || body.needId || "");
  const pledgerName = coerceStr(body.pledger_name || body.name || "");
  const pledgerEmail = coerceStr(body.pledger_email || body.email || "");
  const type = coerceStr(body.type || "");
  const amountRaw = coerceStr(body.amount || "");
  const amount = amountRaw === "" ? null : Number(amountRaw);
  const unit = coerceStr(body.unit || "");
  const note = coerceStr(body.note || body.message || "");

  // Allow lightweight pledges. Only reject truly empty submissions.
  if (!type && !note && !amount && !unit) {
    return bad(400, "Missing pledge details");
  }

  const titleParts = [];
  if (type) titleParts.push(type);
  if (amount != null && !Number.isNaN(amount)) titleParts.push(String(amount));
  const title = titleParts.join(" ").trim() || "Pledge";

  const contactParts = [];
  if (pledgerName) contactParts.push(pledgerName);
  if (pledgerEmail) contactParts.push(pledgerEmail);
  const contact = contactParts.join(" ").trim() || null;

  const db = getDB(context.env);
  if (!db) return bad(500, "DB_NOT_CONFIGURED");

  await ensurePledgesTable(db);

  const now = Date.now();
  const pledge = {
    id: crypto.randomUUID(),
    org_id: orgId,
    need_id: needId || null,
    title,
    description: note || null,
    qty: amount == null || Number.isNaN(amount) ? null : amount,
    unit: unit || null,
    contact,
    is_public: 1,
    created_at: now,
    updated_at: now,
  };

  await db
    .prepare(
      `INSERT INTO pledges (id, org_id, need_id, title, description, qty, unit, contact, is_public, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      pledge.id,
      pledge.org_id,
      pledge.need_id,
      pledge.title,
      pledge.description,
      pledge.qty,
      pledge.unit,
      pledge.contact,
      pledge.is_public,
      pledge.created_at,
      pledge.updated_at
    )
    .run();

  return ok({ pledge });
}