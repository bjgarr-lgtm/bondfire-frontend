import React, { useEffect, useRef, useState } from "react";

function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);
  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <button className="btn" type="button" onClick={() => setOpen((v) => !v)} style={{ padding: "2px 9px", fontSize: 14 }}>⋯</button>
      {open ? <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", minWidth: 160, background: "rgba(16,16,20,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 6, boxShadow: "0 14px 32px rgba(0,0,0,0.42)", zIndex: 50, display: "grid", gap: 4 }}>
        {items.map((item, idx) => <button key={`${item.label}-${idx}`} className="btn" type="button" onClick={() => { item.onClick?.(); setOpen(false); }} style={{ textAlign: "left", justifyContent: "flex-start", padding: "7px 10px" }}>{item.label}</button>)}
      </div> : null}
    </div>
  );
}

export default function DriveList({ notes, onSelect, onRename, onMove, onDelete, selectedId }) {
  return (
    <div>
      {notes.map((n) => (
        <div key={n.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, padding: 8, borderBottom: "1px solid #222", background: selectedId === n.id ? "rgba(255,255,255,0.06)" : "transparent" }}>
          <div style={{ minWidth: 0 }}>
            <div onClick={() => onSelect(n.id)} style={{ cursor: "pointer" }} title={n.title}>{n.title || "untitled"}</div>
            {n.tags?.length ? <div className="helper" style={{ marginTop: 4 }}>{n.tags.map((tag) => `#${tag}`).join(" ")}</div> : null}
          </div>
          <RowMenu items={[{ label: "Open", onClick: () => onSelect(n.id) }, { label: "Rename", onClick: () => onRename(n.id) }, { label: "Move", onClick: () => onMove(n.id) }, { label: "Delete", onClick: () => onDelete(n.id) }]} />
        </div>
      ))}
    </div>
  );
}
