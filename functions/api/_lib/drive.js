import { bad, json, now, uuid } from "./http.js";

function getDb(env) {
  return env?.BF_DB || env?.DB || env?.db || null;
}

export function getDriveBucket(env) {
  return env?.BF_DRIVE_BUCKET || env?.DRIVE_BUCKET || env?.BOND_FIRE_DRIVE_BUCKET || null;
}

async function ensureColumn(db, table, name, definition) {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all();
  const rows = info?.results || [];
  if (!rows.some((row) => String(row.name || "").toLowerCase() === String(name).toLowerCase())) {
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
  }
}

export async function ensureDriveSchema(env) {
  const db = getDb(env);
  if (!db) throw new Error("NO_DB_BINDING");
  if (env.__bfDriveSchemaReady) return;

  const statements = [
    "CREATE TABLE IF NOT EXISTS drive_folders (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, parent_id TEXT, name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_drive_folders_org_parent ON drive_folders(org_id, parent_id, updated_at)",
    "CREATE TABLE IF NOT EXISTS drive_notes (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, parent_id TEXT, title TEXT, content TEXT, tags TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_drive_notes_org_parent ON drive_notes(org_id, parent_id, updated_at)",
    "CREATE TABLE IF NOT EXISTS drive_files (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, parent_id TEXT, name TEXT, mime TEXT, size INTEGER, storage_key TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_drive_files_org_parent ON drive_files(org_id, parent_id, updated_at)",
    "CREATE TABLE IF NOT EXISTS drive_templates (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT, title TEXT, content TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_drive_templates_org ON drive_templates(org_id, updated_at)",
    "CREATE TABLE IF NOT EXISTS drive_file_blobs (file_id TEXT PRIMARY KEY, org_id TEXT NOT NULL, mime TEXT, data_url TEXT, text_content TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_drive_file_blobs_org ON drive_file_blobs(org_id, updated_at)",
  ];

  for (const sql of statements) await db.prepare(sql).run();

  await ensureColumn(db, "drive_folders", "encrypted_blob", "TEXT");
  await ensureColumn(db, "drive_notes", "encrypted_blob", "TEXT");
  await ensureColumn(db, "drive_templates", "encrypted_blob", "TEXT");
  await ensureColumn(db, "drive_files", "encrypted_blob", "TEXT");
  await ensureColumn(db, "drive_files", "encrypted", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "drive_file_blobs", "encrypted", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "drive_file_blobs", "encrypted_payload", "TEXT");

  env.__bfDriveSchemaReady = true;
}

export function encrypt(data) { return data; }
export function decrypt(data) { return data; }

export function normalizeNullableId(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

export function parseTags(value) {
  if (Array.isArray(value)) return value.map((x) => String(x || "").trim()).filter(Boolean);
  return String(value || "").split(",").map((x) => x.trim()).filter(Boolean);
}

export function splitDataUrl(dataUrl) {
  const raw = String(dataUrl || "");
  const match = raw.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/i);
  if (!match) return null;
  return { mime: match[1] || "application/octet-stream", base64: match[2] || "" };
}

export function bytesFromDataUrl(dataUrl) {
  const parts = splitDataUrl(dataUrl);
  if (!parts) return null;
  const bin = atob(parts.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return { mime: parts.mime, bytes };
}

export function dataUrlFromBytes(bytes, mime) {
  let bin = "";
  const chunk = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  for (let i = 0; i < chunk.length; i += 1) bin += String.fromCharCode(chunk[i]);
  return `data:${String(mime || "application/octet-stream")};base64,${btoa(bin)}`;
}

export function textFromBytes(bytes) {
  try { return new TextDecoder().decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || [])); } catch { return ""; }
}

export function isEditableTextMime(mime, name = "") {
  const safeMime = String(mime || "").toLowerCase();
  const safeName = String(name || "").toLowerCase();
  if (safeMime.startsWith("text/")) return true;
  return [".md", ".markdown", ".txt", ".json", ".js", ".jsx", ".ts", ".tsx", ".css", ".html", ".xml", ".yaml", ".yml", ".csv", ".bfsheet", ".bfform"].some((ext) => safeName.endsWith(ext));
}

