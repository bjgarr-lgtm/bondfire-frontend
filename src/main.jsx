import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import "./debug/initDebug.js";

// Service worker policy:
// - Keep PWA features.
// - NEVER force a reload (that is what nukes crypto / IndexedDB state mid-session).
// - If an update is available, we just set a flag. You can add a banner later.

registerSW({
  immediate: false,
  onNeedRefresh() {
    console.log("Bondfire update available; will apply on next reload.");
    window.__BF_NEED_REFRESH = true;
  },
  onOfflineReady() {
    window.__BF_OFFLINE_READY = true;
  },
});

// Canary build stamp (stable for this load).
// Helpful when debugging "am I looking at the new deploy or cached garbage?"
try {
  const stamp = new Date().toISOString();
  console.log("BONDFIRE build:", stamp);
  window.__BF_BUILD = stamp;
} catch {}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
