import { bad } from "../../../../../_lib/http.js";
import { requireOrgRole } from "../../../../../_lib/auth.js";
import { getDriveBucket, getFileRecord, loadFileBlob, bytesFromDataUrl } from "../../../../../_lib/drive.js";

function buildCommonHeaders(file, mime, size, asDownload) {
  return new Headers({
    "content-type": mime || file?.mime || "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=60",
    "content-disposition": `${asDownload ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file?.name || "download")}`,
    ...(Number.isFinite(size) && size >= 0 ? { "content-length": String(size) } : {}),
  });
}

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const fileId = params.id;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;

  const file = await getFileRecord(env, orgId, fileId, { includeData: false });
  if (!file) return bad(404, "NOT_FOUND");

  const url = new URL(request.url);
  const asDownload = url.searchParams.get("download") === "1";
  const bucket = getDriveBucket(env);

  if (bucket && file.storageKey) {
    const range = request.headers.get("range") || undefined;
    const obj = await bucket.get(file.storageKey, range ? { range } : undefined);
    if (!obj) return bad(404, "FILE_BLOB_MISSING");

    const size = Number(obj.size ?? file.size ?? 0);
    const mime = obj.httpMetadata?.contentType || file.mime || "application/octet-stream";
    const headers = buildCommonHeaders(file, mime, size, asDownload);
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);

    if (range && obj.range && typeof obj.range.offset === 'number') {
      const start = obj.range.offset;
      const end = obj.range.offset + obj.range.length - 1;
      headers.set("content-range", `bytes ${start}-${end}/${size}`);
      headers.set("content-length", String(obj.range.length));
      return new Response(obj.body, { status: 206, headers });
    }

    return new Response(obj.body, { status: 200, headers });
  }

  const blob = await loadFileBlob(env, orgId, fileId, file.storageKey, file.mime, file.name);
  if (!blob?.dataUrl) return bad(404, "FILE_BLOB_MISSING");
  const payload = bytesFromDataUrl(blob.dataUrl);
  if (!payload) return bad(500, "INVALID_FILE_DATA");
  const headers = buildCommonHeaders(file, file.mime || payload.mime || "application/octet-stream", payload.bytes.byteLength || 0, asDownload);
  return new Response(payload.bytes, { status: 200, headers });
}