export function buildDriveFileUrls(orgId, fileId) {
  const encodedOrgId = encodeURIComponent(String(orgId || ""));
  const encodedFileId = encodeURIComponent(String(fileId || ""));
  const base = `/api/orgs/${encodedOrgId}/drive/files/${encodedFileId}/download`;
  return { previewUrl: base, downloadUrl: `${base}?download=1`, url: base };
}

function placeholderName(kind) {
  return kind === "folder" ? "encrypted folder" : kind === "template" ? "encrypted template" : kind === "note" ? "encrypted note" : "encrypted file";
}

export async function listDriveTree(env, orgId) {
  await ensureDriveSchema(env);
  const db = getDb(env);
  const [foldersRes, notesRes, filesRes, templatesRes] = await Promise.all([
    db.prepare(`SELECT id, parent_id, name, encrypted_blob, created_at, updated_at FROM drive_folders WHERE org_id = ? ORDER BY LOWER(name) ASC, created_at ASC`).bind(orgId).all(),
    db.prepare(`SELECT id, parent_id, title, content, tags, encrypted_blob, created_at, updated_at FROM drive_notes WHERE org_id = ? ORDER BY updated_at DESC, created_at DESC`).bind(orgId).all(),
    db.prepare(`SELECT id, parent_id, name, mime, size, storage_key, encrypted, encrypted_blob, created_at, updated_at FROM drive_files WHERE org_id = ? ORDER BY LOWER(name) ASC, created_at ASC`).bind(orgId).all(),
    db.prepare(`SELECT id, name, title, content, encrypted_blob, created_at, updated_at FROM drive_templates WHERE org_id = ? ORDER BY updated_at DESC, created_at DESC`).bind(orgId).all(),
  ]);

  return {
    folders: (foldersRes.results || []).map((row) => ({
      id: row.id,
      parentId: row.parent_id || null,
      name: row.encrypted_blob ? placeholderName("folder") : row.name || "untitled folder",
      encryptedBlob: row.encrypted_blob || "",
      createdAt: Number(row.created_at || 0),
      updatedAt: Number(row.updated_at || 0),
    })),
    notes: (notesRes.results || []).map((row) => ({
      id: row.id,
      parentId: row.parent_id || null,
      title: row.encrypted_blob ? placeholderName("note") : row.title || "untitled",
      body: row.encrypted_blob ? "" : decrypt(row.content || ""),
      tags: row.encrypted_blob ? [] : parseTags(row.tags),
      encryptedBlob: row.encrypted_blob || "",
      createdAt: Number(row.created_at || 0),
      updatedAt: Number(row.updated_at || 0),
    })),
    files: (filesRes.results || []).map((row) => ({
      id: row.id,
      parentId: row.parent_id || null,
      name: row.encrypted_blob ? placeholderName("file") : row.name || "file",
      mime: row.encrypted_blob ? "application/octet-stream" : row.mime || "application/octet-stream",
      size: Number(row.size || 0),
      encrypted: Number(row.encrypted || 0) === 1,
      encryptedBlob: row.encrypted_blob || "",
      storageKey: row.storage_key || null,
      createdAt: Number(row.created_at || 0),
      updatedAt: Number(row.updated_at || 0),
      ...buildDriveFileUrls(orgId, row.id),
    })),
    templates: (templatesRes.results || []).map((row) => ({
      id: row.id,
      name: row.encrypted_blob ? placeholderName("template") : row.name || "template",
      title: row.encrypted_blob ? placeholderName("template") : row.title || "untitled",
      body: row.encrypted_blob ? "" : decrypt(row.content || ""),
      encryptedBlob: row.encrypted_blob || "",
      createdAt: Number(row.created_at || 0),
      updatedAt: Number(row.updated_at || 0),
    })),
  };
}

export async function getFileRecord(env, orgId, fileId, { includeData = false } = {}) {
  await ensureDriveSchema(env);
  const db = getDb(env);
  const row = await db.prepare(
    `SELECT id, parent_id, name, mime, size, storage_key, encrypted, encrypted_blob, created_at, updated_at FROM drive_files WHERE org_id = ? AND id = ?`
  ).bind(orgId, fileId).first();
  if (!row) return null;
  const file = {
    id: row.id,
    parentId: row.parent_id || null,
    name: row.encrypted_blob ? placeholderName("file") : row.name || "file",
    mime: row.encrypted_blob ? "application/octet-stream" : row.mime || "application/octet-stream",
    size: Number(row.size || 0),
    encrypted: Number(row.encrypted || 0) === 1,
    encryptedBlob: row.encrypted_blob || "",
    storageKey: row.storage_key || null,
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
    ...buildDriveFileUrls(orgId, row.id),
  };
  if (!includeData) return file;
  const blob = await loadFileBlob(env, orgId, row.id, row.storage_key, file.mime, file.name, file.encrypted);
  return { ...file, dataUrl: blob?.dataUrl || "", textContent: blob?.textContent || "", encryptedPayload: blob?.encryptedPayload || "" };
}

