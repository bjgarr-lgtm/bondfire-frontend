// src/App.jsx
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import AppHeader       from './components/AppHeader.jsx';
import OrgPublicPreview from './pages/OrgPublicPreview.jsx';
import PublicPage      from './pages/PublicPage.jsx';
import Overview        from './pages/Overview.jsx';
import OrgDash         from './pages/OrgDash.jsx';
import InnerSanctum    from './pages/InnerSanctum.jsx';
import People          from './pages/People.jsx';
import Inventory       from './pages/Inventory.jsx';
import Meetings        from './pages/Meetings.jsx';
import Needs           from './pages/Needs.jsx';
import Settings        from './pages/Settings.jsx';
import BambiChat       from './pages/BambiChat.jsx';
import OrgSecretGuard  from './components/OrgSecretGuard.jsx'; // (import kept if used elsewhere)
import SignIn          from './pages/SignIn.jsx';

class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(error, info){ console.error('App error boundary:', error, info); }
  render(){
    if (this.state.error) {
      return (
        <div style={{ padding:16 }}>
          <h2 style={{ color:'crimson' }}>Something broke.</h2>
          <pre style={{ whiteSpace:'pre-wrap' }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function isAuthed() {
  return (
    localStorage.getItem('bf_auth_token') ||
    sessionStorage.getItem('bf_auth_token') ||
    localStorage.getItem('demo_user')
  );
}

function RequireAuth({ children }) {
  if (!isAuthed()) return <Navigate to="/signin" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  // If already signed in and we hit /signin, bounce to /orgs
  return isAuthed() ? <Navigate to="/orgs" replace /> : children;
}

// Small shell so we can hide the header on landing/signin/public pages
function Shell() {
  const loc = useLocation();
  const path = loc.pathname || '/';
  const hideHeader =
    path === '/' || path === '/signin' || path === '/orgs' || path.startsWith('/p/');

  return (
    <>
      {!hideHeader && <AppHeader />}

      <Routes>
        {/* PUBLIC (top-level, no auth) */}
        <Route path="/p/:slug" element={<PublicPage />} />
        <Route path="/p/*" element={<PublicPage />} />

        {/* Sign in is the new home */}
        <Route path="/" element={<Navigate to="/signin" replace />} />
        <Route
          path="/signin"
          element={
            <RedirectIfAuthed>
              <SignIn />
            </RedirectIfAuthed>
          }
        />

        {/* Orgs list (requires auth) */}
        <Route path="/orgs" element={<RequireAuth><OrgDash /></RequireAuth>} />

        {/* Org space (requires auth) */}
        <Route
          path="/org/:orgId/*"
          element={<RequireAuth><InnerSanctum /></RequireAuth>}
        >
          <Route index element={<Overview />} />
          <Route path="overview"   element={<Overview />} />
          <Route path="people"     element={<People />} />
          <Route path="inventory"  element={<Inventory />} />
          <Route path="needs"      element={<Needs />} />
          <Route path="meetings"   element={<Meetings />} />
          <Route path="settings"   element={<Settings />} />
          <Route path="public"     element={<OrgPublicPreview />} />
          <Route path="chat"       element={<BambiChat />} />
        </Route>

        {/* Catch-all -> signin */}
        <Route path="*" element={<Navigate to="/signin" replace />} />
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
