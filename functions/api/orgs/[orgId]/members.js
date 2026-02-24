import { ok, bad } from "../../_lib/http.js";
import { getDb, requireOrgRole } from "../../_lib/auth.js";
import { ensureZkSchema } from "../../_lib/zk.js";

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

  // Ensure ZK-related columns exist (safe/no-op if already applied).
  await ensureZkSchema(db);

  const gate = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!gate.ok) return gate.resp;

  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const allowPlaintext = (url.searchParams.get("plaintext") || "") === "1";

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
        members: (rows.results || []).map((r) => {
          const hasEnc = !!r.encrypted_blob;
          return {
            userId: r.user_id,
            user_id: r.user_id,
            // Default: do not ship plaintext PII.
            // For one-time backfill/encrypt-existing, caller can use ?plaintext=1.
            email: allowPlaintext ? (r.email || "") : (hasEnc ? "__encrypted__" : ""),
            publicKey: r.public_key || null,
            public_key: r.public_key || null,
            name: allowPlaintext ? (r.name || "") : (hasEnc ? "__encrypted__" : ""),
            role: r.role || "member",
            createdAt: r.created_at || null,
            encrypted_blob: r.encrypted_blob || null,
            key_version: r.key_version ?? null,
            needs_encryption: !hasEnc,
          };
        }),
      });
    }

    if (request.method === "PUT") {
      const body = await readJson(request);
      const userId = String(body.userId || "").trim();
      const role = String(body.role || "").trim();
      const encryptedBlob = body.encrypted_blob ? String(body.encrypted_blob) : "";
      const keyVersion = body.key_version != null ? Number(body.key_version) : null;

      if (!userId) return bad(400, "MISSING_USER_ID");

      const hasRoleUpdate = !!role;
      const hasZkUpdate = !!encryptedBlob;
      if (!hasRoleUpdate && !hasZkUpdate) return bad(400, "MISSING_UPDATE");
      if (hasRoleUpdate && !ALLOWED_ROLES.has(role)) return bad(400, "INVALID_ROLE");

      const target = await db
        .prepare("SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?")
        .bind(orgId, userId)
        .first();

      if (!target) return bad(404, "MEMBERSHIP_NOT_FOUND");

      const targetRole = String(target.role || "member");

      if (hasRoleUpdate) {
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
      }

      if (hasZkUpdate) {
        await db
          .prepare(
            "UPDATE org_memberships SET encrypted_blob = ?, key_version = COALESCE(?, key_version) WHERE org_id = ? AND user_id = ?"
          )
          .bind(encryptedBlob, keyVersion, orgId, userId)
          .run();
      }

      return ok({ updated: true, updated_role: hasRoleUpdate, updated_zk: hasZkUpdate });
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
