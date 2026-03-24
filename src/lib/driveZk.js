import { decryptWithOrgKey, encryptWithOrgKey, getCachedOrgKey } from './zk.js';

function ensureOrgKey(orgId) {
  const key = getCachedOrgKey(orgId);
  if (!key) throw new Error('DRIVE_ZK_KEY_MISSING');
  return key;
}

export async function encryptDriveFolder(orgId, { name }) {
  const key = ensureOrgKey(orgId);
  return encryptWithOrgKey(key, JSON.stringify({ name: String(name || 'untitled folder') }));
}

export async function decryptDriveFolder(orgId, row) {
  if (!row?.encryptedBlob) return row;
  const key = ensureOrgKey(orgId);
  const meta = JSON.parse(await decryptWithOrgKey(key, row.encryptedBlob));
  return { ...row, name: String(meta?.name || row?.name || 'untitled folder') };
}

export async function encryptDriveNote(orgId, { title, body, tags = [] }) {
  const key = ensureOrgKey(orgId);
  return encryptWithOrgKey(key, JSON.stringify({ title: String(title || 'untitled'), body: String(body || ''), tags: Array.isArray(tags) ? tags : [] }));
}

export async function decryptDriveNote(orgId, row) {
  if (!row?.encryptedBlob) return row;
  const key = ensureOrgKey(orgId);
  const meta = JSON.parse(await decryptWithOrgKey(key, row.encryptedBlob));
  return { ...row, title: String(meta?.title || row?.title || 'untitled'), body: String(meta?.body || ''), tags: Array.isArray(meta?.tags) ? meta.tags : [] };
}

export async function encryptDriveTemplate(orgId, { name, title, body }) {
  const key = ensureOrgKey(orgId);
  return encryptWithOrgKey(key, JSON.stringify({ name: String(name || 'template'), title: String(title || 'untitled'), body: String(body || '') }));
}

export async function decryptDriveTemplate(orgId, row) {
  if (!row?.encryptedBlob) return row;
  const key = ensureOrgKey(orgId);
  const meta = JSON.parse(await decryptWithOrgKey(key, row.encryptedBlob));
  return { ...row, name: String(meta?.name || row?.name || 'template'), title: String(meta?.title || row?.title || 'untitled'), body: String(meta?.body || row?.body || '') };
}

export async function encryptDriveFileMetadata(orgId, { name, mime, size }) {
  const key = ensureOrgKey(orgId);
  return encryptWithOrgKey(key, JSON.stringify({ name: String(name || 'file'), mime: String(mime || 'application/octet-stream'), size: Number(size || 0) }));
}

export async function decryptDriveFileMetadata(orgId, row) {
  if (!row?.encryptedBlob) return row;
  const key = ensureOrgKey(orgId);
  const meta = JSON.parse(await decryptWithOrgKey(key, row.encryptedBlob));
  return { ...row, name: String(meta?.name || row?.name || 'file'), mime: String(meta?.mime || row?.mime || 'application/octet-stream'), size: Number(meta?.size ?? row?.size ?? 0) };
}

export async function encryptDriveFilePayload(orgId, { name, mime, size, dataUrl, textContent = '' }) {
  const key = ensureOrgKey(orgId);
  const encryptedBlob = await encryptDriveFileMetadata(orgId, { name, mime, size });
  const encryptedPayload = await encryptWithOrgKey(
    key,
    JSON.stringify({ kind: 'drive-file', name: String(name || 'file'), mime: String(mime || 'application/octet-stream'), size: Number(size || 0), dataUrl: String(dataUrl || ''), textContent: String(textContent || '') })
  );
  return { encryptedBlob, encryptedPayload };
}

export async function decryptDriveFilePayload(orgId, file) {
  if (!file?.encryptedPayload) return file;
  const key = ensureOrgKey(orgId);
  const payload = JSON.parse(await decryptWithOrgKey(key, file.encryptedPayload));
  return {
    ...file,
    name: String(payload?.name || file?.name || 'file'),
    mime: String(payload?.mime || file?.mime || 'application/octet-stream'),
    size: Number(payload?.size ?? file?.size ?? 0),
    dataUrl: String(payload?.dataUrl || ''),
    textContent: String(payload?.textContent || ''),
  };
}
