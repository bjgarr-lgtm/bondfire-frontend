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
import MeetingDetail from "./pages/MeetingDetail.jsx";
import Needs from "./pages/Needs.jsx";
import Settings from "./pages/Settings.jsx";
import BondfireChat from "./pages/BondfireChat.jsx";
import SignIn from "./pages/SignIn.jsx";
import Security from "./pages/Security.jsx";

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
    console.error("App error boundary:", error);
    console.error("App error boundary stack:", error?.stack);
    console.error("App error boundary component stack:", info?.componentStack);
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
function RequireAuth({ children }) {
  const nav = useNavigate();
  const [checking, setChecking] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!alive) return;
        if (res.ok) {
          setAuthed(true);
        } else {
          setAuthed(false);
          nav("/signin", { replace: true });
        }
      } catch {
        if (!alive) return;
        setAuthed(false);
        nav("/signin", { replace: true });
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, [nav]);

  if (checking) return null;
  if (!authed) return null;
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

/* ---------------------------------- Shell ---------------------------------- */
function Shell() {
  const loc = useLocation();
  const path = loc.pathname || "/";

  const hasAuth = !!getToken();

  const HomeRoute = () =>
    hasAuth ? <Navigate to="/orgs" replace /> : <Navigate to="/signin" replace />;

  // Hide the header on public routes (keeps the "landing" clean)
  const hideHeader = path === "/" || path.startsWith("/p/") || path === "/signin";

  return (
    <>
      {!hideHeader && (
        <AppHeader
          showLogout={hasAuth}
          onLogout={logoutEverywhere}
        />
      )}


      <Routes>
        {/* PUBLIC */}
        <Route path="/p/:slug" element={<PublicPage />} />
        <Route path="/p/*" element={<PublicPage />} />
        <Route path="/signin" element={<SignIn />} />

        {/* Landing */}
        <Route path="/" element={<HomeRoute />} />

        {/* Orgs list (auth-gated) */}
        <Route
          path="/orgs"
          element={
            <RequireAuth>
              <OrgDash />
            </RequireAuth>
          }
        />

        {/* User security (auth-gated) */}
        <Route
          path="/security"
          element={
            <RequireAuth>
              <Security />
            </RequireAuth>
          }
        />

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
          <Route path="meetings/:meetingId" element={<MeetingDetail />} />
          <Route path="settings" element={<Settings />} />
          <Route path="public" element={<OrgPublicPreview />} />
          <Route path="chat" element={<BondfireChat />} />
          {/* Secret guard stays available as you had it */}
          <Route path="guard/*" element={<OrgSecretGuard />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
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
