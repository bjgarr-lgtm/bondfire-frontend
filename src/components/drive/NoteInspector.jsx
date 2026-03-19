import React from "react";

export default function NoteInspector({ note, backlinks, onOpenNote, onAddRecordLink, onRemoveRecordLink }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="helper" style={{ marginBottom: 8 }}>
        updated {note?.updatedAt ? new Date(note.updatedAt).toLocaleString() : ""}
      </div>

      <div style={{ marginBottom: 14 }}>
        <h4 style={{ marginBottom: 8 }}>Tags</h4>
        {note?.tags?.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {note.tags.map((tag) => (
              <span key={tag} className="tag">#{tag}</span>
            ))}
          </div>
        ) : (
          <div className="helper">No tags yet. Add #tags in the note body.</div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <h4 style={{ margin: 0 }}>Linked records</h4>
          <button className="btn" type="button" onClick={onAddRecordLink}>+ Link</button>
        </div>
        {note?.recordLinks?.length ? (
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            {note.recordLinks.map((link) => (
              <div key={link.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div>
                  <div>{link.label}</div>
                  <div className="helper">{link.targetType}:{link.targetId}</div>
                </div>
                <button className="btn" type="button" onClick={() => onRemoveRecordLink(link.id)}>x</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="helper" style={{ marginTop: 8 }}>No linked records.</div>
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
