import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from "virtual:pwa-register";

// PWA: single registration path.
// IMPORTANT: do NOT also call navigator.serviceWorker.register() manually.
// Double-registration can strand users on stale caches until they "unregister the SW".
// NOTE: Do NOT auto-reload the page when a new Service Worker is available.
// It nukes in-progress forms (sign-in) and feels like the app is "blinking".
// New SW will activate on the next navigation/reload.
registerSW({
  immediate: false,
  onNeedRefresh() {
    // Intentionally noop. If we later add a toast/UI prompt, it can live here.
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

