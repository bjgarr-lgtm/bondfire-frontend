import React from "react";

export default function NoteInspector({ note, backlinks, onOpenNote, onClose }) {
  return (
    <div
      className="card"
      style={{
        padding: 14,
        background: "rgba(11,11,11,0.96)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Inspector</h3>
        <button className="btn" type="button" onClick={onClose}>Close</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div className="helper">
          updated {note?.updatedAt ? new Date(note.updatedAt).toLocaleString() : ""}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8 }}>Tags</h4>
        {note?.tags?.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {note.tags.map((tag) => (
              <span key={tag} className="tag">#{tag}</span>
            ))}
          </div>
        ) : (
          <div className="helper">No tags yet.</div>
        )}
      </div>

      <div>
        <h4 style={{ marginBottom: 8 }}>Backlinks</h4>
        {backlinks.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {backlinks.map((item) => (
              <button key={item.id} className="btn" type="button" onClick={() => onOpenNote(item.id)}>
                {item.title}
              </button>
            ))}
          </div>
        ) : (
          <div className="helper">No backlinks yet.</div>
        )}
      </div>
    </div>
  );
}