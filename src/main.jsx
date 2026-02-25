import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from "virtual:pwa-register";

// --- PWA / Service Worker ---
// Do NOT reload the app while someone is typing into the sign-in form.
// Forced reloads clear inputs and look like the page is "blinking".
function isSignInRoute() {
	try {
		const h = String(window.location.hash || "");
		const p = String(window.location.pathname || "");
		return h.startsWith("#/signin") || h.includes("#/signin") || p === "/signin";
	} catch {
		return false;
	}
}

if (isSignInRoute() && "serviceWorker" in navigator) {
	// Proactively unregister to kill any old SW that was forcing reloads.
	navigator.serviceWorker
		.getRegistrations()
		.then((regs) => {
			for (const r of regs) r.unregister().catch(() => {});
		})
		.catch(() => {});
} else {
	registerSW({
		// Never auto-reload. If there is an update, it will apply on the next navigation/reload.
		immediate: false,
		onNeedRefresh() {
			console.log("BOND🔥 update available; will apply on next reload.");
			window.__BF_NEED_REFRESH = true;
		},
	});
}


// === CANARY: proves a new build is running ===
const __BUILD_STAMP__ = new Date().toISOString() + ' #' + Math.floor(Math.random()*1e6);
console.log('BOND🔥 build:', __BUILD_STAMP__);
window.__BF_BUILD = __BUILD_STAMP__;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

