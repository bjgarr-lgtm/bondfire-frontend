import React, { useEffect, useRef, useState } from "react";

function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <button className="btn" type="button" onClick={() => setOpen((v) => !v)} style={{ padding: "2px 9px", fontSize: 14 }}>⋯</button>
      {open ? (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", minWidth: 150, background: "rgba(16,16,20,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 6, boxShadow: "0 14px 32px rgba(0,0,0,0.42)", zIndex: 50, display: "grid", gap: 4 }}>
          {items.map((item, idx) => (
            <button key={`${item.label}-${idx}`} className="btn" type="button" onClick={() => { item.onClick?.(); setOpen(false); }} style={{ textAlign: "left", justifyContent: "flex-start", padding: "7px 10px" }}>
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function DriveSidebar({
  folders,
  currentFolder,
  setCurrentFolder,
  onNewFolder,
  onRename,
  onDelete,
  tags,
  selectedTag,
  setSelectedTag,
  templates = [],
  onApplyTemplate,
  onDeleteTemplate,
}) {
  const [templatesOpen, setTemplatesOpen] = useState(true);

  const render = (parentId = null, depth = 0) =>
    folders
      .filter((f) => f.parentId === parentId)
      .map((f) => (
        <div key={f.id} style={{ paddingLeft: depth * 12, marginTop: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}>
            <span
              style={{ cursor: "pointer", fontWeight: currentFolder === f.id ? 800 : 500, minWidth: 0, flex: 1 }}
              onClick={() => setCurrentFolder(f.id)}
              title={f.name}
            >
              {depth ? "▸ " : ""}{f.name}
            </span>
            <RowMenu
              items={[
                { label: "Open", onClick: () => setCurrentFolder(f.id) },
                { label: "Rename", onClick: () => onRename(f.id) },
                { label: "Delete", onClick: () => onDelete(f.id) },
              ]}
            />
          </div>
          {render(f.id, depth + 1)}
        </div>
      ));

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="btn" type="button" onClick={() => setCurrentFolder(null)}>Root</button>
        <button className="btn" type="button" onClick={onNewFolder}>+ Folder</button>
      </div>

      {render()}

      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Templates</h3>
          <button className="btn" type="button" onClick={() => setTemplatesOpen((v) => !v)}>{templatesOpen ? "Hide" : "Show"}</button>
        </div>
        {templatesOpen ? (
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {templates.length ? (
              templates.map((tpl) => (
                <div key={tpl.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}>
                  <button className="btn" type="button" onClick={() => onApplyTemplate?.(tpl)} style={{ textAlign: "left" }}>
                    {tpl.name}
                  </button>
                  <RowMenu
                    items={[
                      { label: "Apply", onClick: () => onApplyTemplate?.(tpl) },
                      { label: "Delete", onClick: () => onDeleteTemplate?.(tpl.id) },
                    ]}
                  />
                </div>
              ))
            ) : (
              <div className="helper">No templates yet.</div>
            )}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 style={{ marginBottom: 8 }}>Tags</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={() => setSelectedTag("")} style={{ fontWeight: !selectedTag ? 800 : 400 }}>all</button>
          {tags.map((tag) => (
            <button key={tag} className="btn" type="button" onClick={() => setSelectedTag(tag)} style={{ fontWeight: selectedTag === tag ? 800 : 400 }}>
              #{tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
