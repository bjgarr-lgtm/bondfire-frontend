// src/components/AppHeader.jsx
import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

function useOrgIdFromPath() {
  const { pathname = "" } = useLocation();
  const m = pathname.match(/\/org\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

const Brand = ({ logoSrc = "/logo-bondfire.png" }) => {
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
        onError={(e) => { e.currentTarget.style.display = "none"; }}
        style={{ display: "block" }}
      />
      <span style={{ color: "var(--bfBrand, #fff)", fontWeight: 700 }}>Bondfire</span>
    </Link>
  );
};

function OrgNav() {
  const orgId = useOrgIdFromPath();
  if (!orgId) return null;

  const base = `/org/${orgId}`;
  const navStyle = {
    padding: "8px 12px",
    borderRadius: 8,
    background: "#a40b12",
    color: "#fff",
    border: "1px solid #7a0c12",
    textDecoration: "none",
    fontWeight: 500,
    transition: "background 0.2s ease, transform 0.1s ease",
  };

  const hoverStyle = {
    background: "#8e0a10",
  };

  const activeStyle = {
    background: "#cc0f1a",
    fontWeight: 700,
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginRight: 12 }}>
      {[
        ["Dashboard", `${base}/overview`],
        ["People", `${base}/people`],
        ["Inventory", `${base}/inventory`],
        ["Needs", `${base}/needs`],
        ["Meetings", `${base}/meetings`],
        ["Settings", `${base}/settings`],
        ["Public", `${base}/public`],
        ["Chat", `${base}/chat`],
      ].map(([label, to]) => (
        <NavLink
          key={to}
          to={to}
          className="btn"
          style={({ isActive }) => ({
            ...navStyle,
            ...(isActive ? activeStyle : {}),
          })}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, hoverStyle)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, navStyle)}
        >
          {label}
        </NavLink>
      ))}
    </div>
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
        justifyContent: "space-between",
        padding: "10px 14px",
        borderBottom: "1px solid #1f2937",
        background: "#0f0f10"
      }}
    >
      <Brand />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <OrgNav />
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
              cursor: "pointer",
              transition: "background 0.2s ease, transform 0.1s ease",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#8e0a10"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#a40b12"}
            title="Logout"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
