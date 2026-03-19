import React from "react";

export default function DriveList({ notes, folders, onSelect, onMove, onDelete, selectedId }) {
  const folderOptions = [{ id: "", name: "Root" }, ...folders];

  return (
    <div style={{ overflow: "auto", height: "100%" }}>
      {notes.map((note) => (
        <div
          key={note.id}
          style={{
            padding: 8,
            borderBottom: "1px solid #222",
            background: selectedId === note.id ? "rgba(255,255,255,0.05)" : "transparent",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="btn"
              type="button"
              onClick={() => onSelect(note.id)}
              style={{ flex: 1, justifyContent: "flex-start", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={note.title}
            >
              📝 {note.title || "untitled"}
            </button>
            <button className="btn" type="button" onClick={() => onDelete(note.id)}>x</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
            <span className="helper">Move</span>
            <select
              className="input"
              value={note.parentId || ""}
              onChange={(e) => onMove(note.id, e.target.value || null)}
              style={{ padding: 6 }}
            >
              {folderOptions.map((folder) => (
                <option key={folder.id || "root"} value={folder.id || ""}>{folder.name}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
      {!notes.length ? <div className="helper" style={{ padding: 12 }}>No notes in this folder yet.</div> : null}
    </div>
  );
}
