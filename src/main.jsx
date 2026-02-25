import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from "virtual:pwa-register";

// PWA: single registration path.
// IMPORTANT: do NOT also call navigator.serviceWorker.register() manually.
// Double-registration can strand users on stale caches until they "unregister the SW".
const updateSW = registerSW({
  // DO NOT auto-refresh the page when a new Service Worker is available.
  // Auto-reloads wipe sign-in form state and feel like "the page blinked".
  // Users can naturally pick up the new SW on next navigation/reload.
  immediate: false,
  onNeedRefresh() {
    // Intentionally no-op.
    // If you later add a toast UI, call updateSW(true) only after user confirms.
    console.log("BOND🔥 update available (SW). Will apply on next reload.");
  },
});


// === CANARY: proves a new build is running ===
const __BUILD_STAMP__ = new Date().toISOString() + ' #' + Math.floor(Math.random()*1e6);
console.log('BOND🔥 build:', __BUILD_STAMP__);
window.__BF_BUILD = __BUILD_STAMP__;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

