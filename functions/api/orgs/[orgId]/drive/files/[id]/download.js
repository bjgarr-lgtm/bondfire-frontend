import { bad } from "../../../../../_lib/http.js";
import { requireOrgRole } from "../../../../../_lib/auth.js";
import { ensureDriveSchema, getDriveBucket, getDriveFileObject } from "../../../../../_lib/drive.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const id = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;
  await ensureDriveSchema(env.BF_DB);
  const row = await env.BF_DB.prepare(`SELECT name, mime, storage_key FROM drive_files WHERE org_id = ? AND id = ?`).bind(orgId, id).first();
  if (!row) return bad(404, "NOT_FOUND");
  const bucket = getDriveBucket(env);
  if (!bucket) return bad(500, "NO_DRIVE_BUCKET_BINDING");
  const obj = await getDriveFileObject(bucket, row.storage_key);
  if (!obj || !obj.body) return bad(404, "FILE_MISSING");
  const headers = new Headers();
  headers.set("content-type", row.mime || obj.httpMetadata?.contentType || "application/octet-stream");
  headers.set("content-disposition", `inline; filename="${String(row.name || "file").replace(/"/g, "")}"`);
  headers.set("cache-control", "private, max-age=60");
  return new Response(obj.body, { status: 200, headers });
}