export async function loadFileBlob(env, orgId, fileId, storageKey, mime, name = "", isEncrypted = false) {
  await ensureDriveSchema(env);
  const bucket = getDriveBucket(env);
  if (bucket && storageKey) {
    const obj = await bucket.get(storageKey);
    if (obj) {
      const arr = new Uint8Array(await obj.arrayBuffer());
      if (isEncrypted) {
        return { encryptedPayload: textFromBytes(arr), dataUrl: "", textContent: "" };
      }
      return {
        dataUrl: dataUrlFromBytes(arr, mime || obj.httpMetadata?.contentType || "application/octet-stream"),
        textContent: isEditableTextMime(mime || obj.httpMetadata?.contentType, name) ? textFromBytes(arr) : "",
        encryptedPayload: "",
      };
    }
  }
  const db = getDb(env);
  const row = await db.prepare(
    `SELECT data_url, text_content, mime, encrypted, encrypted_payload FROM drive_file_blobs WHERE org_id = ? AND file_id = ?`
  ).bind(orgId, fileId).first();
  if (!row) return null;
  if (Number(row.encrypted || 0) === 1 || isEncrypted) {
    return { encryptedPayload: row.encrypted_payload || "", dataUrl: "", textContent: "", mime: row.mime || mime || "application/octet-stream" };
  }
  return { dataUrl: row.data_url || "", textContent: decrypt(row.text_content || ""), mime: row.mime || mime || "application/octet-stream", encryptedPayload: "" };
}

export async function saveFileBlob(env, { orgId, fileId, storageKey, mime, dataUrl, textContent, encryptedPayload, encrypted = false }) {
  await ensureDriveSchema(env);
  const bucket = getDriveBucket(env);
  const t = now();
  if (bucket && storageKey) {
    if (encrypted) {
      const bytes = new TextEncoder().encode(String(encryptedPayload || ""));
      await bucket.put(storageKey, bytes, { httpMetadata: { contentType: "application/octet-stream" } });
    } else {
      const payload = bytesFromDataUrl(dataUrl || "");
      if (!payload) throw new Error("INVALID_DATA_URL");
      await bucket.put(storageKey, payload.bytes, { httpMetadata: { contentType: mime || payload.mime || "application/octet-stream" } });
    }
    const db = getDb(env);
    await db.prepare(`DELETE FROM drive_file_blobs WHERE org_id = ? AND file_id = ?`).bind(orgId, fileId).run();
    return;
  }
  const db = getDb(env);
  await db.prepare(
    `INSERT INTO drive_file_blobs (file_id, org_id, mime, data_url, text_content, encrypted_payload, encrypted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(file_id)
     DO UPDATE SET mime = excluded.mime,
                   data_url = excluded.data_url,
                   text_content = excluded.text_content,
                   encrypted_payload = excluded.encrypted_payload,
                   encrypted = excluded.encrypted,
                   updated_at = excluded.updated_at`
  ).bind(fileId, orgId, mime || "application/octet-stream", encrypted ? "" : dataUrl || "", encrypted ? "" : encrypt(textContent || ""), encrypted ? String(encryptedPayload || "") : "", encrypted ? 1 : 0, t, t).run();
}

export async function deleteFileBlob(env, { orgId, fileId, storageKey }) {
  await ensureDriveSchema(env);
  const bucket = getDriveBucket(env);
  if (bucket && storageKey) { try { await bucket.delete(storageKey); } catch {} }
  const db = getDb(env);
  await db.prepare(`DELETE FROM drive_file_blobs WHERE org_id = ? AND file_id = ?`).bind(orgId, fileId).run();
}

export function created(name, entity) { return json({ ok: true, id: entity?.id || null, [name]: entity || null }); }
export { getDb, bad, json, now, uuid };
