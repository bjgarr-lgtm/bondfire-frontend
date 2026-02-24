import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: "Bondfire",
        short_name: "Bondfire",
        description: "Mutual aid org management",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0b0b0f",
        theme_color: "#0b0b0f",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        // Important for SPAs with hash routes (/app/#/orgs etc.)
        // This keeps the SW from trying to be "helpful" and breaking routing.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        // Ensure updates replace older SW versions promptly.
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
      }
    })
  ]
});
