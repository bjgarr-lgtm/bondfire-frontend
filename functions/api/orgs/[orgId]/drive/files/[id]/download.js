import { bad } from "../../../../../_lib/http.js";
import { requireOrgRole } from "../../../../../_lib/auth.js";
import { getFileRecord, loadFileBlob, bytesFromDataUrl, getDriveBucket } from "../../../../../_lib/drive.js";

function buildCommonHeaders({ file, mime, asDownload, length, rangeHeader }) {
  const headers = new Headers({
    "content-type": mime || file.mime || "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=60",
    "content-disposition": `${asDownload ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name || "download")}`,
  });
  if (rangeHeader) {
    headers.set("content-range", rangeHeader);
  }
  if (Number.isFinite(length)) {
    headers.set("content-length", String(length));
  }
  return headers;
}

function parseRangeHeader(rangeValue, size) {
  const raw = String(rangeValue || "").trim();
  const match = raw.match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || !Number.isFinite(size) || size <= 0) return null;
  let start = match[1] === "" ? null : Number(match[1]);
  let end = match[2] === "" ? null : Number(match[2]);
  if (start === null && end === null) return null;
  if (start === null) {
    const suffix = end;
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    if (!Number.isFinite(start) || start < 0 || start >= size) return null;
    if (end === null || !Number.isFinite(end) || end >= size) end = size - 1;
    if (end < start) return null;
  }
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
  const requestedRange = request.headers.get("range");
  const bucket = getDriveBucket(env);

  if (bucket && file.storageKey) {
    if (requestedRange) {
      const parsed = parseRangeHeader(requestedRange, file.size);
      if (parsed) {
        const obj = await bucket.get(file.storageKey, { range: { offset: parsed.start, length: parsed.end - parsed.start + 1 } });
        if (obj) {
          const mime = file.mime || obj.httpMetadata?.contentType || "application/octet-stream";
          const headers = buildCommonHeaders({
            file,
            mime,
            asDownload,
            length: parsed.end - parsed.start + 1,
            rangeHeader: `bytes ${parsed.start}-${parsed.end}/${file.size}`,
          });
          return new Response(obj.body, { status: 206, headers });
        }
      }
    }

    const obj = await bucket.get(file.storageKey);
    if (obj) {
      const mime = file.mime || obj.httpMetadata?.contentType || "application/octet-stream";
      const headers = buildCommonHeaders({ file, mime, asDownload, length: file.size || obj.size || undefined });
      return new Response(obj.body, { status: 200, headers });
    }
  }

  const blob = await loadFileBlob(env, orgId, fileId, file.storageKey, file.mime, file.name);
  if (!blob?.dataUrl) return bad(404, "FILE_BLOB_MISSING");
  const payload = bytesFromDataUrl(blob.dataUrl);
  if (!payload) return bad(500, "INVALID_FILE_DATA");

  const total = payload.bytes.byteLength || 0;
  const parsed = requestedRange ? parseRangeHeader(requestedRange, total) : null;
  if (parsed) {
    const slice = payload.bytes.slice(parsed.start, parsed.end + 1);
    const headers = buildCommonHeaders({
      file,
      mime: file.mime || payload.mime || "application/octet-stream",
      asDownload,
      length: slice.byteLength,
      rangeHeader: `bytes ${parsed.start}-${parsed.end}/${total}`,
    });
    return new Response(slice, { status: 206, headers });
  }

  const headers = buildCommonHeaders({ file, mime: file.mime || payload.mime || "application/octet-stream", asDownload, length: total });
  return new Response(payload.bytes, { status: 200, headers });
}
