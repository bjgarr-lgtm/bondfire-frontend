import { bad } from "../../../../../_lib/http.js";
import { requireOrgRole } from "../../../../../_lib/auth.js";
import { getDriveBucket, getFileRecord, loadFileBlob, bytesFromDataUrl } from "../../../../../_lib/drive.js";

function buildHeaders(file, mime, size, asDownload, rangeHeader, byteRange) {
  const headers = new Headers({
    "content-type": mime || file.mime || "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=60",
    "content-disposition": `${asDownload ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name || "download")}`,
  });
  if (byteRange) {
    headers.set("content-range", `bytes ${byteRange.start}-${byteRange.end}/${size}`);
    headers.set("content-length", String(byteRange.end - byteRange.start + 1));
  } else if (Number.isFinite(size)) {
    headers.set("content-length", String(size));
  }
  return headers;
}

function parseRangeHeader(rangeHeader, size) {
  const match = String(rangeHeader || "").match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || !Number.isFinite(size) || size <= 0) return null;
  let start = match[1] === "" ? null : Number(match[1]);
  let end = match[2] === "" ? null : Number(match[2]);
  if (start === null && end === null) return null;
  if (start === null) {
    const length = end || 0;
    start = Math.max(size - length, 0);
    end = size - 1;
  } else {
    if (end === null || end >= size) end = size - 1;
  }
  if (start < 0 || start >= size || end < start) return null;
  return { start, end };
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
  const rangeHeader = request.headers.get("range") || "";
  const bucket = getDriveBucket(env);

  if (bucket && file.storageKey) {
    const byteRange = parseRangeHeader(rangeHeader, Number(file.size || 0));
    const obj = byteRange
      ? await bucket.get(file.storageKey, { range: { offset: byteRange.start, length: byteRange.end - byteRange.start + 1 } })
      : await bucket.get(file.storageKey);

    if (obj) {
      const mime = file.mime || obj.httpMetadata?.contentType || "application/octet-stream";
      const size = Number(file.size || obj.size || 0);
      const headers = buildHeaders(file, mime, size, asDownload, rangeHeader, byteRange);
      return new Response(obj.body, { status: byteRange ? 206 : 200, headers });
    }
  }

  const blob = await loadFileBlob(env, orgId, fileId, file.storageKey, file.mime, file.name);
  if (!blob?.dataUrl) return bad(404, "FILE_BLOB_MISSING");
  const payload = bytesFromDataUrl(blob.dataUrl);
  if (!payload) return bad(500, "INVALID_FILE_DATA");
  const size = payload.bytes.byteLength || 0;
  const byteRange = parseRangeHeader(rangeHeader, size);
  const body = byteRange ? payload.bytes.slice(byteRange.start, byteRange.end + 1) : payload.bytes;
  const headers = buildHeaders(file, file.mime || payload.mime || "application/octet-stream", size, asDownload, rangeHeader, byteRange);
  return new Response(body, { status: byteRange ? 206 : 200, headers });
}
