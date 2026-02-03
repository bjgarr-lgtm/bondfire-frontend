import { bad, ok } from "../../_lib/http.js";
import { getDb } from "../../_lib/auth.js";
import { getOrgIdBySlug } from "../../_lib/publicPageStore.js";

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
  const amount = coerceStr(body.amount || "");
  const unit = coerceStr(body.unit || "");
  const note = coerceStr(body.note || body.message || "");

  if (!type && !note) return bad(400, "Missing pledge type or note");

  const titleParts = [];
  if (type) titleParts.push(type);
  if (amount) titleParts.push(amount);
  const title = titleParts.join(" ").trim() || "Pledge";

  const contactParts = [];
  if (pledgerName) contactParts.push(pledgerName);
  if (pledgerEmail) contactParts.push(pledgerEmail);
  const contact = contactParts.join(" ").trim() || null;

  const db = getDb(context.env);

  const pledge = {
    id: crypto.randomUUID(),
    org_id: orgId,
    need_id: needId || null,
    title,
    description: note || null,
    qty: amount || null,
    unit: unit || null,
    contact,
    is_public: 1,
    created_at: Date.now(),
  };

  await db
    .prepare(
      `INSERT INTO pledges (id, org_id, need_id, title, description, qty, unit, contact, is_public, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      pledge.created_at
    )
    .run();

  return ok({ pledge });
}
