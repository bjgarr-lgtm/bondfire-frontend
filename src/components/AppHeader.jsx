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
    <Link to={homeHref} className="bf-brand" aria-label="Bondfire home">
      <img
        src={logoSrc}
        alt=""
        width={28}
        height={28}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <span className="bf-brandText">Bondfire</span>
    </Link>
  );
};

function OrgNav({ variant = "desktop", onNavigate }) {
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
    <nav
      className={`bf-appnav${variant === "drawer" ? " is-drawer" : ""}`}
      aria-label="Org navigation"
    >
      {items.map(([label, to]) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
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
  const loc = useLocation();

  // Only show org navigation when inside an org workspace.
  const orgId = useOrgIdFromPath();
  const hasOrgNav = !!orgId;

  // Close drawer on route change.
  React.useEffect(() => setMobileOpen(false), [loc.pathname]);

  return (
    <header className="bf-appHeader">
      <div className="bf-appHeader-left">
        <Brand />
      </div>

      <div className="bf-appHeader-right">
        {/* Desktop nav */}
        <div className="bf-nav-desktop">
          {hasOrgNav ? <OrgNav variant="desktop" /> : null}
        </div>

        {showLogout ? (
          <button className="bf-logout" type="button" onClick={onLogout}>
            Logout
          </button>
        ) : null}

        {/* Mobile hamburger */}
        {hasOrgNav ? (
          <button
            className="bf-hamburger"
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen ? "true" : "false"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span aria-hidden="true">☰</span>
          </button>
        ) : null}
      </div>

      {/* Drawer is *CSS-gated* to mobile. On desktop it is display:none. */}
      {hasOrgNav ? (
        <div className={`bf-drawer${mobileOpen ? " is-open" : ""}`}>
        <div
          className="bf-drawer-backdrop"
          onClick={() => setMobileOpen(false)}
        />
        <aside className="bf-drawer-panel" aria-label="Navigation menu">
          <div className="bf-drawer-top">
            <div className="bf-drawer-title">Menu</div>
            <button
              className="bf-drawer-close"
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>

          <OrgNav variant="drawer" onNavigate={() => setMobileOpen(false)} />

          {showLogout ? (
            <button
              className="bf-drawer-logout"
              type="button"
              onClick={onLogout}
            >
              Logout
            </button>
          ) : null}
        </aside>
        </div>
      ) : null}
    </header>
  );
}
