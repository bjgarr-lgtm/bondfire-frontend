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
function RequireAuth({ authed, loading, children }) {
  if (loading) return null;
  const demo = localStorage.getItem("demo_user");
  if (!authed && !demo) return <Navigate to="/signin" replace />;
  return children;
}

async function logoutEverywhere() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {}
  try {
    localStorage.removeItem("demo_user");
  } catch {}
  window.location.hash = "#/signin";
  window.location.reload();
}

/* ---------------------------------- Shell ---------------------------------- */
function Shell() {
  const loc = useLocation();
  const path = loc.pathname || "/";

  const [authLoading, setAuthLoading] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);

  // Re-check auth on initial load AND whenever the route changes.
  // Without this, a user can successfully log in (cookies set) but still be
  // treated as unauthenticated until a full page reload.
  React.useEffect(() => {
    let alive = true;
    // IMPORTANT: when the path changes, we must re-enter a loading state.
    // Otherwise RequireAuth can immediately redirect based on stale `authed=false`
    // before the cookie-based `/api/auth/me` check completes, causing a login loop.
    setAuthLoading(true);
    (async () => {
      try {
        const me = await fetch("/api/auth/me", { credentials: "include" });
        if (me.ok) {
          if (alive) { setAuthed(true); setAuthLoading(false); }
          return;
        }
        const r = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
        if (r.ok) {
          const me2 = await fetch("/api/auth/me", { credentials: "include" });
          if (alive) { setAuthed(!!me2.ok); setAuthLoading(false); }
          return;
        }
        if (alive) { setAuthed(false); setAuthLoading(false); }
      } catch {
        if (alive) { setAuthed(false); setAuthLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, [path]);

  const HomeRoute = () =>
    authed ? <Navigate to="/orgs" replace /> : <Navigate to="/signin" replace />;

  // Hide the header on public routes (keeps the "landing" clean)
  const hideHeader = path === "/" || path.startsWith("/p/") || path === "/signin";

  return (
    <>
      {!hideHeader && (
        <AppHeader
          showLogout={authed}
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
            <RequireAuth authed={authed} loading={authLoading}>
              <OrgDash />
            </RequireAuth>
          }
        />

        {/* User security (auth-gated) */}
        <Route
          path="/security"
          element={
            <RequireAuth authed={authed} loading={authLoading}>
              <Security />
            </RequireAuth>
          }
        />

        {/* ORG SPACE (auth-gated) */}
        <Route
          path="/org/:orgId/*"
          element={
            <RequireAuth authed={authed} loading={authLoading}>
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
