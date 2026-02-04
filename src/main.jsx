import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// === CANARY: proves a new build is running ===
const __BUILD_STAMP__ = new Date().toISOString() + ' #' + Math.floor(Math.random()*1e6);
console.log('BOND🔥 build:', __BUILD_STAMP__);
window.__BF_BUILD = __BUILD_STAMP__;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: register service worker (optional but recommended)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // swallow; PWA should not break the app
    });
  });
}

