// src/components/AppHeader.jsx
import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

// --- helpers ---
function useOrgIdFromPath() {
  const { pathname = "" } = useLocation();
  const m = pathname.match(/\/org\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

// Use Vite's BASE_URL so assets work under sub-paths too.
const LOGO_URL = `${import.meta.env.BASE_URL || "/"}logo-bondfire.png`;

const Brand = ({ logoSrc = LOGO_URL }) => {
  const orgId = useOrgIdFromPath();
  const homeHref = orgId ? `/org/${orgId}/overview` : "/orgs";
  return (
    <Link
      to={homeHref}
      className="brand"
      style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
    >
      <img
        src={logoSrc}
        alt="Bondfire"
        width={28}
        height={28}
        // If it 404s, show a simple fallback dot so you know it failed.
        onError={(e) => { e.currentTarget.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw="; }}
        style={{ display: "block", borderRadius: 6 }}
      />
      <span style={{ color: "var(--bfBrand, #fff)", fontWeight: 700 }}>Bondfire</span>
    </Link>
  );
};

function OrgNav() {
  const orgId = useOrgIdFromPath();
  if (!orgId) return null;

  const base = `/org/${orgId}`;
  const linkStyle = { padding: "8px 12px", borderRadius: 10, textDecoration: "none" };

  return (
    <nav style={{ display: "flex", gap: 8, marginLeft: 12, flexWrap: "wrap" }}>
      {[
        ["Dashboard", `${base}/overview`],
        ["People", `${base}/people`],
        ["Inventory", `${base}/inventory`],
        ["Needs", `${base}/needs`],
        ["Meetings", `${base}/meetings`],
        ["Settings", `${base}/settings`],
        ["Public", `${base}/public`],
        ["Bambi", `${base}/chat`],
      ].map(([label, to]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => "btn" + (isActive ? " active" : "")}
          style={linkStyle}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppHeader({ onLogout, showLogout }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderBottom: "1px solid #1f2937",
        background: "#0f0f10"
      }}
    >
      <Brand />
      <OrgNav />
      <div style={{ marginLeft: "auto" }}>
        {showLogout && (
          <button
            onClick={onLogout}
            className="btn"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "#a40b12",
              color: "#fff",
              border: "1px solid #7a0c12",
              cursor: "pointer"
            }}
            title="Logout"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
