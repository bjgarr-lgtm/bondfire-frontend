// src/pages/Overview.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api.js";

function getOrgId() {
  try {
    const m = (window.location.hash || "").match(/#\/org\/([^/]+)/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function readOrgInfo(orgId) {
  try {
    const s = JSON.parse(localStorage.getItem(`bf_org_settings_${orgId}`) || "{}");
    const orgs = JSON.parse(localStorage.getItem("bf_orgs") || "[]");
    const o = orgs.find((x) => x?.id === orgId) || {};
    return { name: (s.name || o.name || orgId || "Dashboard").trim() };
  } catch {
    return { name: orgId || "Dashboard" };
  }
}

export default function Overview() {

  const nav = useNavigate();
  const orgId = getOrgId();

  const [orgInfo, setOrgInfo] = useState(() => readOrgInfo(orgId));

  useEffect(() => {
    setOrgInfo(readOrgInfo(orgId));
    const onChange = (e) => {
      const changedId = e?.detail?.orgId;
      if (!changedId || changedId === orgId) setOrgInfo(readOrgInfo(orgId));
    };
    window.addEventListener("bf:org_settings_changed", onChange);
    return () => window.removeEventListener("bf:org_settings_changed", onChange);
  }, [orgId]);


  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("...");
  const [data, setData] = useState(null);

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      const d = await api(`/api/orgs/${encodeURIComponent(orgId)}/dashboard`);
      setData(d);
    } catch (e) {
      setErr(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, [orgId]);

  const counts = data?.counts || {};
  const people = Array.isArray(data?.people) ? data.people : [];
  const needs = Array.isArray(data?.needs) ? data.needs : [];
  const activity = Array.isArray(data?.activity) ? data.activity : [];

  if (!orgId) return <div style={{ padding: 16 }}>No org selected.</div>;

  return (
    <div style={{ padding: 16 }}>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, flex: 1 }}>{orgInfo?.name || "Dashboard"}</h1>
          <button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>

        {err && <div className="helper" style={{ color: "tomato", marginTop: 10 }}>{err}</div>}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {/* People */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>People</h2>
              <button className="btn" onClick={() => go("people")}>View all</button>
          </div>
          <div className="helper" style={{ marginTop: 10 }}>{counts.people || 0} member{(counts.people || 0) === 1 ? "" : "s"}</div>
          <ul style={{ marginTop: 10, paddingLeft: 18 }}>
            {people.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
            {people.length === 0 && <li className="helper">No people yet.</li>}
          </ul>
        </div>

        {/* Inventory */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Inventory</h2>
            <button className="btn" onClick={() => nav("inventory")}>View all</button>
          </div>
          <div className="helper" style={{ marginTop: 10 }}>{counts.inventory || 0} item{(counts.inventory || 0) === 1 ? "" : "s"}</div>
          <div className="helper" style={{ marginTop: 10 }}>
            Manage supplies and public-facing items.
          </div>
        </div>

        {/* Needs */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Needs</h2>
            <button className="btn" onClick={() => nav("needs")}>View all</button>
          </div>
          <div className="helper" style={{ marginTop: 10 }}>
            {counts.needsAll || 0} total, {counts.needsOpen || 0} open
          </div>
          <ul style={{ marginTop: 10, paddingLeft: 18 }}>
            {needs.map((n) => (
              <li key={n.id}>
                {n.title} {n.status ? `— ${n.status}` : ""}
              </li>
            ))}
            {needs.length === 0 && <li className="helper">No needs yet.</li>}
          </ul>
        </div>

        {/* Meetings */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Meetings</h2>
            <button className="btn" onClick={() => nav("meetings")}>View all</button>
          </div>
          <div className="helper" style={{ marginTop: 10 }}>{counts.meetingsUpcoming || 0} upcoming</div>
          <div className="helper" style={{ marginTop: 10 }}>
            Notes and decisions, tied to people and needs.
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Recent Activity</h2>
            <button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>Refresh</button>
          </div>
          <ul style={{ marginTop: 10, paddingLeft: 18 }}>
            {activity.map((a) => (
              <li key={a.id || `${a.kind}-${a.created_at}`}>
                <strong>{a.kind}</strong>: {a.message}
              </li>
            ))}
            {activity.length === 0 && <li className="helper">No activity yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
