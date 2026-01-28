// functions/api/orgs/[orgId]/members.js
import { ok, bad } from "../../_lib/http";
import { getDb, requireOrgRole } from "../../_lib/auth";

const ALLOWED_ROLES = new Set(["viewer", "member", "admin", "owner"]);

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const orgId = params.orgId;

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");

  // Admins and owners can manage membership roles
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
             m.role AS role,
             m.created_at AS created_at
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
          email: r.email || "",
          name: r.name || "",
          role: r.role || "member",
          createdAt: r.created_at || null,
        })),
      });
    }

    if (request.method === "PUT") {
      let body = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }

      const userId = String(body.userId || "").trim();
      const role = String(body.role || "").trim();

      if (!userId) return bad(400, "MISSING_USER_ID");
      if (!ALLOWED_ROLES.has(role)) return bad(400, "INVALID_ROLE");

      // Only an owner can promote someone to owner
      if (role === "owner" && gate.role !== "owner") return bad(403, "OWNER_REQUIRED");

      // If demoting an owner, prevent demoting the last owner
      if (role !== "owner") {
        const target = await db
          .prepare("SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?")
          .bind(orgId, userId)
          .first();

        if (!target) return bad(404, "MEMBERSHIP_NOT_FOUND");

        if (target.role === "owner") {
          const owners = await db
            .prepare("SELECT COUNT(*) AS c FROM org_memberships WHERE org_id = ? AND role = 'owner'")
            .bind(orgId)
            .first();

          const ownerCount = Number(owners?.c || 0);
          if (ownerCount <= 1) return bad(400, "CANNOT_DEMOTE_LAST_OWNER");

          // Only an owner can demote an owner
          if (gate.role !== "owner") return bad(403, "OWNER_REQUIRED");
        }
      }

      await db
        .prepare("UPDATE org_memberships SET role = ? WHERE org_id = ? AND user_id = ?")
        .bind(role, orgId, userId)
        .run();

      return ok({ updated: true });
    }

    if (request.method === "DELETE") {
      let body = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }

      const userId = String(body.userId || "").trim();
      if (!userId) return bad(400, "MISSING_USER_ID");

      const target = await db
        .prepare("SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?")
        .bind(orgId, userId)
        .first();

      if (!target) return bad(404, "MEMBERSHIP_NOT_FOUND");

      const targetRole = String(target.role || "member");

      // Admin cannot remove an owner
      if (targetRole === "owner" && gate.role !== "owner") return bad(403, "OWNER_REQUIRED");

      // Prevent removing the last owner
      if (targetRole === "owner") {
        const owners = await db
          .prepare("SELECT COUNT(*) AS c FROM org_memberships WHERE org_id = ? AND role = 'owner'")
          .bind(orgId)
          .first();

        const ownerCount = Number(owners?.c || 0);
        if (ownerCount <= 1) return bad(400, "CANNOT_REMOVE_LAST_OWNER");
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
