import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from "virtual:pwa-register";

// PWA: single registration path.
// IMPORTANT: do NOT also call navigator.serviceWorker.register() manually.
// Double-registration can strand users on stale caches until they "unregister the SW".
const updateSW = registerSW({
  // Do NOT auto-reload the app in the middle of sign-in (or any form).
  // If there is an update, we mark it and let the next navigation/reload pick it up.
  immediate: false,
  onNeedRefresh() {
    console.log("BOND🔥 update available; will apply on next reload.");
    window.__BF_NEED_REFRESH = false;
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

