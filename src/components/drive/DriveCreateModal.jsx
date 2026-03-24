import React from "react";

export default function DriveCreateModal({ open, onClose, title = "New", actions = [] }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.56)", zIndex: 160, display: "grid", placeItems: "start center", paddingTop: 72 }} onClick={onClose}>
      <div className="card" style={{ width: "min(1120px, calc(100vw - 48px))", padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 800 }}>＋ {title}</div>
            <div className="helper">Create a new document or folder, or import existing files into this folder.</div>
          </div>
          <button className="btn" type="button" onClick={onClose}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => { action.onClick?.(); onClose?.(); }}
              style={{ display: "grid", gap: 12, alignContent: "start", minHeight: 120, padding: 16, borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", color: "#fff", textAlign: "left", cursor: "pointer" }}
            >
              <div style={{ fontSize: 30 }}>{action.icon || "•"}</div>
              <div style={{ fontWeight: 800 }}>{action.label}</div>
              <div className="helper">{action.hint || ""}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
