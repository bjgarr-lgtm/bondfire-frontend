import React from "react";

export default function DriveList({ notes, onSelect, onMove, onDelete }) {
  const getTitle = (blob) => {
    try {
      return JSON.parse(atob(blob)).title || "untitled";
    } catch {
      return "untitled";
    }
  };

  return (
    <div>
      {notes.map((n) => (
        <div key={n.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: 8, borderBottom: "1px solid #222" }}>
          <span onClick={() => onSelect(n)} style={{ cursor: "pointer", minWidth: 0, flex: 1 }} title={getTitle(n.blob)}>
            {getTitle(n.blob)}
          </span>
          <span style={{ display: "flex", gap: 4 }}>
            <button className="btn" type="button" onClick={() => onMove(n.id)}>move</button>
            <button className="btn" type="button" onClick={() => onDelete(n.id)}>x</button>
          </span>
        </div>
      ))}
    </div>
  );
}
