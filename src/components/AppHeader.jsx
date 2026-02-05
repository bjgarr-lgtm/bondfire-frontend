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

  const base = variant === "mobile" ? "bf-orgNav bf-orgNav-mobile" : "bf-orgNav";
  const linkCls = ({ isActive }) =>
    "bf-orgLink" + (isActive ? " bf-orgLink-active" : "");

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

  const doLogout = () => {
    if (typeof onLogout === "function") onLogout();
    setMobileOpen(false);
  };

  return (
    <header className="bf-appHeader">
      <div className="bf-appHeader-inner">
        <Link to={orgId ? `/org/${encodeURIComponent(orgId)}` : "/orgs"} className="bf-brand" aria-label="Bondfire home">
          {logoSrc ? (
            <img src={logoSrc} alt="Org logo" className="bf-brandLogo" />
          ) : (
            <div className="bf-brandMark" aria-hidden="true">
              bf
            </div>
          )}
          <div className="bf-brandText">
            <div className="bf-brandTitle">Bondfire</div>
            {orgName ? <div className="bf-brandSub">{orgName}</div> : null}
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
          className="bf-burger"
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen ? "true" : "false"}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className="bf-burgerBars" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="bf-drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="bf-drawerBackdrop" type="button" aria-label="Close" onClick={() => setMobileOpen(false)} />
          <aside className="bf-drawerPanel">
            <div className="bf-drawerTop">
              <div className="bf-drawerTitle">Menu</div>
              <button className="bf-drawerClose" type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                ✕
              </button>
            </div>

            <OrgNav variant="mobile" onNavigate={() => setMobileOpen(false)} />

            {showLogout ? (
              <button className="bf-logout bf-logout-mobile" type="button" onClick={doLogout}>
                Sign out
              </button>
            ) : null}
          </aside>
        </div>
      ) : null}
    </header>
  );
}
