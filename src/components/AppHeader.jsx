// src/components/AppHeader.jsx
import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

function useOrgIdFromPath() {
  const loc = useLocation();
  const m = String(loc?.pathname || "").match(/\/org\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

function clearAuth() {
  localStorage.removeItem("bf_auth_token");
  sessionStorage.removeItem("bf_auth_token");
  // legacy keys tolerated
  localStorage.removeItem("bf_token");
  sessionStorage.removeItem("bf_token");
}

function NavButton({ to, children, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `bf-navlink ${isActive ? "bf-navlink-active" : ""}`
      }
    >
      {children}
    </NavLink>
  );
}

function OrgNavLinks({ onNavigate }) {
  const orgId = useOrgIdFromPath();
  if (!orgId) return null;

  const base = `/org/${encodeURIComponent(orgId)}`;

  return (
    <>
      <NavButton to={`${base}/dashboard`} onClick={onNavigate}>
        Dashboard
      </NavButton>
      <NavButton to={`${base}/people`} onClick={onNavigate}>
        People
      </NavButton>
      <NavButton to={`${base}/inventory`} onClick={onNavigate}>
        Inventory
      </NavButton>
      <NavButton to={`${base}/needs`} onClick={onNavigate}>
        Needs
      </NavButton>
      <NavButton to={`${base}/meetings`} onClick={onNavigate}>
        Meetings
      </NavButton>
      <NavButton to={`${base}/settings`} onClick={onNavigate}>
        Settings
      </NavButton>
    </>
  );
}

export default function AppHeader() {
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // close drawer on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [loc?.pathname]);

  const orgId = useOrgIdFromPath();
  const inOrg = !!orgId;

  const logout = () => {
    clearAuth();
    // keep it brutally simple
    window.location.href = "/#/";
  };

  return (
    <header className="bf-header">
      <div className="bf-header-inner">
        <div className="bf-header-left">
          <Link to="/orgs" className="bf-brand" title="Bondfire">
            Bondfire
          </Link>
        </div>

        {/* desktop nav */}
        {inOrg ? (
          <nav className="bf-header-nav" aria-label="Org navigation">
            <OrgNavLinks />
          </nav>
        ) : null}

        <div className="bf-header-right">
          {inOrg ? (
            <button
              type="button"
              className="bf-burger"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen ? "true" : "false"}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span className="bf-burger-lines" />
            </button>
          ) : null}

          <button type="button" className="bf-logout bf-desktop-only" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {/* mobile drawer */}
      {inOrg ? (
        <>
          <div
            className={`bf-drawer-backdrop ${mobileOpen ? "is-open" : ""}`}
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className={`bf-drawer ${mobileOpen ? "is-open" : ""}`}
            aria-label="Menu"
          >
            <div className="bf-drawer-top">
              <div className="bf-drawer-title">Menu</div>
              <button
                type="button"
                className="bf-drawer-close"
                onClick={() => setMobileOpen(false)}
              >
                ✕
              </button>
            </div>

            <nav className="bf-drawer-nav">
              <OrgNavLinks onNavigate={() => setMobileOpen(false)} />
            </nav>

            <div className="bf-drawer-bottom">
              <button type="button" className="bf-btn bf-btn-red" onClick={logout}>
                Logout
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </header>
  );
}
