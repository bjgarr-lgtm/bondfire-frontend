// src/components/AppHeader.jsx
import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

function useOrgIdFromPath() {
  const loc = useLocation();
  const pathname = loc.pathname || "";
  const hash = loc.hash || "";

  // Support BOTH BrowserRouter (/org/...) and HashRouter (#/org/...)
  const m1 = pathname.match(/\/org\/([^/]+)/i);
  const m2 = hash.match(/#\/org\/([^/]+)/i);

  const raw = (m1 && m1[1]) || (m2 && m2[1]) || null;
  return raw ? decodeURIComponent(raw) : null;
}

const Brand = ({ logoSrc = "/logo-bondfire.png" }) => {
  const orgId = useOrgIdFromPath();
  const homeHref = orgId ? `/org/${orgId}/overview` : "/orgs";
  return (
    <Link to={homeHref} className="brand">
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
    </Link>
  );
};

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

  // Debug toggle: add ?debugNav=1 to the URL
  const debugNav =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugNav");

  const orgId = useOrgIdFromPath();

  React.useEffect(() => setMobileOpen(false), [loc.pathname, loc.hash]);

  // Compute diagnostics for the first nav link when drawer is open
  const [diag, setDiag] = React.useState(null);
  React.useEffect(() => {
    if (!debugNav) return;
    if (!mobileOpen) return;

    const t = setTimeout(() => {
      const el = document.querySelector(".bf-drawer-panel .bf-appnav-link");
      if (!el) {
        setDiag({ foundLink: false });
        return;
      }
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      setDiag({
        foundLink: true,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        display: s.display,
        visibility: s.visibility,
        opacity: s.opacity,
        color: s.color,
        background: s.backgroundColor,
        zIndex: s.zIndex,
        pointerEvents: s.pointerEvents,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
      });
    }, 50);

    return () => clearTimeout(t);
  }, [debugNav, mobileOpen]);

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

          {/* The actual drawer nav */}
          <OrgNav variant="drawer" />

          {showLogout ? (
            <button className="bf-drawer-logout" type="button" onClick={onLogout}>
              Logout
            </button>
          ) : null}

          {/* Debug block */}
          {debugNav ? (
            <pre className="bf-nav-debug">
              {JSON.stringify(
                {
                  orgId,
                  pathname: loc.pathname,
                  hash: loc.hash,
                  mobileOpen,
                  diag,
                },
                null,
                2
              )}
            </pre>
          ) : null}
        </div>
      </div>
    </header>
  );
}
