export const DEMO_MODE_KEY = "bf_demo_mode";

export function isDemoMode() {
	try {
		return localStorage.getItem(DEMO_MODE_KEY) === "1";
	} catch {
		return false;
	}
}

export function enableDemoMode(source = "manual") {
	try {
		localStorage.setItem(DEMO_MODE_KEY, "1");
		localStorage.setItem("bf_demo_source", String(source || "manual"));
	} catch {}
}

export function disableDemoMode() {
	try {
		localStorage.removeItem(DEMO_MODE_KEY);
		localStorage.removeItem("bf_demo_source");
		localStorage.removeItem("bf-demo-user");
		localStorage.removeItem("bf_orgs");
	} catch {}
}

export function resetDemo() {
	disableDemoMode();
}
