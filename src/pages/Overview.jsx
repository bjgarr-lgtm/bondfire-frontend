import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useOrg } from "../context/OrgContext";
import { getState } from "../utils_store";

// helper to pull settings from localStorage
function readOrgInfo(orgId) {
  try {
    const s = JSON.parse(localStorage.getItem(`bf_org_settings_${orgId}`) || "{}");
    const orgs = JSON.parse(localStorage.getItem("bf_orgs") || "[]");
    const o = orgs.find(x => x?.id === orgId) || {};
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

  // derive orgId
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

  // snapshot state
  const state = getState() || {};
  const asArr = (x) => (Array.isArray(x) ? x : []);
  const people    = asArr(state.people).filter(x => !x.org || x.org === orgId);
  const inventory = asArr(state.inventory).filter(x => !x.org || x.org === orgId);
  const needs     = asArr(state.needs).filter(x => !x.org || x.org === orgId);
  const meetings  = asArr(state.meetings).filter(x => !x.org || x.org === orgId);
  const activity  = asArr(state.activity).filter(x => !x.org || x.org === orgId);

  const gridStyle = {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12, margin: 16,
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
          {/* Logo moved here, aligned right of title */}
          {logo && (
            <img
              src={logo}
              alt="Org Logo"
              style={{
                width: 80,
                height: 80,
                borderRadius: 12,
                objectFit: "cover",
              }}
            />
          )}
          <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
            {orgNameCtx || orgName} — Dashboard
          </h2>
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
        <Card
          title="People"
          right={<Link className="btn-red" to={`/org/${orgId}/people`}>View all</Link>}
        >
          <div className="helper">{people.length} member{people.length === 1 ? "" : "s"}</div>
          <ul style={{ marginTop: 6, paddingLeft: 16 }}>
            {people.slice(0, 5).map((p, i) => (
              <li key={p?.id || p?.name || i}>
                {(p?.name ?? "Unnamed")}{p?.role ? ` — ${p.role}` : ""}
              </li>
            ))}
            {!people.length && <li>No people yet.</li>}
          </ul>
        </Card>

        <Card
          title="Inventory"
          right={<Link className="btn-red" to={`/org/${orgId}/inventory`}>View all</Link>}
        >
          <div className="helper">{inventory.length} item{inventory.length === 1 ? "" : "s"}</div>
          {!inventory.length && <p className="helper">No items yet.</p>}
        </Card>

        <Card
          title="Needs"
          right={<Link className="btn-red" to={`/org/${orgId}/needs`}>View all</Link>}
        >
          <div className="helper">{needs.length} total</div>
          {!needs.length && <p className="helper">No needs yet.</p>}
        </Card>

        <Card
          title="Meetings"
          right={<Link className="btn-red" to={`/org/${orgId}/meetings`}>View all</Link>}
        >
          {!meetings.length && <p className="helper">No meetings scheduled.</p>}
        </Card>

        <Card title="Recent Activity">
          {!activity.length && <p className="helper">No recent activity.</p>}
        </Card>
      </div>
    </>
  );
}
