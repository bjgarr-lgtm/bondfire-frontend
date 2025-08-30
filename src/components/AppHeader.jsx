// src/components/AppHeader.jsx
import React from "react";
import { Link } from "react-router-dom";

// Put /public/logo-bondfire.png in your repo (case-sensitive on Pages)
const Brand = ({ logoSrc = "/logo-bondfire.png" }) => (
  <Link
    to="/orgs"
    className="brand"
    style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
  >
    <img
      src={logoSrc}
      alt="Bondfire"
      width={28}
      height={28}
      onError={(e) => { e.currentTarget.style.display = "none"; }}
      style={{ display: "block" }}
    />
    <span style={{ color: "var(--bfBrand, #fff)", fontWeight: 700 }}>Bondfire</span>
  </Link>
);

export default function AppHeader({ onLogout, showLogout }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderBottom: "1px solid #1f2937",
        background: "#0f0f10",
      }}
    >
      <Brand />
      {/* space for your page-level nav (tabs in InnerSanctum etc.) */}
      <div style={{ marginLeft: "auto" }}>
        {showLogout && (
          <button
            onClick={onLogout}
            className="btn"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "#a40b12",
              color: "#fff",
              border: "1px solid #7a0c12",
              cursor: "pointer",
            }}
            title="Logout"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
