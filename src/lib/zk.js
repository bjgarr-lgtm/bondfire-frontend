// src/lib/zk.js
import { api } from "../utils/api.js";

/*
  Pragmatic ZK v1
  - Device keypair: ECDH P-256 stored in IndexedDB (private) + public JWK in localStorage + server.
  - Org key: random 32 bytes; wrapped per member via ECDH(shared) -> HKDF -> AES-GCM.
  - Record encryption: AES-GCM with org key.
*/

const DB_NAME = "bondfire_zk";
const STORE = "keys";
const DEVICE_KEY_ID = "device_keypair_v1";
const LS_PUB = "bf_device_public_jwk_v1";
const LS_ORGKEY_CACHE_PREFIX = "bf_orgkey_cache_v1:";

// Stable-ish identifier for a device public key.
// Used for UX/debug only (detecting mismatches), not as a security primitive.
export async function kidFromJwk(jwk) {
  const s = JSON.stringify(jwk);
  const bytes = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256", bytes);
  const u8 = new Uint8Array(h);
  // short, URL-safe
  return b64(u8.slice(0, 12));
}

async function getServerPublicKey() {
  try {
    const d = await api("/api/auth/keys", { method: "GET" });
    const pk = d?.public_key;
    if (!pk) return null;
    const jwk = typeof pk === "string" ? JSON.parse(pk) : pk;
    return jwk || null;
  } catch {
    return null;
  }
}

export async function syncDevicePublicKeyToServer({ force = false } = {}) {
  const device = await ensureDeviceKeypair({ skipServerSync: true });
  const localKid = await kidFromJwk(device.pubJwk);
  const serverJwk = await getServerPublicKey();
  const serverKid = serverJwk ? await kidFromJwk(serverJwk) : null;

  const same = !!serverKid && serverKid === localKid;
  if (same && !force) return { ok: true, synced: false, localKid, serverKid };

  await api("/api/auth/keys", {
    method: "POST",
    body: JSON.stringify({ public_key: JSON.stringify(device.pubJwk) }),
  });

  return { ok: true, synced: true, localKid, serverKid };
}

function b64(bytes) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function unb64(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const st = tx.objectStore(STORE);
    const req = st.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key, val) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);
    const req = st.put(val, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function hkdfAesKey(sharedBits, saltBytes, infoStr) {
  const baseKey = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: saltBytes, info: new TextEncoder().encode(infoStr) },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function ensureDeviceKeypair({ skipServerSync = false } = {}) {
  const existing = await idbGet(DEVICE_KEY_ID);
  if (existing?.privJwk && existing?.pubJwk) {
    if (!localStorage.getItem(LS_PUB)) localStorage.setItem(LS_PUB, JSON.stringify(existing.pubJwk));
    if (!skipServerSync) {
      try {
        const localKid = await kidFromJwk(existing.pubJwk);
        const serverJwk = await getServerPublicKey();
        const serverKid = serverJwk ? await kidFromJwk(serverJwk) : null;
        if (!serverKid || serverKid !== localKid) {
          await api("/api/auth/keys", {
            method: "POST",
            body: JSON.stringify({ public_key: JSON.stringify(existing.pubJwk) }),
          });
        }
      } catch {
        // We'll surface this via explicit UI actions where needed.
      }
    }
    return existing;
  }

  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pubJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const privJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);

  await idbSet(DEVICE_KEY_ID, { pubJwk, privJwk });
  localStorage.setItem(LS_PUB, JSON.stringify(pubJwk));

  // register public key with server
  if (!skipServerSync) {
    try {
      await api("/api/auth/keys", {
        method: "POST",
        body: JSON.stringify({ public_key: JSON.stringify(pubJwk) }),
      });
    } catch {
      // If this fails, org key wrapping for this user will break until they sync.
    }
  }
  return { pubJwk, privJwk };
}

async function importPriv(privJwk) {
  return crypto.subtle.importKey("jwk", privJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
}
async function importPub(pubJwk) {
  return crypto.subtle.importKey("jwk", pubJwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
}

export async function wrapForMember(orgKeyBytes, memberPublicJwk) {
  const device = await ensureDeviceKeypair();
  const priv = await importPriv(device.privJwk);
  const pub = await importPub(memberPublicJwk);

  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const aes = await hkdfAesKey(shared, salt, "bondfire:orgkey-wrap:v1");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, orgKeyBytes);

  return JSON.stringify({ v: 1, sender_pub: device.pubJwk, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) });
}

export async function unwrapOrgKey(wrappedStr) {
  const device = await ensureDeviceKeypair();
  const priv = await importPriv(device.privJwk);

  const wrapped = JSON.parse(wrappedStr);
  const salt = unb64(wrapped.salt);
  const iv = unb64(wrapped.iv);
  const ct = unb64(wrapped.ct);

  const senderPubJwk = wrapped.sender_pub;
  if (!senderPubJwk) throw new Error("MISSING_SENDER_PUB");
  const senderPub = await importPub(senderPubJwk);

  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: senderPub }, priv, 256);
  const aes = await hkdfAesKey(shared, salt, "bondfire:orgkey-wrap:v1");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aes, ct);
  return new Uint8Array(pt);
}

export function randomOrgKey() {
  const k = new Uint8Array(32);
  crypto.getRandomValues(k);
  return k;
}

export async function encryptWithOrgKey(orgKeyBytes, plaintext) {
  const key = await crypto.subtle.importKey("raw", orgKeyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt);
  return JSON.stringify({ v: 1, iv: b64(iv), ct: b64(new Uint8Array(ct)) });
}

export async function decryptWithOrgKey(orgKeyBytes, blobStr) {
  const blob = JSON.parse(blobStr);
  const key = await crypto.subtle.importKey("raw", orgKeyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const iv = unb64(blob.iv);
  const ct = unb64(blob.ct);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// Convenience helpers for encrypting structured records.
export async function encryptJsonWithOrgKey(orgKeyBytes, obj) {
  return encryptWithOrgKey(orgKeyBytes, JSON.stringify(obj));
}

export async function decryptJsonWithOrgKey(orgKeyBytes, blobStr) {
  const s = await decryptWithOrgKey(orgKeyBytes, blobStr);
  return JSON.parse(s);
}

export function cacheOrgKey(orgId, keyBytes) {
  localStorage.setItem(LS_ORGKEY_CACHE_PREFIX + orgId, b64(keyBytes));
}

export function getCachedOrgKey(orgId) {
  const v = localStorage.getItem(LS_ORGKEY_CACHE_PREFIX + orgId);
  return v ? unb64(v) : null;
}
