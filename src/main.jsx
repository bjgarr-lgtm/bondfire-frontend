import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from "virtual:pwa-register";

// PWA: single registration path.
// IMPORTANT: do NOT also call navigator.serviceWorker.register() manually.
// Double-registration can strand users on stale caches until they "unregister the SW".
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Prefer self-healing over leaving the UI half-updated.
    try {
      updateSW(true);
    } finally {
      window.location.reload();
    }
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

