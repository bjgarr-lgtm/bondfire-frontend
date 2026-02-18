// src/components/AppHeader.jsx
import React from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

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

function goToOrgDash() {
  // Works for BOTH BrowserRouter and HashRouter
  if (typeof window !== "undefined") {
    window.location.hash = "#/orgs";
  }
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
  <NavLink
    to="/orgs"
    className={({ isActive }) => `bf-appnav-link${isActive ? " is-active" : ""}`}
    title="All orgs"
  >
    All Orgs
  </NavLink>

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

  const isDrawer = variant === "drawer";

  // Inline styles for drawer so CSS can't hide it.
  const drawerNavStyle = isDrawer
    ? {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginTop: 14,
      }
    : undefined;

  const drawerLinkStyle = isDrawer
    ? {
        display: "block",
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#fff",
        fontWeight: 700,
      }
    : undefined;

  return (
    <nav
      className={`bf-appnav${isDrawer ? " is-drawer" : ""}`}
      aria-label="Org navigation"
      style={drawerNavStyle}
      data-bf-orgnav={isDrawer ? "drawer" : "desktop"}
    >
      {items.map(([label, to]) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) =>
            isDrawer
              ? {
                  ...drawerLinkStyle,
                  background: isActive ? "rgba(255,0,0,0.20)" : drawerLinkStyle.background,
                  border: isActive ? "1px solid rgba(255,0,0,0.30)" : drawerLinkStyle.border,
                }
              : undefined
          }
          className={({ isActive }) => `bf-appnav-link${isActive ? " is-active" : ""}`}
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
  const orgId = useOrgIdFromPath();
  const nav = useNavigate();

  const goAllOrgs = () => {
    setMobileOpen(false);
    nav("/orgs");
  };


  // Debug toggle: add ?debugNav=1 to URL
  const debugNav =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugNav");

  React.useEffect(() => setMobileOpen(false), [loc.pathname, loc.hash]);

  const [diag, setDiag] = React.useState(null);

  React.useEffect(() => {
    if (!debugNav) return;

    const t = setInterval(() => {
      const drawer = document.querySelector(".bf-drawer");
      const panel = document.querySelector(".bf-drawer-panel");
      const nav = document.querySelector(".bf-drawer-panel nav[data-bf-orgnav='drawer']");
      const link = document.querySelector(".bf-drawer-panel a");

      const panelCS = panel ? window.getComputedStyle(panel) : null;
      const linkCS = link ? window.getComputedStyle(link) : null;
      const linkRect = link ? link.getBoundingClientRect() : null;

      setDiag({
        orgId,
        pathname: loc.pathname,
        hash: loc.hash,
        mobileOpen,
        drawerFound: !!drawer,
        panelFound: !!panel,
        navFound: !!nav,
        linkFound: !!link,
        panelDisplay: panelCS ? panelCS.display : null,
        panelVisibility: panelCS ? panelCS.visibility : null,
        panelOpacity: panelCS ? panelCS.opacity : null,
        panelTransform: panelCS ? panelCS.transform : null,
        panelZ: panelCS ? panelCS.zIndex : null,
        linkDisplay: linkCS ? linkCS.display : null,
        linkVisibility: linkCS ? linkCS.visibility : null,
        linkOpacity: linkCS ? linkCS.opacity : null,
        linkColor: linkCS ? linkCS.color : null,
        linkBG: linkCS ? linkCS.backgroundColor : null,
        linkRect: linkRect
          ? { x: linkRect.x, y: linkRect.y, w: linkRect.width, h: linkRect.height }
          : null,
      });
    }, 500);

    return () => clearInterval(t);
  }, [debugNav, orgId, loc.pathname, loc.hash, mobileOpen]);

  // Inline forced drawer styles so CSS can't make it invisible/offscreen.
  const drawerStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 999999,
    pointerEvents: mobileOpen ? "auto" : "none",
  };

  const backdropStyle = {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    opacity: mobileOpen ? 1 : 0,
    transition: "opacity 160ms ease",
  };

  const panelStyle = {
    position: "absolute",
    top: 0,
    right: 0,
    height: "100%",
    width: "min(340px, 90vw)",
    background: "#0b0b0b",
    borderLeft: "1px solid rgba(255,255,255,0.12)",
    padding: 14,
    overflowY: "auto",
    transform: mobileOpen ? "translateX(0)" : "translateX(100%)",
    transition: "transform 180ms ease",
    color: "#fff",
  };

  const debugOverlayStyle = {
    position: "fixed",
    right: 10,
    bottom: 10,
    zIndex: 1000000,
    width: "min(420px, 92vw)",
    maxHeight: "40vh",
    overflow: "auto",
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.85)",
    color: "#fff",
    fontSize: 12,
    lineHeight: 1.35,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  return (
    <>
      <header className="bf-appHeader">
        <div className="bf-appHeader-left">
          <Brand />
        </div>

        <div className="bf-appHeader-right">
          <div className="bf-nav-desktop">
            <OrgNav variant="desktop" />
          </div>

          {showLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="bf-appnav-link bf-appnav-link-btn"
              title="Logout"
            >
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
      </header>

      {/* Drawer lives outside header so nothing in header layout can clip it */}
      <div className="bf-drawer" style={drawerStyle} role="dialog" aria-modal="true">
        <div style={backdropStyle} onClick={() => setMobileOpen(false)} />
        <div className="bf-drawer-panel" style={panelStyle}>
          <div className="bf-drawer-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div className="bf-drawer-title" style={{ fontWeight: 800, letterSpacing: ".3px" }}>
              Menu
            </div>
            <button
              className="bf-drawer-close"
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              style={{
                height: 40,
                width: 44,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
              }}
            >
              ✕
            </button>
          </div>

          <OrgNav variant="drawer" />

          {showLogout ? (
            <button className="bf-drawer-logout" type="button" onClick={onLogout} style={{ marginTop: 14, width: "100%" }}>
              Logout
            </button>
          ) : null}
        </div>
      </div>

      {/* Always visible debug overlay */}
      {debugNav ? (
        <pre style={debugOverlayStyle}>{JSON.stringify(diag, null, 2)}</pre>
      ) : null}
    </>
  );
}
