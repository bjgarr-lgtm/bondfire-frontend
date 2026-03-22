import { now, uuid } from "./http.js";

export function getDriveBucket(env) {
  return env?.DRIVE_FILES || env?.DRIVE_R2 || env?.BF_DRIVE_FILES || env?.BF_FILES || env?.FILES_BUCKET || env?.R2 || null;
}

export function getDriveCryptoSecret(env) {
  return env?.DRIVE_CRYPTO_SECRET || env?.BF_DRIVE_CRYPTO_SECRET || env?.JWT_SECRET || "";
}

export async function encryptDriveValue(value, env) {
  return value;
}

export async function decryptDriveValue(value, env) {
  return value;
}

export function normalizeNullableString(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

export function normalizeString(value, fallback = "") {
  if (value == null) return fallback;
  return String(value);
}

export function normalizeParentId(value) {
  return normalizeNullableString(value);
}

export function normalizeTags(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map((x) => String(x || "").trim()).filter(Boolean));
  if (typeof value === "string") return value;
  if (value == null) return "[]";
  try {
    return JSON.stringify(value);
  } catch {
    return "[]";
  }
}

export function parseTags(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

export async function ensureDriveSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS drive_folders (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_drive_folders_org_parent ON drive_folders(org_id, parent_id, updated_at DESC)`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS drive_notes (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    parent_id TEXT,
    title TEXT,
    content TEXT,
    tags TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_drive_notes_org_parent ON drive_notes(org_id, parent_id, updated_at DESC)`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS drive_files (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT,
    mime TEXT,
    size INTEGER,
    storage_key TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_drive_files_org_parent ON drive_files(org_id, parent_id, updated_at DESC)`).run();
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_drive_files_storage_key ON drive_files(storage_key)`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS drive_templates (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT,
    title TEXT,
    content TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_drive_templates_org_updated ON drive_templates(org_id, updated_at DESC)`).run();
}

export async function listDriveState(db, orgId) {
  await ensureDriveSchema(db);
  const [folders, notes, files, templates] = await Promise.all([
    db.prepare(`SELECT id, org_id, parent_id, name, created_at, updated_at FROM drive_folders WHERE org_id = ? ORDER BY lower(name) ASC, created_at ASC`).bind(orgId).all(),
    db.prepare(`SELECT id, org_id, parent_id, title, content, tags, created_at, updated_at FROM drive_notes WHERE org_id = ? ORDER BY lower(title) ASC, updated_at DESC`).bind(orgId).all(),
    db.prepare(`SELECT id, org_id, parent_id, name, mime, size, storage_key, created_at, updated_at FROM drive_files WHERE org_id = ? ORDER BY lower(name) ASC, updated_at DESC`).bind(orgId).all(),
    db.prepare(`SELECT id, org_id, name, title, content, created_at, updated_at FROM drive_templates WHERE org_id = ? ORDER BY lower(name) ASC, updated_at DESC`).bind(orgId).all(),
  ]);

  return {
    folders: (folders?.results || []).map((row) => ({ ...row })),
    notes: (notes?.results || []).map((row) => ({ ...row, tags: parseTags(row.tags) })),
    files: (files?.results || []).map((row) => ({ ...row })),
    templates: (templates?.results || []).map((row) => ({ ...row })),
  };
}

export async function collectDescendantFolderIds(db, orgId, folderId) {
  const seen = new Set();
  const stack = [folderId];
  while (stack.length) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const rows = await db.prepare(`SELECT id FROM drive_folders WHERE org_id = ? AND parent_id = ?`).bind(orgId, current).all();
    for (const row of rows?.results || []) {
      if (row?.id && !seen.has(row.id)) stack.push(String(row.id));
    }
  }
  return [...seen];
}

export async function deleteDriveFolderTree(db, bucket, orgId, folderId) {
  const folderIds = await collectDescendantFolderIds(db, orgId, folderId);
  if (!folderIds.length) return { deletedFolderIds: [], deletedFileCount: 0 };

  const placeholders = folderIds.map(() => "?").join(",");
  const fileRows = await db.prepare(`SELECT storage_key FROM drive_files WHERE org_id = ? AND parent_id IN (${placeholders})`).bind(orgId, ...folderIds).all();
  for (const row of fileRows?.results || []) {
    if (bucket && row?.storage_key) {
      try { await bucket.delete(String(row.storage_key)); } catch {}
    }
  }

  await db.prepare(`DELETE FROM drive_files WHERE org_id = ? AND parent_id IN (${placeholders})`).bind(orgId, ...folderIds).run();
  await db.prepare(`DELETE FROM drive_notes WHERE org_id = ? AND parent_id IN (${placeholders})`).bind(orgId, ...folderIds).run();
  await db.prepare(`DELETE FROM drive_folders WHERE org_id = ? AND id IN (${placeholders})`).bind(orgId, ...folderIds).run();
  return { deletedFolderIds: folderIds, deletedFileCount: (fileRows?.results || []).length };
}

export async function putDriveFileObject(bucket, storageKey, bytes, options = {}) {
  if (!bucket) return;
  await bucket.put(storageKey, bytes, options);
}

export async function getDriveFileObject(bucket, storageKey) {
  if (!bucket) return null;
  return bucket.get(storageKey);
}

export function buildDriveStorageKey({ orgId, fileId, name }) {
  const safeName = String(name || "file").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `orgs/${orgId}/drive/files/${fileId}/${safeName}`;
}

export function coerceArray(value) {
  return Array.isArray(value) ? value : [];
}

export async function importDriveFileRecord({ db, bucket, orgId, item, timestamp }) {
  const id = normalizeNullableString(item?.id) || uuid();
  const name = normalizeString(item?.name || item?.title || "uploaded-file");
  const mime = normalizeString(item?.mime || item?.type || "application/octet-stream");
  const parentId = normalizeParentId(item?.parent_id ?? item?.parentId ?? null);
  const fileBytes = await decodeImportedFileBytes(item);
  const storageKey = buildDriveStorageKey({ orgId, fileId: id, name });
  if (fileBytes && bucket) {
    await putDriveFileObject(bucket, storageKey, fileBytes, { httpMetadata: { contentType: mime } });
  }
  const size = Number.isFinite(Number(item?.size)) ? Number(item.size) : (fileBytes ? fileBytes.byteLength : 0);
  await db.prepare(`INSERT OR REPLACE INTO drive_files (id, org_id, parent_id, name, mime, size, storage_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id,
    orgId,
    parentId,
    name,
    mime,
    size,
    storageKey,
    Number(item?.created_at || item?.createdAt || timestamp),
    Number(item?.updated_at || item?.updatedAt || timestamp)
  ).run();
  return id;
}

export async function decodeImportedFileBytes(item) {
  const base64 = typeof item?.base64 === "string" ? item.base64 : "";
  const dataUrl = typeof item?.dataUrl === "string" ? item.dataUrl : "";
  const textContent = item?.textContent;
  if (base64) return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (dataUrl) {
    const idx = dataUrl.indexOf(",");
    if (idx >= 0) {
      const payload = dataUrl.slice(idx + 1);
      return Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    }
  }
  if (typeof textContent === "string") {
    return new TextEncoder().encode(textContent);
  }
  return null;
}
