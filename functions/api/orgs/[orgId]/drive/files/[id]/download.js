import { bad } from "../../../../../_lib/http.js";
import { requireOrgRole } from "../../../../../_lib/auth.js";
import { getFileRecord, loadFileBlob, bytesFromDataUrl, getDriveBucket } from "../../../../../_lib/drive.js";

function buildHeaders({ file, size, asDownload, contentRange }) {
  const headers = new Headers({
    "content-type": file.mime || "application/octet-stream",
    "cache-control": "private, max-age=60",
    "accept-ranges": "bytes",
    "content-disposition": `${asDownload ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name || "download")}`,
  });
  if (Number.isFinite(size) && size >= 0) headers.set("content-length", String(size));
  if (contentRange) headers.set("content-range", contentRange);
  return headers;
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
    try {
      if (rangeHeader) {
        const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/i);
        if (match) {
          const start = match[1] ? Number(match[1]) : undefined;
          const end = match[2] ? Number(match[2]) : undefined;
          const obj = await bucket.get(file.storageKey, { range: { offset: start, length: end !== undefined && start !== undefined ? (end - start + 1) : undefined } });
          if (obj) {
            const total = Number(obj.size || file.size || 0);
            const servedStart = Number(obj.range?.offset || 0);
            const servedEnd = servedStart + Number(obj.range?.length || 0) - 1;
            const headers = buildHeaders({ file, size: Number(obj.range?.length || 0), asDownload, contentRange: `bytes ${servedStart}-${servedEnd}/${total}` });
            return new Response(obj.body, { status: 206, headers });
          }
        }
      }

      const obj = await bucket.get(file.storageKey);
      if (obj) {
        const size = Number(obj.size || file.size || 0);
        const headers = buildHeaders({ file, size, asDownload });
        return new Response(obj.body, { status: 200, headers });
      }
    } catch {}
  }

  const blob = await loadFileBlob(env, orgId, fileId, file.storageKey, file.mime, file.name);
  if (!blob?.dataUrl) return bad(404, "FILE_BLOB_MISSING");
  const payload = bytesFromDataUrl(blob.dataUrl);
  if (!payload) return bad(500, "INVALID_FILE_DATA");
  const headers = buildHeaders({ file, size: payload.bytes.byteLength || 0, asDownload });
  return new Response(payload.bytes, { status: 200, headers });
}
