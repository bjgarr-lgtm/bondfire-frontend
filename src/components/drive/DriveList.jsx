import React from "react";

export default function DriveList({ notes, onSelect, onMove, onDelete, onRename, selectedId }) {
  return (
    <div>
      {notes.map((n) => (
        <div
          key={n.id}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 8,
            padding: 8,
            borderBottom: "1px solid #222",
            background: selectedId === n.id ? "rgba(255,255,255,0.05)" : "transparent",
          }}
        >
          <div>
            <div onClick={() => onSelect(n.id)} style={{ cursor: "pointer", minWidth: 0 }} title={n.title}>
              {n.title || "untitled"}
            </div>
            {n.tags?.length ? <div className="helper" style={{ marginTop: 4 }}>{n.tags.map((tag) => `#${tag}`).join(" ")}</div> : null}
          </div>
          <span style={{ display: "flex", gap: 4 }}>
            <button className="btn" type="button" onClick={() => onRename(n.id)}>r</button>
            <button className="btn" type="button" onClick={() => onMove(n.id)}>move</button>
            <button className="btn" type="button" onClick={() => onDelete(n.id)}>x</button>
          </span>
        </div>
      ))}
    </div>
  );
}
