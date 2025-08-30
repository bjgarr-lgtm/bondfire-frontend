// src/App.jsx
import React from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import AppHeader from "./components/AppHeader.jsx";

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

// If you still have this file in your repo, keep the import.
// If not, you can safely delete this line.
// import OrgSecretGuard from "./components/OrgSecretGuard.jsx";

/* ----------------- error boundary ----------------- */
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

/* ----------------- auth helpers ----------------- */
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

/* ---------- global floating logout button --------- */
function FloatingLogout() {
  const navigate = useNavigate();
  const token = getToken();
  if (!token) return null;

  const doLogout = () => {
    try {
      localStorage.removeItem("bf_auth_token");
      sessionStorage.removeItem("bf_auth_token");
      // Clear any extra flags you may set
      localStorage.removeItem("demo_user");
    } catch {}
    navigate("/signin", { replace: true });
  };

  return (
    <button
      onClick={doLogout}
      style={{
        position: "fixed",
        top: 10,
        right: 10,
        zIndex: 1000,
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #333",
        background: "#111",
        color: "#fff",
        cursor: "pointer",
        opacity: 0.9,
      }}
      aria-label="Log out"
      title="Log out"
    >
      Logout
    </button>
  );
}

/* -------------------- shell ---------------------- */
/** We keep your header visibility rules, but add the floating logout so
 * it’s available even on routes where the header is hidden. */
function Shell() {
  const loc = useLocation();
  const path = loc.pathname || "/";
  const hideHeader = path === "/" || path === "/orgs" || path.startsWith("/p/");

  return (
    <>
      {!hideHeader && <AppHeader />}
      <FloatingLogout />

      <Routes>
        {/* PUBLIC (no auth) */}
        <Route path="/p/:slug" element={<PublicPage />} />
        <Route path="/p/*" element={<PublicPage />} />

        {/* Sign in */}
        <Route path="/signin" element={<SignIn />} />

        {/* Landing / Orgs list
            If you want the landing to be SignIn when no token,
            we’ll redirect “/” accordingly below in RootGate. */}
        <Route path="/orgs" element={<OrgDash />} />

        {/* Org space (auth-gated) */}
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
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

/* ----------- root gate (handles “/”) ------------- */
/** If a token exists, send them into the app (OrgDash).
 *  If no token, send to /signin. */
function RootGate() {
  const token = getToken();
  const demo = localStorage.getItem("demo_user");
  if (token || demo) {
    return <Navigate to="/orgs" replace />;
  }
  return <Navigate to="/signin" replace />;
}

/* --------------------- app ----------------------- */
export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <Routes>
          {/* Home route decides based on token */}
          <Route path="/" element={<RootGate />} />
          {/* Everything else inside the shell */}
          <Route path="/*" element={<Shell />} />
        </Routes>
      </ErrorBoundary>
    </HashRouter>
  );
}
