// src/components/AppHeader.jsx
import React from "react";
import { Link } from "react-router-dom";

// Put a logo file at: public/bondfire-logo.svg  (or .png)  — see notes below.
const Brand = ({ logoSrc = "/logo-bondfire.png" }) => (
  <Link to="/orgs" className="brand" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
    <img
      src={logoSrc}
      alt="Bondfire"
      width={28}
      height={28}
      onError={(e) => { e.currentTarget.style.display = "none"; }} // hide if missing
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
        background: "#0f0f10"
      }}
    >
      <Brand />

      {/* spacer before nav */}
      <nav style={{ display: "flex", gap: 8, marginLeft: 10 }}>
        {/* Your existing header nav buttons/links remain as-is in the page shells */}
      </nav>

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
              cursor: "pointer"
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
