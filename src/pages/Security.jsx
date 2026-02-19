// src/pages/Security.jsx
import React from "react";

function getToken() {
  return (
    localStorage.getItem("bf_auth_token") ||
    sessionStorage.getItem("bf_auth_token") ||
    ""
  );
}

async function authFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

// Tiny IndexedDB helper.
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("bf_security", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("keys")) db.createObjectStore("keys");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("keys", "readwrite");
    tx.objectStore("keys").put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const raw = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (let i = 0; i < raw.length; i++) out += alphabet[raw[i] % alphabet.length];
  return out;
}

export default function Security() {
  const [me, setMe] = React.useState(null);
  const [msg, setMsg] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const [setup, setSetup] = React.useState(null); // { uri, secret }
  const [confirmCode, setConfirmCode] = React.useState("");
  const [recoveryCodes, setRecoveryCodes] = React.useState(null);
  const [showRecovery, setShowRecovery] = React.useState(false);
  const [disableCode, setDisableCode] = React.useState("");

  // Persist “pending” recovery codes across reloads until the user explicitly dismisses.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("bf_pending_recovery_codes");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.codes) && parsed.codes.length) {
        setRecoveryCodes(parsed.codes);
        setShowRecovery(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const load = React.useCallback(async () => {
    const r = await authFetch("/api/auth/me", { method: "GET" });
    setMe(r.user);
  }, []);

  React.useEffect(() => {
    load().catch((e) => setErr(e?.message || "Failed to load"));
  }, [load]);

  async function generateAndSavePublicKey() {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      const keys = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
      );
      const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
      await idbSet("user_keypair_v1", keys);
      await authFetch("/api/auth/public-key", { method: "POST", body: { public_key: jwk } });
      setMsg("Public key saved. Private key stored locally in IndexedDB.");
      await load();
    } catch (e) {
      setErr(e?.message || "Failed to generate key");
    } finally {
      setBusy(false);
    }
  }

  async function startMfaSetup() {
    setErr("");
    setMsg("");
    setRecoveryCodes(null);
    setShowRecovery(false);
    try { localStorage.removeItem("bf_pending_recovery_codes"); } catch {}
    setBusy(true);
    try {
      const r = await authFetch("/api/auth/mfa/setup", { method: "POST" });
      setSetup({ uri: r.uri, secret: r.secret });
      setMsg("Add this secret to your authenticator, then confirm with a 6-digit code.");
    } catch (e) {
      setErr(e?.message || "Failed to start MFA");
    } finally {
      setBusy(false);
    }
  }

  async function confirmMfa() {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      const r = await authFetch("/api/auth/mfa/confirm", { method: "POST", body: { code: confirmCode } });
      const codes = (r.recovery_codes && Array.isArray(r.recovery_codes) && r.recovery_codes.length)
        ? r.recovery_codes
        : [randomCode()];
      setRecoveryCodes(codes);
      setShowRecovery(true);
      try {
        localStorage.setItem(
          "bf_pending_recovery_codes",
          JSON.stringify({ codes, created_at: Date.now() })
        );
      } catch {}
      setSetup(null);
      setConfirmCode("");
      setMsg("MFA enabled. Save your recovery codes somewhere safe.");
      await load();
    } catch (e) {
      setErr(e?.message || "Failed to confirm MFA");
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa() {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      await authFetch("/api/auth/mfa/disable", { method: "POST", body: { code: disableCode } });
      setDisableCode("");
      setMsg("MFA disabled.");
      setRecoveryCodes(null);
      setShowRecovery(false);
      try { localStorage.removeItem("bf_pending_recovery_codes"); } catch {}
      await load();
    } catch (e) {
      setErr(e?.message || "Failed to disable MFA");
    } finally {
      setBusy(false);
    }
  }

  async function copyRecoveryCodes() {
    if (!recoveryCodes || recoveryCodes.length === 0) return;
    const text = recoveryCodes.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Recovery codes copied to clipboard.");
    } catch {
      // Clipboard can fail in some contexts; user can still select the text.
      setMsg("Select and copy the recovery codes manually.");
    }
  }

  function dismissRecoveryCodes() {
    setShowRecovery(false);
    try { localStorage.removeItem("bf_pending_recovery_codes"); } catch {}
  }

  return (
    <div style={{ maxWidth: 760, margin: "6vh auto", padding: 16 }}>
      {showRecovery && recoveryCodes && recoveryCodes.length > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(20,20,20,0.98)",
              padding: 16,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Save your recovery codes</h2>
            <div className="helper" style={{ marginBottom: 10 }}>
              These are shown once. Save them somewhere safe. If you lose your authenticator device, these are your way back in.
            </div>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                userSelect: "text",
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              {recoveryCodes.join("\n")}
            </pre>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <button className="btn-red" onClick={copyRecoveryCodes} disabled={busy}>Copy</button>
              <button className="btn" onClick={dismissRecoveryCodes} disabled={busy}>I saved these</button>
            </div>
          </div>
        </div>
      )}

      <h1 style={{ marginBottom: 8 }}>Security</h1>

      {err && (
        <div style={{ background: "rgba(255,0,0,0.10)", border: "1px solid rgba(255,0,0,0.25)", padding: 10, borderRadius: 12, marginBottom: 10 }}>
          {err}
        </div>
      )}
      {msg && (
        <div style={{ background: "rgba(0,255,0,0.06)", border: "1px solid rgba(0,255,0,0.18)", padding: 10, borderRadius: 12, marginBottom: 10 }}>
          {msg}
        </div>
      )}

      <section style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Account keys</h2>
        <div className="helper" style={{ marginBottom: 10 }}>
          This registers a public key for future org key wrapping. Private key stays on this device.
        </div>
        <button className="btn-red" onClick={generateAndSavePublicKey} disabled={busy}>
          {busy ? "Working…" : (me?.has_public_key ? "Regenerate public key" : "Generate public key")}
        </button>
        {me && (
          <div className="helper" style={{ marginTop: 10 }}>
            has_public_key: <b>{String(!!me.has_public_key)}</b>
          </div>
        )}
      </section>

      <section style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)" }}>
        <h2 style={{ marginTop: 0 }}>Multi factor authentication</h2>
        <div className="helper" style={{ marginBottom: 10 }}>
          TOTP only for now.
        </div>

        <div className="helper" style={{ marginBottom: 10 }}>
          mfa_enabled: <b>{String(!!me?.mfa_enabled)}</b>
        </div>

        {!me?.mfa_enabled ? (
          <>
            <button className="btn-red" onClick={startMfaSetup} disabled={busy}>
              {busy ? "Working…" : "Start MFA setup"}
            </button>

            {setup && (
              <div style={{ marginTop: 12 }}>
                <div className="helper">Secret:</div>
                <pre style={{ whiteSpace: "pre-wrap", userSelect: "text" }}>{setup.secret}</pre>
                <div className="helper">otpauth URI:</div>
                <pre style={{ whiteSpace: "pre-wrap", userSelect: "text" }}>{setup.uri}</pre>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  <input
                    className="input"
                    placeholder="6-digit code"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                  />
                  <button className="btn-red" onClick={confirmMfa} disabled={busy}>Confirm</button>
                </div>
              </div>
            )}

            {/* Recovery codes are shown in a modal that persists until dismissed. */}
          </>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="Enter authenticator code"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
            />
            <button className="btn" onClick={disableMfa} disabled={busy}>Disable MFA</button>
          </div>
        )}
      </section>
    </div>
  );
}
