import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from "virtual:pwa-register";

// --- PWA / Service Worker ---
// Goal: keep PWA features, but NEVER auto-reload while someone is on sign-in,
// and break any stale SW-cache loops that keep serving an old build.
//
// If a previously-installed SW is still controlling this page, it can keep the
// *old* JS bundle alive even after deploy. That looks like “blinking” and input
// wipes. We do a one-time cleanup on sign-in to force the new build to load,
// then we keep SW enabled normally.

function isSignInRoute() {
  try {
    const h = String(window.location.hash || "");
    const p = String(window.location.pathname || "");
    return h.startsWith("#/signin") || h.includes("#/signin") || p === "/signin";
  } catch {
    return false;
  }
}

async function cleanupStaleSWOnce() {
  if (!("serviceWorker" in navigator)) return false;

  // Only do this on sign-in, and only once per tab-session.
  if (!isSignInRoute()) return false;
  const flag = "bf_sw_cleanup_done_v1";
  try {
    if (sessionStorage.getItem(flag) === "1") return false;
    sessionStorage.setItem(flag, "1");
  } catch {
    // If sessionStorage is blocked, just don't do the cleanup.
    return false;
  }

  // If there is no controller and no registrations, nothing to clean.
  let regs = [];
  try {
    regs = await navigator.serviceWorker.getRegistrations();
  } catch {}

  const hasController = !!navigator.serviceWorker.controller;
  if (!hasController && (!regs || regs.length === 0)) return false;

  // Unregister everything.
  try {
    await Promise.all((regs || []).map((r) => r.unregister().catch(() => false)));
  } catch {}

  // Clear caches so we don't keep serving stale HTML/JS.
  try {
    if (window.caches && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch {}

  return true;
}

(async () => {
  // One-time SW cleanup on sign-in to stop the “blink” caused by stale cached builds.
  const didCleanup = await cleanupStaleSWOnce();
  if (didCleanup) {
    // Reload immediately BEFORE the app renders, so inputs don't get wiped mid-typing.
    // This is a single fast reload per session, not an update loop.
    window.location.replace(window.location.href);
    return;
  }

  // Register SW everywhere (including sign-in) but NEVER force reload.
  registerSW({
    immediate: false,
    onNeedRefresh() {
      // Do not reload automatically; set a flag so the app can show a banner later if desired.
      console.log("Bondfire update available; will apply on next reload.");
      window.__BF_NEED_REFRESH = true;
    },
    onOfflineReady() {
      window.__BF_OFFLINE_READY = true;
    },
  });

  // === CANARY: proves a new build is running ===
  const __BUILD_STAMP__ = new Date().toISOString() + ' #' + Math.floor(Math.random()*1e6);
  console.log('BONDFIRE build:', __BUILD_STAMP__);
  window.__BF_BUILD = __BUILD_STAMP__;

  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
})();