// src/components/AppHeader.jsx
import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

function useOrgIdFromPath() {
  const { pathname } = useLocation();
  const m = pathname.match(/\/org\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

function OrgNav({ onNavigate, variant = "desktop" }) {
  const orgId = useOrgIdFromPath();
  if (!orgId) return null;

  const base = variant === "mobile" ? "bf-navRow bf-navRow-mobile" : "bf-navRow";
  const linkCls = ({ isActive }) =>
    "bf-navLink" + (isActive ? " active" : "");

  const handle = () => {
    if (typeof onNavigate === "function") onNavigate();
  };

  return (
    <nav className={base} aria-label="Org navigation">
      <NavLink to={`/org/${encodeURIComponent(orgId)}/people`} className={linkCls} onClick={handle}>
        People
      </NavLink>
      <NavLink to={`/org/${encodeURIComponent(orgId)}/inventory`} className={linkCls} onClick={handle}>
        Inventory
      </NavLink>
      <NavLink to={`/org/${encodeURIComponent(orgId)}/needs`} className={linkCls} onClick={handle}>
        Needs
      </NavLink>
      <NavLink to={`/org/${encodeURIComponent(orgId)}/meetings`} className={linkCls} onClick={handle}>
        Meetings
      </NavLink>
      <NavLink to={`/org/${encodeURIComponent(orgId)}/pledges`} className={linkCls} onClick={handle}>
        Pledges
      </NavLink>
      <NavLink to={`/org/${encodeURIComponent(orgId)}/settings`} className={linkCls} onClick={handle}>
        Settings
      </NavLink>
    </nav>
  );
}

export default function AppHeader({ orgName, logoSrc, onLogout, showLogout = true }) {
  const loc = useLocation();
  const orgId = useOrgIdFromPath();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Close drawer on navigation.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname, loc.search, loc.hash]);

  // Safety: if the viewport grows past the mobile breakpoint, force-close
  // the drawer so it can never "stick" open on desktop.
  React.useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 860) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const doLogout = () => {
    if (typeof onLogout === "function") onLogout();
    setMobileOpen(false);
  };

  return (
    <header className="bf-appHeader">
      <div className="bf-appHeader-inner">
        <Link to={orgId ? `/org/${encodeURIComponent(orgId)}` : "/orgs"} className="bf-appHeader-brand" aria-label="Bondfire home">
          {logoSrc ? (
            <img src={logoSrc} alt="Org logo" className="bf-appHeader-logo" />
          ) : (
            <div className="bf-appHeader-mark" aria-hidden="true">
              bf
            </div>
          )}
          <div className="bf-appHeader-brandName">
            <div>Bondfire</div>
            {orgName ? <div className="bf-appHeader-sub">{orgName}</div> : null}
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="bf-appHeader-desktopNav">
          <OrgNav />
          {showLogout ? (
            <button className="bf-logout" type="button" onClick={doLogout}>
              Sign out
            </button>
          ) : null}
        </div>

        {/* Mobile burger (right side) */}
        <button
          className="bf-appHeader-burger"
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen ? "true" : "false"}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className="bf-appHeader-burgerBars" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="bf-appDrawer-overlay" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="bf-appDrawer-backdrop" type="button" aria-label="Close" onClick={() => setMobileOpen(false)} />
          <aside className="bf-appDrawer">
            <div className="bf-appDrawer-header">
              <div className="bf-appDrawer-title">Menu</div>
              <button className="bf-appDrawer-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                ✕
              </button>
            </div>

            <OrgNav variant="mobile" onNavigate={() => setMobileOpen(false)} />

            {showLogout ? (
              <button className="btn-red bf-drawerLogout" type="button" onClick={doLogout}>
                Sign out
              </button>
            ) : null}
          </aside>
        </div>
      ) : null}
    </header>
  );
}
