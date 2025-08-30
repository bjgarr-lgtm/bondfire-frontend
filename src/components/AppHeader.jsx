// src/components/AppHeader.jsx
import React, { useMemo } from "react";
import { useOrg } from "../context/OrgContext";
import { getState } from "../utils_store";
import { NavLink, Link } from "react-router-dom";

export default function AppHeader() {
  const ctx = (typeof useOrg === "function" ? useOrg() : null) || {};
  const orgName = ctx.orgName || null;

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

  const bar = {
    position: "sticky",
    top: 0,
    zIndex: 1000,
    background: "var(--bg)",
    borderBottom: "1px solid var(--border)",
    padding: "8px 12px",
  };

  const row = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    maxWidth: 1100,
    margin: "0 auto",
  };

  return (
    <header style={bar} data-app-header>
      <div style={row}>
        {/* Brand links back to all orgs */}
        <div className="brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            to="/orgs"
            style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 8 }}
            title="Back to all orgs"
          >
            <img
              src="/logo.png"
              alt="Bondfire"
              style={{ height: 28, width: 28, objectFit: "contain", borderRadius: 6 }}
            />
            <strong>Bondfire</strong>
          </Link>
          {orgName && <span style={{ opacity: 0.9 }}>— {orgName}</span>}
        </div>

        {/* Top navigation */}
        <nav className="topnav" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <NavLink to={`/org/${orgId}`} end className={({ isActive }) => (isActive ? "btn-red active" : "btn-red")}>
            Dashboard
          </NavLink>
          <NavLink to={`/org/${orgId}/people`} className={({ isActive }) => (isActive ? "btn-red active" : "btn-red")}>
            People
          </NavLink>
          <NavLink to={`/org/${orgId}/inventory`} className={({ isActive }) => (isActive ? "btn-red active" : "btn-red")}>
            Inventory
          </NavLink>
          <NavLink to={`/org/${orgId}/needs`} className={({ isActive }) => (isActive ? "btn-red active" : "btn-red")}>
            Needs
          </NavLink>
          <NavLink to={`/org/${orgId}/meetings`} className={({ isActive }) => (isActive ? "btn-red active" : "btn-red")}>
            Meetings
          </NavLink>
          <NavLink to={`/org/${orgId}/settings`} className={({ isActive }) => (isActive ? "btn-red active" : "btn-red")}>
            Settings
          </NavLink>
          <NavLink to={`/org/${orgId}/public`} className={({ isActive }) => (isActive ? "btn-red active" : "btn-red")}>
            Public
          </NavLink>
          <NavLink to={`/org/${orgId}/chat`} className={({isActive}) => isActive ? "btn-red active" : "btn-red"}>
  BambiChat
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
