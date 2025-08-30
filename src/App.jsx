// src/App.jsx
import React from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

// PAGES
import OrgPublicPreview from "./pages/OrgPublicPreview.jsx";
import PublicPage from "./pages/PublicPage.jsx";
import Overview from "./pages/Overview.jsx";
import OrgDash from "./pages/OrgDash.jsx";
import InnerSanctum from "./pages/InnerSanctum.jsx";
import People from "./pages/People.jsx";
import Inventory from "./pages/Inventory.jsx";
import Meetings from "./pages/Meetings.jsx";
import Needs from "./pages/Needs.jsx";
import Settings from "./pages/Settings.jsx";
import BambiChat from "./pages/BambiChat.jsx";
import SignIn from "./pages/SignIn.jsx";

// COMPONENTS
import AppHeader from "./components/AppHeader.jsx";
import OrgSecretGuard from "./components/OrgSecretGuard.jsx";

/* -------------------------------- Error Boundary ------------------------------- */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("App error boundary:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16 }}>
          <h2 style={{ color: "crimson" }}>Something broke.</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------ Auth helpers ------------------------------ */
function getToken() {
  return (
    localStorage.getItem("bf_auth_token") ||
    sessionStorage.getItem("bf_auth_token")
  );
}

function RequireAuth({ children }) {
  const token = getToken();
  const demo = localStorage.getItem("demo_user");
  if (!token && !demo) return <Navigate to="/signin" replace />;
  return children;
}

function logoutEverywhere() {
  try {
    localStorage.removeItem("bf_auth_token");
    sessionStorage.removeItem("bf_auth_token");
    localStorage.removeItem("demo_user");
  } catch {}
  // optional: nuke any cached org/session bits you use
  window.location.hash = "#/signin";
  window.location.reload();
}

/* ------------------------------ Floating Logout ------------------------------ */
/** Renders a small logout button near the header brand (left side),
 *  and hides itself on pages where the header is hidden. */
function GlobalLogoutButton() {
  const loc = useLocation();
  const token = getToken();

  // pages where we don't show header or the button
  const path = loc.pathname || "/";
  const hide =
    path === "/" || path === "/orgs" || path.startsWith("/p/") || path === "/signin";

  if (!token || hide) return null;

  // Nudge to the right of the brand area so it doesn't overlap the logo
  const btnStyle = {
    position: "fixed",
    top: 10,
    left: 140, // <- adjust if your brand is wider/narrower
    zIndex: 1000,
    padding: "6px 10px",
    fontSize: 12,
    borderRadius: 8,
    background: "#111",
    color: "#eee",
    border: "1px solid #333",
    cursor: "pointer",
    opacity: 0.9,
  };

  return (
    <button title="Logout" style={btnStyle} onClick={logoutEverywhere}>
      Logout
    </button>
  );
}

/* ---------------------------------- Shell ---------------------------------- */
function Shell() {
  const loc = useLocation();
  const path = loc.pathname || "/";

  // Hide the header on landing/public routes (keeps your old behavior)
  const hideHeader =
    path === "/" || path === "/orgs" || path.startsWith("/p/") || path === "/signin";

  return (
    <>
      {!hideHeader && <AppHeader />}
      <GlobalLogoutButton />

      <Routes>
        {/* PUBLIC */}
        <Route path="/p/:slug" element={<PublicPage />} />
        <Route path="/p/*" element={<PublicPage />} />
        <Route path="/signin" element={<SignIn />} />

        {/* Landing / Orgs list */}
        <Route path="/" element={<OrgDash />} />
        <Route path="/orgs" element={<OrgDash />} />

        {/* ORG SPACE (auth-gated) */}
        <Route
          path="/org/:orgId/*"
          element={
            <RequireAuth>
              <InnerSanctum />
            </RequireAuth>
          }
        >
          <Route index element={<Overview />} />
          <Route path="overview" element={<Overview />} />
          <Route path="people" element={<People />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="needs" element={<Needs />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="settings" element={<Settings />} />
          <Route path="public" element={<OrgPublicPreview />} />
          <Route path="chat" element={<BambiChat />} />
          {/* Secret guard stays available as you had it */}
          <Route path="guard/*" element={<OrgSecretGuard />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/orgs" replace />} />
      </Routes>
    </>
  );
}

/* ---------------------------------- App ---------------------------------- */
export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <Shell />
      </ErrorBoundary>
    </HashRouter>
  );
}
