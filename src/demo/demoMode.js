// src/demo/demoMode.js
// Minimal demo mode session helpers.
// This is intentionally tiny: it enables a safe, local-only demo flag
// without changing existing auth or API behavior yet.

const DEMO_KEY = "bf_demo_mode";

export function isDemoMode() {
	try {
		return localStorage.getItem(DEMO_KEY) === "1";
	} catch {
		return false;
	}
}

export function enableDemoMode() {
	try {
		localStorage.setItem(DEMO_KEY, "1");
	} catch {}
}

export function disableDemoMode() {
	try {
		localStorage.removeItem(DEMO_KEY);
	} catch {}
}

export function resetDemo() {
	disableDemoMode();
	try {
		Object.keys(localStorage).forEach((key) => {
			if (key.startsWith("bf_demo_")) localStorage.removeItem(key);
		});
	} catch {}
}
