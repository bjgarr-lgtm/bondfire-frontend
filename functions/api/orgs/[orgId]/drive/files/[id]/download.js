import { bad } from "../../../../../_lib/http.js";
import { requireOrgRole } from "../../../../../_lib/auth.js";
import { getFileRecord, loadFileBlob, bytesFromDataUrl } from "../../../../../_lib/drive.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const fileId = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;
  const file = await getFileRecord(env, orgId, fileId, { includeData: false });
  if (!file) return bad(404, "NOT_FOUND");
  const blob = await loadFileBlob(env, orgId, fileId, file.storageKey, file.mime, file.name);
  if (!blob?.dataUrl) return bad(404, "FILE_BLOB_MISSING");
  const payload = bytesFromDataUrl(blob.dataUrl);
  if (!payload) return bad(500, "INVALID_FILE_DATA");
  const url = new URL(request.url);
  const asDownload = url.searchParams.get("download") === "1";
  const headers = new Headers({
    "content-type": file.mime || payload.mime || "application/octet-stream",
    "content-length": String(payload.bytes.byteLength || 0),
    "cache-control": "private, max-age=60",
    "content-disposition": `${asDownload ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name || "download")}`,
  });
  return new Response(payload.bytes, { status: 200, headers });
}
