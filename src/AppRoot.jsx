import React from "react";
import AppShell from "./AppShell";
import App from "./App"; // your existing App

export default function AppRoot() {
  // If your App already renders routes/pages, this wraps providers + header around it.
  return (
    <AppShell>
      <App />
    </AppShell>
  );
}
