import React from "react";

function Tile({ label, hint, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "grid",
        gap: 8,
        alignContent: "start",
        textAlign: "left",
        padding: 14,
        minHeight: 104,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 14,
        color: "#f5f5f5",
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 24, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{hint}</div>
    </button>
  );
}

export default function DriveCreateModal({ open, onClose, actions = [] }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        background: "rgba(0,0,0,0.62)",
        display: "grid",
        placeItems: "start center",
        paddingTop: 68,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1120px, calc(100vw - 32px))",
          background: "#202124",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 18,
          padding: 22,
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 8 }}>＋ New</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Create a new document or folder, or import files into the current folder.</div>
          </div>
          <button className="btn" type="button" onClick={onClose} style={{ padding: "8px 10px" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 14 }}>
          {actions.map((action) => (
            <Tile
              key={action.id}
              label={action.label}
              hint={action.hint}
              icon={action.icon}
              onClick={() => {
                action.onClick?.();
                onClose?.();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
