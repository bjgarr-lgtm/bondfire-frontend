// src/App.jsx
import React from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

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

class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state = { error: null }; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(error, info){ console.error("App error boundary:", error, info); }
  render(){
    if (this.state.error) {
      return (
        <div style={{ padding:16 }}>
          <h2 style={{ color:"crimson" }}>Something broke.</h2>
          <pre style={{ whiteSpace:"pre-wrap" }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function hasToken() {
  return !!(
    localStorage.getItem("bf_auth_token") ||
    sessionStorage.getItem("bf_auth_token") ||
    localStorage.getItem("demo_user")
  );
}

function RequireAuth({ children }) {
  if (!hasToken()) return <Navigate to="/signin" replace />;
  return children;
}

function Shell() {
  const loc = useLocation();
  const path = loc.pathname || "/";

  // Hide header on landing/orgs/public
  const hideHeader =
    path === "/" ||
    path === "/orgs" ||
    path.startsWith("/p/");

  const onLogout = () => {
    try {
      localStorage.removeItem("bf_auth_token");
      sessionStorage.removeItem("bf_auth_token");
      localStorage.removeItem("demo_user");
    } catch {}
    window.location.hash = "/signin";
  };

  return (
    <>
      {!hideHeader && (
        <AppHeader onLogout={onLogout} showLogout={hasToken()} />
      )}

      <Routes>
        {/* Public routes */}
        <Route path="/p/:slug" element={<PublicPage />} />
        <Route path="/p/*" element={<PublicPage />} />

        {/* Landing / Orgs list */}
        <Route path="/" element={hasToken() ? <Navigate to="/orgs" replace /> : <Navigate to="/signin" replace />} />
        <Route path="/orgs" element={<OrgDash />} />

        {/* Sign in */}
        <Route path="/signin" element={hasToken() ? <Navigate to="/orgs" replace /> : <SignIn />} />

        {/* Org space (auth required) */}
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
        <Route path="*" element={<Navigate to={hasToken() ? "/orgs" : "/signin"} replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <Shell />
      </ErrorBoundary>
    </HashRouter>
  );
}
