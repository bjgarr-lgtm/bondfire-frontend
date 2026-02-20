// src/pages/OrgDash.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

/* ---------- API helper ---------- */
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

function useIsMobile(maxWidthPx = 720) {
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia && window.matchMedia(`(max-width: ${maxWidthPx}px)`).matches;
  });

  React.useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    try {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    } catch {
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
  }, [maxWidthPx]);

  return isMobile;
}

async function authFetch(path, opts = {}) {
  const relative = path.startsWith("/") ? path : `/${path}`;
  const remote = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const isInviteEndpoint = /^\/api\/(orgs\/[^/]+\/invites|invites\/redeem)\b/.test(relative);

  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };

  const doReq = async (u) => {
    const res = await fetch(u, {
      ...opts,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "include",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.ok === false) throw new Error(j.error || j.message || `HTTP ${res.status}`);
    return j;
  };

  if (isInviteEndpoint && API_BASE && remote !== relative) {
    try {
      return await doReq(relative);
    } catch {
      return await doReq(remote);
    }
  }

  try {
    return await doReq(remote);
  } catch (e) {
    const msg = String(e?.message || "");
    if (API_BASE && !path.startsWith("http") && (msg.includes("HTTP 404") || msg.includes("HTTP 500"))) {
      return await doReq(relative);
    }
    throw e;
  }
}

export default function OrgDash() {
  const nav = useNavigate();
  const isMobile = useIsMobile(720);

  const [orgs, setOrgs] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const [newOrgName, setNewOrgName] = React.useState("");
  const [inviteCode, setInviteCode] = React.useState("");
  const deleteOrg = async (org) => {
    const id = org?.id;
    if (!id) return;

    const name = org?.name || id;
    const ok = window.confirm(`Delete org "${name}"?\n\nThis cannot be undone.`);
    if (!ok) return;

    setBusy(true);
    setMsg("");
    try {
      await authFetch(`/api/orgs/${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
      setMsg(`Deleted "${name}".`);
    } catch (e) {
      setMsg(e?.message || "Failed to delete org");
    } finally {
      setBusy(false);
    }
  };

  const load = React.useCallback(async () => {
    setMsg("");
    try {
      const r = await authFetch("/api/orgs", { method: "GET" });
      setOrgs(Array.isArray(r.orgs) ? r.orgs : []);
    } catch (e) {
      setMsg(e.message || "Failed to load orgs");
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const createOrg = async (e) => {
    e?.preventDefault();
    const name = (newOrgName || "").trim();
    if (!name) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await authFetch("/api/orgs/create", { method: "POST", body: { name } });
      setNewOrgName("");
      await load();
      if (r?.org?.id) nav(`/org/${encodeURIComponent(r.org.id)}`);
    } catch (e2) {
      setMsg(e2.message || "Failed to create org");
    } finally {
      setBusy(false);
    }
  };

  const joinWithInvite = async (e) => {
    e?.preventDefault();
    const code = (inviteCode || "").trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await authFetch("/api/invites/redeem", { method: "POST", body: { code } });
      setInviteCode("");
      await load();
      if (r?.org?.id) nav(`/org/${encodeURIComponent(r.org.id)}`);
      else setMsg("Joined.");
    } catch (e2) {
      setMsg(e2.message || "Failed to join");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginTop: 0 }}>Org Dashboard</h1>
      <p className="helper">Choose an organization to enter its workspace, or create or join one.</p>

      <div
        className="grid"
        style={{
          gap: 16,
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        }}
      >
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Create a new org</h2>
          <form onSubmit={createOrg} className="grid" style={{ gap: 10 }}>
            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Organization name</span>
              <input
                className="input"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="e.g. Bondfire Team"
              />
            </label>
            <button className="btn-red" disabled={busy || !newOrgName.trim()}>
              Create
            </button>
          </form>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Join with an invite code</h2>
          <form onSubmit={joinWithInvite} className="grid" style={{ gap: 10 }}>
            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Invite code</span>
              <input
                className="input"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Paste invite code"
                autoCapitalize="characters"
                autoCorrect="off"
              />
            </label>
            <button className="btn-red" disabled={busy || !inviteCode.trim()}>
              Join
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, flex: 1, minWidth: 140 }}>Your orgs</h2>
          <button className="btn" style={{ whiteSpace: "nowrap" }} onClick={load} disabled={busy}>
            Refresh
          </button>
        </div>

        {msg && (
          <div className={msg.toLowerCase().includes("fail") ? "error" : "helper"} style={{ marginTop: 10 }}>
            {msg}
          </div>
        )}

        {orgs.length === 0 ? (
          <div className="helper" style={{ marginTop: 12 }}>No orgs yet.</div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {orgs.map((o) => (
              <div
                key={o.id}
                className="row"
                style={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderTop: "1px solid #222",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {o.name || o.id}
                  </div>
                  <div className="helper">Role: {o.role || "member"}</div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    className="btn-red"
                    style={{ whiteSpace: "nowrap" }}
                    onClick={() => nav(`/org/${encodeURIComponent(o.id)}`)}
                    disabled={busy}
                  >
                    Open
                  </button>

                  <button
                    className="btn"
                    style={{ whiteSpace: "nowrap" }}
                    onClick={() => deleteOrg(o)}
                    disabled={busy}
                    title="Delete this org"
                  >
                    Delete
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
