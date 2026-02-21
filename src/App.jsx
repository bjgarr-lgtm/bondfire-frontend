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

/* ------------------------------ Auth Context ------------------------------ */
const AuthCtx = React.createContext({
	authed: false,
	loading: true,
	user: null,
	refresh: async () => ({ ok: false }),
	logout: async () => {},
});

async function fetchMe() {
	const res = await fetch("/api/auth/me", {
		method: "GET",
		credentials: "include",
		headers: { Accept: "application/json" },
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok || !data?.ok) return { ok: false, status: res.status, data };
	return { ok: true, user: data.user };
}

function RequireAuth({ children }) {
	const { authed, loading } = React.useContext(AuthCtx);
	if (loading) {
		return <div style={{ padding: 16 }} className="helper">Checking session…</div>;
	}
	if (!authed) return <Navigate to="/signin" replace />;
	return children;
}

/* ---------------------------------- Shell ---------------------------------- */
function Shell() {
	const loc = useLocation();
	const path = loc.pathname || "/";

	const [state, setState] = React.useState({
		authed: false,
		loading: true,
		user: null,
	});

	const refresh = React.useCallback(async () => {
		setState((s) => ({ ...s, loading: true }));
		try {
			const me = await fetchMe();
			if (!me.ok) {
				setState({ authed: false, loading: false, user: null });
				return { ok: false };
			}
			setState({ authed: true, loading: false, user: me.user });
			return { ok: true, user: me.user };
		} catch (e) {
			console.error("auth/me check failed", e);
			setState({ authed: false, loading: false, user: null });
			return { ok: false };
		}
	}, []);

	const logout = React.useCallback(async () => {
		try {
			await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
		} catch {}
		try {
			localStorage.removeItem("demo_user");
		} catch {}
		setState({ authed: false, loading: false, user: null });
		window.location.hash = "#/signin";
		window.location.reload();
	}, []);

	React.useEffect(() => {
		refresh();
		const onAuthChanged = () => refresh();
		window.addEventListener("bf-auth-changed", onAuthChanged);
		return () => window.removeEventListener("bf-auth-changed", onAuthChanged);
	}, [refresh]);

	const ctxValue = React.useMemo(() => ({
		authed: state.authed,
		loading: state.loading,
		user: state.user,
		refresh,
		logout,
	}), [state, refresh, logout]);

	const HomeRoute = () =>
		state.authed ? <Navigate to="/orgs" replace /> : <Navigate to="/signin" replace />;

	// Hide the header on public routes
	const hideHeader = path === "/" || path.startsWith("/p/") || path === "/signin";

	return (
		<AuthCtx.Provider value={ctxValue}>
			{!hideHeader && (
				<AppHeader
					showLogout={state.authed}
					onLogout={logout}
				/>
			)}

			<Routes>
				{/* PUBLIC */}
				<Route path="/p/:slug" element={<PublicPage />} />
				<Route path="/p/*" element={<PublicPage />} />
				<Route path="/signin" element={<SignIn />} />

				{/* Landing */}
				<Route path="/" element={<HomeRoute />} />

				{/* Orgs list */}
				<Route
					path="/orgs"
					element={
						<RequireAuth>
							<OrgDash />
						</RequireAuth>
					}
				/>

				{/* User security */}
				<Route
					path="/security"
					element={
						<RequireAuth>
							<Security />
						</RequireAuth>
					}
				/>

				{/* ORG SPACE */}
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
					<Route path="guard/*" element={<OrgSecretGuard />} />
				</Route>

				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</AuthCtx.Provider>
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
