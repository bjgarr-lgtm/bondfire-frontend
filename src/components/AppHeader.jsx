// src/components/AppHeader.jsx
import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

function useOrgIdFromPath() {
  const loc = useLocation();

  // Works for BrowserRouter paths like /org/:orgId/...
  const path = loc?.pathname || "";
  let m = path.match(/\/org\/([^/]+)/i);
  if (m && m[1]) return decodeURIComponent(m[1]);

  // Works for HashRouter urls like .../#/org/:orgId/...
  const hash = (typeof window !== "undefined" && window.location && window.location.hash) ? window.location.hash : "";
  m = hash.match(/#\/org\/([^/]+)/i);
  if (m && m[1]) return decodeURIComponent(m[1]);

  return null;
}


function Brand({ logoSrc = "/logo-bondfire.png" }) {
  const orgId = useOrgIdFromPath();
  const homeHref = orgId ? `/org/${orgId}/overview` : "/orgs";

  return (
    <Link to={homeHref} className="bf-brand" aria-label="Bondfire home">
      <img
        src={logoSrc}
        alt=""
        width={28}
        height={28}
        loading="eager"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <span>Bondfire</span>
    </Link>
  );
}

function OrgNav({ variant = "desktop" }) {
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

  const navClass = `bf-appnav${variant === "drawer" ? " is-drawer" : ""}`;

  return (
    <nav className={navClass} aria-label="Org navigation">
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
  const loc = useLocation();

  // Close drawer on route change.
  React.useEffect(() => setMobileOpen(false), [loc.pathname]);

  // Escape closes drawer.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <header className="bf-appHeader">
      <div className="bf-appHeader-left">
        <Brand />
      </div>

      <div className="bf-appHeader-right">
        <div className="bf-nav-desktop">
          <OrgNav variant="desktop" />
        </div>

        {showLogout ? (
          <button className="bf-logout" type="button" onClick={onLogout} title="Logout">
            Logout
          </button>
        ) : null}

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

      <div
        className={`bf-drawer${mobileOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="bf-drawer-backdrop" onClick={() => setMobileOpen(false)} />
        <div className="bf-drawer-panel">
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

          <OrgNav variant="drawer" />

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
