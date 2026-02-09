// src/components/AppHeader.jsx
import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

function useMediaQuery(query) {
  const [matches, setMatches] = React.useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  React.useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);

    onChange();
    if (m.addEventListener) m.addEventListener("change", onChange);
    else m.addListener(onChange);

    return () => {
      if (m.removeEventListener) m.removeEventListener("change", onChange);
      else m.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

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
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
        style={{ display: "block" }}
      />
      <span style={{ color: "var(--bfBrand, #fff)", fontWeight: 700 }}>Bondfire</span>
    </Link>
  );
};

function OrgNav({ direction = "row" } = {}) {
  const orgId = useOrgIdFromPath();
  if (!orgId) return null;

  const base = `/org/${orgId}`;
  const items = [
    ["Dashboard", `${base}/overview`],
    ["People", `${base}/people`],
    ["Inventory", `${base}/inventory`],
    ["Needs", `${base}/needs`],
    ["Meetings", `${base}/meetings`],
    ["Pledges", `${base}/pledges`],
    ["Settings", `${base}/settings`],
  ];

  return (
    <nav
      className={direction === "col" ? "bf-appnav bf-appnav-col" : "bf-appnav"}
      aria-label="Org navigation"
    >
      {items.map(([label, to]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => (isActive ? "btn-red" : "btn")}
          style={{ textDecoration: "none" }}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppHeader({ onLogout, showLogout }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isMobile = useMediaQuery("(max-width: 820px)");

  // Close drawer on route change.
  const loc = useLocation();
  React.useEffect(() => setMobileOpen(false), [loc.pathname]);

  // If we resize to desktop, forcibly close and stop rendering the drawer.
  React.useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  // Escape closes drawer.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <header className="header bf-appHeader">
      <div className="bf-appHeader-left">
        <Brand />
      </div>

      <div className="bf-appHeader-right">
        {/* Desktop nav */}
        <div className="bf-nav-desktop">
          <OrgNav />
        </div>

        {showLogout ? (
          <button className="btn" type="button" onClick={onLogout} title="Logout">
            Logout
          </button>
        ) : null}

        {/* Mobile: hamburger */}
        {isMobile ? (
          <button
            className="btn bf-hamburger"
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen ? "true" : "false"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span aria-hidden="true">☰</span>
          </button>
        ) : null}
      </div>

      {/* Mobile drawer */}
      {isMobile ? (
        <div
          className={`bf-drawer${mobileOpen ? " is-open" : ""}`}
          role="dialog"
          aria-modal={mobileOpen ? "true" : "false"}
          aria-hidden={mobileOpen ? "false" : "true"}
        >
          <div className="bf-drawer-backdrop" onClick={() => setMobileOpen(false)} />

          <div className="bf-drawer-panel">
            <div className="bf-drawer-top">
              <div className="bf-drawer-title">Menu</div>
              <button
                className="btn bf-drawer-close"
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <OrgNav direction="col" />

            {showLogout ? (
              <button className="btn-red" type="button" onClick={onLogout}>
                Logout
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
