// functions/api/_lib/crypto.js
// Worker-compatible helpers (no Node APIs).
// - Base32 (RFC 4648) decode/encode
// - TOTP verify (RFC 6238) using HMAC-SHA1
// - AES-GCM encrypt/decrypt for small secrets (like TOTP secret) at rest
// - sha256Hex helper

const B32_ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function randomBase32(bytes = 20) {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return base32Encode(raw);
}

export function base32Encode(u8) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < u8.length; i++) {
    value = (value << 8) | u8[i];
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPH[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPH[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const s = String(str || "").trim().replace(/=+$/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const idx = B32_ALPH.indexOf(s[i]);
    if (idx === -1) continue; // ignore whitespace/invalid
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function utf8(s) {
  return new TextEncoder().encode(String(s));
}

async function importAesKey(keyMaterial) {
  const hash = await crypto.subtle.digest("SHA-256", utf8(keyMaterial));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function aesGcmEncrypt(keyMaterial, plaintext) {
  // Returns base64(iv || ciphertext)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importAesKey(keyMaterial);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8(plaintext));
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return b64(out);
}

export async function aesGcmDecrypt(keyMaterial, payloadB64) {
  const raw = fromB64(payloadB64);
  if (raw.length < 13) throw new Error("BAD_PAYLOAD");
  const iv = raw.slice(0, 12);
  const ct = raw.slice(12);
  const key = await importAesKey(keyMaterial);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

export async function sha256Hex(input) {
  const buf = await crypto.subtle.digest("SHA-256", utf8(input));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function b64(u8) {
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}

function fromB64(s) {
  const bin = atob(String(s || ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha1(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
  return new Uint8Array(sig);
}

function counterBytes(counter) {
  const out = new Uint8Array(8);
  let x = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

function dt(sig) {
  const offset = sig[sig.length - 1] & 0x0f;
  const p = ((sig[offset] & 0x7f) << 24) |
            ((sig[offset + 1] & 0xff) << 16) |
            ((sig[offset + 2] & 0xff) << 8) |
            (sig[offset + 3] & 0xff);
  return p >>> 0;
}

export async function totpVerify(base32Secret, code, { step = 30, digits = 6, window = 1, now = Date.now() } = {}) {
  const secret = base32Decode(base32Secret);
  const c = String(code || "").replace(/\s+/g, "");
  if (!/^\d+$/.test(c)) return false;

  const t = Math.floor(now / 1000 / step);

  for (let w = -window; w <= window; w++) {
    const ctr = counterBytes(t + w);
    const sig = await hmacSha1(secret, ctr);
    const bin = dt(sig);
    const otp = String(bin % (10 ** digits)).padStart(digits, "0");
    if (otp === c) return true;
  }
  return false;
}
