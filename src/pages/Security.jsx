import React from "react";
import { useParams } from "react-router-dom";
import { api } from "../utils/api.js";
import {
  ensureDeviceKeypair,
  randomOrgKey,
  wrapForMember,
  unwrapOrgKey,
  cacheOrgKey,
  getCachedOrgKey,
} from "../lib/zk.js";

export default function Security() {
  const { orgId } = useParams();

  const [msg, setMsg] = React.useState("");
  const [mfaSecret, setMfaSecret] = React.useState("");
  const [mfaQr, setMfaQr] = React.useState("");
  const [mfaCode, setMfaCode] = React.useState("");
  const [recoveryCodes, setRecoveryCodes] = React.useState([]);
  const [showRecovery, setShowRecovery] = React.useState(false);

  const [zkStatus, setZkStatus] = React.useState({ deviceKey: false, orgKey: false });

  React.useEffect(() => {
    (async () => {
      const orgKey = getCachedOrgKey(orgId);
      setZkStatus((s) => ({ ...s, orgKey: !!orgKey }));
      try {
        const dev = await ensureDeviceKeypair();
        setZkStatus((s) => ({ ...s, deviceKey: !!dev?.pubJwk }));
      } catch {}
    })();
  }, [orgId]);

  async function startMfa() {
    setMsg("");
    try {
      const d = await api("/api/auth/mfa/setup", { method: "POST", body: JSON.stringify({}) });
      setMfaSecret(d.secret || "");
      setMfaQr(d.otpauth_url || "");
      setRecoveryCodes(d.recovery_codes || []);
      setShowRecovery(true);
    } catch (e) {
      setMsg(e.message || "failed");
    }
  }

  async function confirmMfa() {
    setMsg("");
    try {
      const d = await api("/api/auth/mfa/confirm", {
        method: "POST",
        body: JSON.stringify({ code: mfaCode }),
      });
      setRecoveryCodes(d.recovery_codes || []);
      setShowRecovery(true);
      setMsg("mfa enabled");
    } catch (e) {
      setMsg(e.message || "failed");
    }
  }

  async function disableMfa() {
    setMsg("");
    try {
      await api("/api/auth/mfa/disable", {
        method: "POST",
        body: JSON.stringify({ code: mfaCode }),
      });
      setMsg("mfa disabled");
    } catch (e) {
      setMsg(e.message || "failed");
    }
  }

  async function enableZkForOrg() {
    setMsg("");
    try {
      await ensureDeviceKeypair();

      const members = await api(`/api/orgs/${orgId}/members`);
      const list = Array.isArray(members.members) ? members.members : [];

      const key = randomOrgKey();
      const wrapped_keys = [];

      for (const m of list) {
        if (!m?.public_key) continue;
        let pub;
        try { pub = JSON.parse(m.public_key); } catch { continue; }
        const wrapped_key = await wrapForMember(key, pub);
        wrapped_keys.push({ user_id: m.user_id, wrapped_key });
      }

      if (!wrapped_keys.length) {
        setMsg("no members have public keys registered yet");
        return;
      }

      await api(`/api/orgs/${orgId}/crypto`, {
        method: "POST",
        body: JSON.stringify({ wrapped_keys, encrypted_org_metadata: null }),
      });

      cacheOrgKey(orgId, key);
      setZkStatus((s) => ({ ...s, orgKey: true }));
      setMsg("zk enabled for org on this device");
    } catch (e) {
      setMsg(e.message || "failed");
    }
  }

  async function fetchOrgKey() {
    setMsg("");
    try {
      await ensureDeviceKeypair();
      const d = await api(`/api/orgs/${orgId}/crypto`, { method: "GET" });
      if (!d?.wrapped_key) {
        setMsg("no wrapped key for you on this org yet");
        return;
      }
      const key = await unwrapOrgKey(d.wrapped_key);
      cacheOrgKey(orgId, key);
      setZkStatus((s) => ({ ...s, orgKey: true }));
      setMsg("org key loaded on this device");
    } catch (e) {
      setMsg(e.message || "failed");
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 16 }}>
      <h2>security</h2>

      <section style={{ marginTop: 16, padding: 12, border: "1px solid #333", borderRadius: 8 }}>
        <h3>mfa</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={startMfa}>start mfa</button>
          <button onClick={confirmMfa}>confirm</button>
          <button onClick={disableMfa}>disable</button>
        </div>

        <div style={{ marginTop: 8 }}>
          <label>
            6 digit code
            <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} style={{ marginLeft: 8, width: 120 }} />
          </label>
        </div>

        {mfaSecret ? (
          <div style={{ marginTop: 8 }}>
            <div><b>secret</b> {mfaSecret}</div>
            {mfaQr ? (
              <div style={{ marginTop: 4 }}>
                <a href={mfaQr} target="_blank" rel="noreferrer">open otp url</a>
              </div>
            ) : null}
          </div>
        ) : null}

        {showRecovery && recoveryCodes.length ? (
          <div style={{ marginTop: 8 }}>
            <b>recovery codes</b>
            <pre style={{ whiteSpace: "pre-wrap" }}>{recoveryCodes.join("\n")}</pre>
          </div>
        ) : null}
      </section>

      <section style={{ marginTop: 16, padding: 12, border: "1px solid #333", borderRadius: 8 }}>
        <h3>zero knowledge storage (beta)</h3>
        <div style={{ fontSize: 14, opacity: 0.9 }}>
          device key: {zkStatus.deviceKey ? "ok" : "missing"} | org key cached: {zkStatus.orgKey ? "yes" : "no"}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button onClick={enableZkForOrg}>enable zk for this org (admin)</button>
          <button onClick={fetchOrgKey}>load org key on this device</button>
        </div>

        <div style={{ fontSize: 13, marginTop: 8, opacity: 0.85 }}>
          this is v1. it encrypts meeting notes and need descriptions client side when an org key exists.
          the server only stores ciphertext blobs.
        </div>
      </section>

      {msg ? <div style={{ marginTop: 12, color: "#f88" }}>{msg}</div> : null}
    </div>
  );
}
