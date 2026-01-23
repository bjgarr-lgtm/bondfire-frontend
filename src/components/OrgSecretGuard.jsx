// src/components/OrgSecretGuard.jsx
import React from "react";
import { Navigate } from "react-router-dom";

/**
 * Minimal guard. By default it just lets children render.
 * If you flip VITE_REQUIRE_ORG_SECRET=on, it will require a local secret.
 */
export default function OrgSecretGuard({ children }) {
  const requireSecret =
    (import.meta?.env?.VITE_REQUIRE_ORG_SECRET || "off") === "on";

  if (!requireSecret) return children;

  // Example check; customize to your needs
  const token =
    localStorage.getItem("bf_auth_token") ||
    sessionStorage.getItem("bf_auth_token");
  const secret = localStorage.getItem("bf_org_secret");

  if (token && secret) return children;
  return <Navigate to="/signin" replace />;
}
