import { bad, ok, readJSON, now } from "../../_lib/http.js";
async function getOrgIdBySlug(env, slug) {
  const s = String(slug || "").trim();
  if (!s) return null;
  const orgId = await env.BF_PUBLIC.get(`slug:${s}`);
  return orgId || null;
}import { getDB } from "../../_bf.js";

function clean(v, max = 2000) {
  return String(v || "").trim().slice(0, max);
}

function normKind(v) {
  const s = String(v || "").trim().toLowerCase();
  if (["get_help", "volunteer", "offer_resources", "inventory_request"].includes(s)) return s;
  return "";
}

async function ensureTable(db) {
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
}

export async function onRequestPost({ env, params, request }) {
  const slug = String(params?.slug || "").trim();
  if (!slug) return bad(400, "MISSING_SLUG");

  const orgId = await getOrgIdBySlug(env, slug);
  if (!orgId) return bad(404, "NOT_FOUND");

  const db = getDB(env);
  if (!db) return bad(500, "DB_NOT_CONFIGURED");
  await ensureTable(db);

  const body = await readJSON(request);
  const kind = normKind(body?.kind);
  if (!kind) return bad(400, "BAD_KIND");

  const id = crypto.randomUUID();
  const created = now();
  await db.prepare(`INSERT INTO public_intakes (
    id, org_id, kind, name, contact, details, extra, status, created_at, updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(
    id,
    orgId,
    kind,
    clean(body?.name, 160),
    clean(body?.contact, 220),
    clean(body?.details, 4000),
    clean(body?.extra, 4000),
    "new",
    created,
    created,
  ).run();

  return ok({ id, kind, saved: true });
}
