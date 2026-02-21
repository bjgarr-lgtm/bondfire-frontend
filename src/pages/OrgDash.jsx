// src/pages/OrgDash.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";

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

function u(path) {
  if (path.startsWith("http")) return path;
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export default function OrgDash() {
  const nav = useNavigate();
  const isMobile = useIsMobile(720);

  const [orgs, setOrgs] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const [newOrgName, setNewOrgName] = React.useState("");
  const [inviteCode, setInviteCode] = React.useState("");

  const load = React.useCallback(async () => {
    setMsg("");
    try {
      const r = await api(u("/api/orgs"), { method: "GET" });
      setOrgs(Array.isArray(r.orgs) ? r.orgs : []);
    } catch (e) {
      setMsg(e?.message || "Failed to load orgs");
      setOrgs([]);
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
      const r = await api(u("/api/orgs/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setNewOrgName("");
      await load();
      if (r?.org?.id) nav(`/org/${encodeURIComponent(r.org.id)}`);
    } catch (e2) {
      setMsg(e2?.message || "Failed to create org");
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
      const r = await api(u("/api/invites/redeem"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      setInviteCode("");
      await load();
      if (r?.org?.id) nav(`/org/${encodeURIComponent(r.org.id)}`);
      else setMsg("Joined.");
    } catch (e2) {
      setMsg(e2?.message || "Failed to join");
    } finally {
      setBusy(false);
    }
  };

  const deleteOrg = async (org) => {
    const id = org?.id;
    if (!id) return;
    const name = org?.name || id;
    const ok = window.confirm(`Delete org "${name}"?\n\nThis cannot be undone.`);
    if (!ok) return;

    setBusy(true);
    setMsg("");
    try {
      await api(u(`/api/orgs/${encodeURIComponent(id)}`), { method: "DELETE" });
      await load();
      setMsg(`Deleted "${name}".`);
    } catch (e) {
      setMsg(e?.message || "Failed to delete org");
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
              />
            </label>
            <button className="btn-red" disabled={busy || !inviteCode.trim()}>
              Join
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Your orgs</h2>
          <button className="btn" onClick={load} disabled={busy}>
            Refresh
          </button>
        </div>

        {msg ? <p style={{ marginTop: 10, color: "#ff5b5b" }}>{msg}</p> : null}

        {!orgs?.length ? (
          <p className="helper">No orgs yet.</p>
        ) : (
          <div className="grid" style={{ gap: 10, marginTop: 10 }}>
            {orgs.map((o) => (
              <div
                key={o.id}
                className="row"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
              >
                <button
                  className="btn"
                  onClick={() => nav(`/org/${encodeURIComponent(o.id)}`)}
                  style={{ flex: 1, textAlign: "left" }}
                >
                  {o.name || o.id}
                </button>
                <button className="btn" onClick={() => deleteOrg(o)} disabled={busy}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
