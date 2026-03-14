const DEMO_FLAG = "bf_demo_mode_v1";

export function isDemoMode() {
	try {
		return localStorage.getItem(DEMO_FLAG) === "1";
	} catch {
		return false;
	}
}

export function enableDemoMode() {
	try {
		localStorage.setItem(DEMO_FLAG, "1");
	} catch {}
}

export function disableDemoMode() {
	try {
		localStorage.removeItem(DEMO_FLAG);
	} catch {}
}

export function resetDemo() {
	try {
		localStorage.removeItem("bf_demo_state_v1");
		localStorage.removeItem("bf_orgs");
		localStorage.removeItem("bf-demo-user");
		localStorage.removeItem(DEMO_FLAG);
	} catch {}
}
