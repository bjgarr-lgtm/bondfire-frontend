import { ok, bad } from "../../_lib/http.js";
import { getDb, requireOrgRole } from "../../_lib/auth.js";
import { ensureZkSchema } from "../../_lib/zkSchema.js";

const ALLOWED_ROLES = new Set(["viewer", "member", "admin", "owner"]);

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function countOwners(db, orgId) {
  const row = await db
    .prepare("SELECT COUNT(*) AS c FROM org_memberships WHERE org_id = ? AND role = 'owner'")
    .bind(orgId)
    .first();
  return Number(row?.c || 0);
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const orgId = params.orgId;

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");

  // ensure additive columns exist (encrypted_blob/key_version)
  try {
    await ensureZkSchema(env);
  } catch (_) {
    // ignore, members can still work without zk columns
  }

  const gate = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!gate.ok) return gate.resp;

  try {
    if (request.method === "GET") {
      const rows = await db
        .prepare(
          `SELECT
             u.id AS user_id,
             u.email AS email,
             u.name AS name,
             u.public_key AS public_key,
             m.role AS role,
             m.created_at AS created_at,
             m.encrypted_blob AS encrypted_blob,
             m.key_version AS key_version
           FROM org_memberships m
           JOIN users u ON u.id = m.user_id
           WHERE m.org_id = ?
           ORDER BY
             CASE m.role
               WHEN 'owner' THEN 0
               WHEN 'admin' THEN 1
               WHEN 'member' THEN 2
               ELSE 3
             END,
             lower(u.email) ASC
           LIMIT 200`
        )
        .bind(orgId)
        .all();

      return ok({
        members: (rows.results || []).map((r) => ({
          userId: r.user_id,
          user_id: r.user_id,
          // email/name are returned for compatibility, but clients should prefer encrypted_blob when present.
          email: r.email || "",
          publicKey: r.public_key || null,
          public_key: r.public_key || null,
          name: r.name || "",
          role: r.role || "member",
          createdAt: r.created_at || null,
          encrypted_blob: r.encrypted_blob || null,
          key_version: r.key_version ?? null,
        })),
      });
    }

    if (request.method === "POST") {
      // Encrypt existing member contact cards (org-scoped) without changing roles.
      // Body: { updates: [{ user_id, encrypted_blob, key_version }] }
      if (gate.role !== "admin" && gate.role !== "owner") return bad(403, "INSUFFICIENT_ROLE");

      const body = await readJson(request);
      const updates = Array.isArray(body?.updates) ? body.updates : [];
      if (updates.length === 0) return ok({ updated: 0 });

      const now = Date.now();
      let n = 0;
      for (const u of updates) {
        const uid = String(u?.user_id || u?.userId || "").trim();
        const blob = u?.encrypted_blob;
        const kv = Number(u?.key_version || u?.keyVersion || 1);
        if (!uid || !blob) continue;
        await db
          .prepare(
            "UPDATE org_memberships SET encrypted_blob = ?, key_version = ? WHERE org_id = ? AND user_id = ?"
          )
          .bind(String(blob), kv, orgId, uid)
          .run();
        n++;
      }

      return ok({ updated: n, updated_at: now });
    }

    if (request.method === "PUT") {
      const body = await readJson(request);
      const userId = String(body.userId || "").trim();
      const role = String(body.role || "").trim();

      if (!userId) return bad(400, "MISSING_USER_ID");
      if (!ALLOWED_ROLES.has(role)) return bad(400, "INVALID_ROLE");

      const target = await db
        .prepare("SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?")
        .bind(orgId, userId)
        .first();

      if (!target) return bad(404, "MEMBERSHIP_NOT_FOUND");

      const targetRole = String(target.role || "member");

      if (role === "owner" && gate.role !== "owner") return bad(403, "OWNER_REQUIRED");

      if (targetRole === "owner" && role !== "owner") {
        if (gate.role !== "owner") return bad(403, "OWNER_REQUIRED");
        const owners = await countOwners(db, orgId);
        if (owners <= 1) return bad(400, "CANNOT_DEMOTE_LAST_OWNER");
      }

      await db
        .prepare("UPDATE org_memberships SET role = ? WHERE org_id = ? AND user_id = ?")
        .bind(role, orgId, userId)
        .run();

      return ok({ updated: true });
    }

    if (request.method === "DELETE") {
      const body = await readJson(request);
      const userId = String(body.userId || "").trim();
      if (!userId) return bad(400, "MISSING_USER_ID");

      const target = await db
        .prepare("SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?")
        .bind(orgId, userId)
        .first();

      if (!target) return bad(404, "MEMBERSHIP_NOT_FOUND");

      const targetRole = String(target.role || "member");

      if (targetRole === "owner") {
        if (gate.role !== "owner") return bad(403, "OWNER_REQUIRED");
        const owners = await countOwners(db, orgId);
        if (owners <= 1) return bad(400, "CANNOT_REMOVE_LAST_OWNER");
      }

      await db
        .prepare("DELETE FROM org_memberships WHERE org_id = ? AND user_id = ?")
        .bind(orgId, userId)
        .run();

      return ok({ deleted: true });
    }

    return bad(405, "METHOD_NOT_ALLOWED");
  } catch (e) {
    return bad(500, e?.message || "MEMBERS_ERROR");
  }
}
