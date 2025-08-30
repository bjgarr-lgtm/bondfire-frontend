// src/App.jsx
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import OrgPublicPreview from './pages/OrgPublicPreview.jsx';
import AppHeader     from './components/AppHeader.jsx';
import PublicPage    from './pages/PublicPage.jsx';
import Overview      from './pages/Overview.jsx';
import OrgDash       from './pages/OrgDash.jsx';
import InnerSanctum  from './pages/InnerSanctum.jsx';
import People        from './pages/People.jsx';
import Inventory     from './pages/Inventory.jsx';
import Meetings      from './pages/Meetings.jsx';
import Needs         from './pages/Needs.jsx';
import Settings      from './pages/Settings.jsx';
import BambiChat from "./pages/BambiChat.jsx";

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

function RequireAuth({ children }){
  const token = localStorage.getItem('bf_auth_token') || sessionStorage.getItem('bf_auth_token');
  const demo  = localStorage.getItem('demo_user');
  if (!token && !demo) return <Navigate to="/orgs" replace />;
  return children;
}

// Small shell so we can hide the header on landing/orgs/public
function Shell() {
  const loc = useLocation();
  const path = loc.pathname || "/";
  const hideHeader = path === '/' || path === '/orgs' || path.startsWith('/p/');

  return (
    <>
      {!hideHeader && <AppHeader />}

      <Routes>
        {/* PUBLIC (top-level, no auth) */}
        <Route path="/p/:slug" element={<PublicPage />} />
        {/* extra fallback to catch any /p/... variations */}
        <Route path="/p/*" element={<PublicPage />} />

        {/* Landing / Orgs list */}
        <Route path="/" element={<OrgDash />} />
        <Route path="/orgs" element={<OrgDash />} />

        {/* Org space (auth-gated) */}
        <Route path="/org/:orgId/*" element={<RequireAuth><InnerSanctum/></RequireAuth>}>
          <Route index element={<Overview />} />
          <Route path="overview" element={<Overview />} />
          <Route path="people" element={<People />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="needs" element={<Needs />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="settings" element={<Settings />} />
          <Route path="public" element={<OrgPublicPreview />} />   {/* <— add this */}
          <Route path="chat" element={<BambiChat />} />
        </Route>

        {/* Catch‑all */}
        <Route path="*" element={<Navigate to="/orgs" replace />} />
      </Routes>
    </>
  );
}

export default function App(){
  return (
    <HashRouter>
      <ErrorBoundary>
        <Shell />
      </ErrorBoundary>
    </HashRouter>
  );
}
