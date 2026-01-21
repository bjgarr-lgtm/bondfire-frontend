import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useOrg } from "../context/OrgContext";
import { getState } from "../utils_store";
import { api } from "../utils/api.js";

// helper to pull settings from localStorage
function readOrgInfo(orgId) {
  try {
    const s = JSON.parse(localStorage.getItem(`bf_org_settings_${orgId}`) || "{}");
    const orgs = JSON.parse(localStorage.getItem("bf_orgs") || "[]");
    const o = orgs.find((x) => x?.id === orgId) || {};
    return {
      name: s.name || o.name || "Org",
      logo: s.logoDataUrl || s.logoUrl || o.logoDataUrl || o.logoUrl || null,
    };
  } catch {
    return { name: "Org", logo: null };
  }
}

export default function Overview() {
  const ctx = (typeof useOrg === "function" ? useOrg() : null) || {};
  const orgNameCtx = ctx.orgName || null;

  // derive orgId (keep your existing behavior)
  const orgId = useMemo(() => {
    try {
      const hash = window.location.hash || "#/org/org-demo-a";
      const m = hash.match(/#\/org\/([^/]+)/);
      if (m && m[1]) return decodeURIComponent(m[1]);
      const s = getState();
      return s.currentOrgId || (s.orgs && s.orgs[0]?.id) || "org-demo-a";
    } catch {
      const s = getState();
      return s.currentOrgId || "org-demo-a";
    }
  }, []);

  const { name: orgName, logo } = readOrgInfo(orgId);

  // server-backed data
  const [counts, setCounts] = useState({ people: 0, needsOpen: 0, needsAll: 0 });
  const [peoplePreview, setPeoplePreview] = useState([]);
  const [needsPreview, setNeedsPreview] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    try {
      const dash = await api(`/api/orgs/${encodeURIComponent(orgId)}/dashboard`);
      setCounts(dash.counts || { people: 0, needsOpen: 0, needsAll: 0 });

      const ppl = await api(`/api/orgs/${encodeURIComponent(orgId)}/people`);
      setPeoplePreview((ppl.people || []).slice(0, 5));

      const nds = await api(`/api/orgs/${encodeURIComponent(orgId)}/needs`);
      setNeedsPreview((nds.needs || []).slice(0, 5));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, [orgId]);

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
    margin: 16,
  };

  const Card = ({ title, right, children }) => (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <strong>{title}</strong>
        {right}
      </div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );

  return (
    <>
      {/* Top card with Announcements */}
      <div className="card" style={{ margin: 16, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {logo && (
            <img
              src={logo}
              alt="Org Logo"
              style={{ width: 80, height: 80, borderRadius: 12, objectFit: "cover" }}
            />
          )}
          <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
            {orgNameCtx || orgName} {" "}Dashboard
          </h2>
          <button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>

        <div style={{ marginTop: 8 }}>
          <strong>Announcements</strong>
          <p className="helper" style={{ marginTop: 6 }}>
            Pin important updates for members here.
          </p>
        </div>
      </div>

      {/* Cards grid */}
      <div style={gridStyle}>
        <Card title="People" right={<Link className="btn-red" to={`/org/${orgId}/people`}>View all</Link>}>
          <div className="helper">{counts.people} member{counts.people === 1 ? "" : "s"}</div>
          <ul style={{ marginTop: 6, paddingLeft: 16 }}>
            {peoplePreview.map((p, i) => (
              <li key={p?.id || p?.name || i}>
                {(p?.name ?? "Unnamed")}{p?.role ? ` — ${p.role}` : ""}
              </li>
            ))}
            {!peoplePreview.length && <li>No people yet.</li>}
          </ul>
        </Card>

        <Card title="Inventory" right={<Link className="btn-red" to={`/org/${orgId}/inventory`}>View all</Link>}>
          <p className="helper">Inventory is still on demo storage until we port it to D1.</p>
        </Card>

        <Card title="Needs" right={<Link className="btn-red" to={`/org/${orgId}/needs`}>View all</Link>}>
          <div className="helper">{counts.needsAll} total, {counts.needsOpen} open</div>
          <ul style={{ marginTop: 6, paddingLeft: 16 }}>
            {needsPreview.map((n, i) => (
              <li key={n?.id || n?.title || i}>
                {(n?.title ?? "Untitled")}{n?.status ? ` — ${n.status}` : ""}
              </li>
            ))}
            {!needsPreview.length && <li>No needs yet.</li>}
          </ul>
        </Card>

        <Card title="Meetings" right={<Link className="btn-red" to={`/org/${orgId}/meetings`}>View all</Link>}>
          <p className="helper">Meetings is still on demo storage until we port it to D1.</p>
        </Card>

        <Card title="Recent Activity">
          <p className="helper">Activity feed is still on demo storage until we port it to D1.</p>
        </Card>
      </div>
    </>
  );
}
