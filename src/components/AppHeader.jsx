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
  const items = [
    ["Dashboard", `${base}/overview`],
    ["People", `${base}/people`],
    ["Inventory", `${base}/inventory`],
    ["Needs", `${base}/needs`],
    ["Meetings", `${base}/meetings`],
    ["Settings", `${base}/settings`],
    ["Chat", `${base}/chat`],
  ];

  return (
    <nav className="bf-appnav" aria-label="Org navigation">
      {items.map(([label, to]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `bf-appnav-link${isActive ? " is-active" : ""}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppHeader({ onLogout, showLogout }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Close drawer on route change.
  const loc = useLocation();
  React.useEffect(() => setMobileOpen(false), [loc.pathname]);

  return (
    <header className="bf-appHeader">
      <div className="bf-appHeader-left">
        <Brand />
      </div>

      <div className="bf-appHeader-right">
        {/* Desktop nav */}
        <div className="bf-nav-desktop">
          <OrgNav />
        </div>

        {showLogout ? (
          <button className="bf-logout" onClick={onLogout} title="Logout">
            Logout
          </button>
        ) : null}

        {/* Mobile: hamburger */}
        <button
          className="bf-hamburger"
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen ? "true" : "false"}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span aria-hidden="true">☰</span>
        </button>
      </div>

      {/* Mobile drawer (only visible on small screens via CSS) */}
      <div className={`bf-drawer${mobileOpen ? " is-open" : ""}`} role="dialog" aria-modal="true">
        <div className="bf-drawer-backdrop" onClick={() => setMobileOpen(false)} />
        <div className="bf-drawer-panel">
          <div className="bf-drawer-top">
            <div className="bf-drawer-title">Menu</div>
            <button className="bf-drawer-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              ✕
            </button>
          </div>

          <OrgNav />

          {showLogout ? (
            <button className="bf-drawer-logout" type="button" onClick={onLogout}>
              Logout
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
