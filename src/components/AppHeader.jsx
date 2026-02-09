// src/components/AppHeader.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

function readOrgIdFromHash() {
  try {
    const h = window.location.hash || "";
    const m = h.match(/#\/org\/([^/]+)/i);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function useOrgId() {
  // close drawer on route changes, etc.
  useLocation();

  const [orgId, setOrgId] = React.useState(() => readOrgIdFromHash());

  React.useEffect(() => {
    const sync = () => setOrgId(readOrgIdFromHash());
    sync();
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
  const base = (window.location.pathname || "/").endsWith("/")
    ? (window.location.pathname || "/")
    : `${window.location.pathname}/`;

  const homeHref = orgId ? `${base}#/org/${encodeURIComponent(orgId)}/overview` : `${base}#/orgs`;

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

  const basePath = (window.location.pathname || "/").endsWith("/")
    ? (window.location.pathname || "/")
    : `${window.location.pathname}/`;

  const orgBase = `${basePath}#/org/${encodeURIComponent(orgId)}`;

  const items = [
    ["Dashboard", `${orgBase}/overview`],
    ["People", `${orgBase}/people`],
    ["Inventory", `${orgBase}/inventory`],
    ["Needs", `${orgBase}/needs`],
    ["Meetings", `${orgBase}/meetings`],
    ["Settings", `${orgBase}/settings`],
    ["Chat", `${orgBase}/chat`],
  ];

  const navClass = `bf-appnav${variant === "drawer" ? " is-drawer" : ""}`;
  const currentHash = window.location.hash || "";

  return (
    <nav className={navClass} aria-label="Org navigation">
      {items.map(([label, href]) => {
        // href ends with "#/org/<id>/route", so compare to currentHash
        const hashPart = href.split("#")[1] ? `#${href.split("#")[1]}` : "";
        const isActive = hashPart && currentHash.startsWith(hashPart);

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
  React.useEffect(() => setMobileOpen(false), [loc.pathname]);

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
