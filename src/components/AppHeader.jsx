// src/components/AppHeader.jsx
import React from "react";
import { useLocation } from "react-router-dom";

function readOrgId() {
  try {
    const path = window.location.pathname || "";
    const hash = window.location.hash || "";

    // If you are using HashRouter, orgId may be in pathname like /org/<id>/inventory
    let m = path.match(/\/org\/([^/]+)/i);
    if (m && m[1]) return decodeURIComponent(m[1]);

    // If you are using /app/#/org/<id>/inventory, orgId is in hash
    m = hash.match(/#\/org\/([^/]+)/i);
    if (m && m[1]) return decodeURIComponent(m[1]);

    return null;
  } catch {
    return null;
  }
}

function useOrgId() {
  const loc = useLocation(); // triggers re-render on route changes
  const [orgId, setOrgId] = React.useState(() => readOrgId());

  React.useEffect(() => {
    setOrgId(readOrgId());
  }, [loc.pathname, loc.search, loc.hash]);

  React.useEffect(() => {
    const sync = () => setOrgId(readOrgId());
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  return orgId;
}

const Brand = ({ logoSrc = "/logo-bondfire.png" }) => {
  const orgId = useOrgId();

  // Keep your existing branding className if you want. This is just the link.
  const homeHref = orgId ? `#/org/${encodeURIComponent(orgId)}/overview` : "#/orgs";

  return (
    <a href={homeHref} className="brand">
      <img
        src={logoSrc}
        alt="Bondfire"
        width={28}
        height={28}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <span>Bondfire</span>
    </a>
  );
};

function OrgNav({ variant = "desktop" }) {
  const orgId = useOrgId();
  if (!orgId) return null;

  const base = `#/org/${encodeURIComponent(orgId)}`;
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
  const currentHash = window.location.hash || "";

  return (
    <nav className={navClass} aria-label="Org navigation">
      {items.map(([label, href]) => {
        const isActive = currentHash.startsWith(href);
        return (
          <a
            key={href}
            href={href}
            className={`bf-appnav-link${isActive ? " is-active" : ""}`}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}

export default function AppHeader({ onLogout, showLogout }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const loc = useLocation();

  React.useEffect(() => setMobileOpen(false), [loc.pathname, loc.hash]);

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
