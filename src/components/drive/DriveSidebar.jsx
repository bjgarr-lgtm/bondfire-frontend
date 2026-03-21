import React, { useEffect, useMemo, useRef, useState } from "react";

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
      {open ? <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", minWidth: 170, background: "rgba(16,16,20,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 6, boxShadow: "0 14px 32px rgba(0,0,0,0.42)", zIndex: 50, display: "grid", gap: 4 }}>
        {items.map((item, idx) => <button key={`${item.label}-${idx}`} className="btn" type="button" onClick={() => { item.onClick?.(); setOpen(false); }} style={{ textAlign: "left", justifyContent: "flex-start", padding: "7px 10px" }}>{item.label}</button>)}
      </div> : null}
    </div>
  );
}

function SectionLabel({ children, action, open, onToggle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "18px 0 8px 0" }}>
      <button type="button" onClick={onToggle} style={{ background: "none", border: "none", color: "#b8bcc7", padding: 0, cursor: "pointer", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
        {typeof open === "boolean" ? (open ? "▾ " : "▸ ") : ""}{children}
      </button>
      {action || null}
    </div>
  );
}

function TreeRow({ depth = 0, selected = false, children, onClick, menuItems, helper }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "start", paddingLeft: depth * 14 }}>
        <button
          type="button"
          onClick={onClick}
          title={typeof children === "string" ? children : undefined}
          style={{
            width: "100%",
            textAlign: "left",
            background: selected ? "rgba(255,255,255,0.08)" : "transparent",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            padding: "7px 9px",
            cursor: "pointer",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {children}
        </button>
        {menuItems?.length ? <RowMenu items={menuItems} /> : null}
      </div>
      {helper ? <div className="helper" style={{ paddingLeft: depth * 14 + 10, marginTop: 4 }}>{helper}</div> : null}
    </div>
  );
}

export default function DriveSidebar({
  folders = [],
  notes = [],
  files = [],
  currentFolder,
  setCurrentFolder,
  onSelectNote,
  selectedId,
  selectedKind,
  onOpenFile,
  onNewFolder,
  onNewNote,
  onUploadFile,
  onUploadFolder,
  onRenameFolder,
  onDeleteFolder,
  onRenameNote,
  onMoveNote,
  onDeleteNote,
  onRenameFile,
  onMoveFile,
  onDeleteFile,
  onDownloadFile,
  search,
  setSearch,
  tags,
  selectedTag,
  setSelectedTag,
  templates = [],
  onApplyTemplate,
  onDeleteTemplate,
  onEditTemplate,
  onNewFromTemplate,
}) {
  const [treeOpen, setTreeOpen] = useState(true);
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({ root: true });

  const query = String(search || "").trim().toLowerCase();
  const folderChildren = useMemo(() => {
    const map = new Map();
    folders.forEach((folder) => {
      const parentKey = folder.parentId || "root";
      if (!map.has(parentKey)) map.set(parentKey, []);
      map.get(parentKey).push(folder);
    });
    map.forEach((list) => list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))));
    return map;
  }, [folders]);

  function toggleFolder(id) {
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function itemMatchesFolder(folderId) {
    const folderNotes = notes.filter((note) => (note.parentId || null) === folderId).filter((note) => {
      const matchesSearch = !query || String(note.title || "").toLowerCase().includes(query) || String(note.body || "").toLowerCase().includes(query);
      const matchesTag = !selectedTag || (note.tags || []).includes(selectedTag);
      return matchesSearch && matchesTag;
    });
    const folderFiles = files.filter((file) => (file.parentId || null) === folderId).filter((file) => !query || String(file.name || "").toLowerCase().includes(query));
    const childFolders = folderChildren.get(folderId || "root") || [];
    const childMatch = childFolders.some((child) => itemMatchesFolder(child.id));
    return folderNotes.length > 0 || folderFiles.length > 0 || childMatch || !query;
  }

  function renderFolderTree(parentId = null, depth = 0) {
    const folderList = (folderChildren.get(parentId || "root") || []).filter((folder) => itemMatchesFolder(folder.id));
    const noteList = notes
      .filter((note) => (note.parentId || null) === parentId)
      .filter((note) => {
        const matchesSearch = !query || String(note.title || "").toLowerCase().includes(query) || String(note.body || "").toLowerCase().includes(query);
        const matchesTag = !selectedTag || (note.tags || []).includes(selectedTag);
        return matchesSearch && matchesTag;
      })
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    const fileList = files
      .filter((file) => (file.parentId || null) === parentId)
      .filter((file) => !query || String(file.name || "").toLowerCase().includes(query))
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

    return (
      <>
        {folderList.map((folder) => {
          const expanded = expandedFolders[folder.id] !== false;
          return (
            <div key={folder.id}>
              <TreeRow
                depth={depth}
                selected={selectedKind === "folder" && currentFolder === folder.id}
                onClick={() => { setCurrentFolder(folder.id); toggleFolder(folder.id); }}
                menuItems={[
                  { label: "Open", onClick: () => setCurrentFolder(folder.id) },
                  { label: expanded ? "Collapse" : "Expand", onClick: () => toggleFolder(folder.id) },
                  { label: "Rename", onClick: () => onRenameFolder?.(folder.id) },
                  { label: "Delete", onClick: () => onDeleteFolder?.(folder.id) },
                ]}
              >
                {(expanded ? "▾ " : "▸ ") + folder.name}
              </TreeRow>
              {expanded ? renderFolderTree(folder.id, depth + 1) : null}
            </div>
          );
        })}
        {noteList.map((note) => (
          <TreeRow
            key={note.id}
            depth={depth}
            selected={selectedKind === "note" && selectedId === note.id}
            onClick={() => onSelectNote?.(note.id)}
            helper={note.tags?.length ? note.tags.map((tag) => `#${tag}`).join(" ") : ""}
            menuItems={[
              { label: "Open", onClick: () => onSelectNote?.(note.id) },
              { label: "Rename", onClick: () => onRenameNote?.(note.id) },
              { label: "Move", onClick: () => onMoveNote?.(note.id) },
              { label: "Delete", onClick: () => onDeleteNote?.(note.id) },
            ]}
          >
            📝 {note.title || "untitled"}
          </TreeRow>
        ))}
        {fileList.map((file) => (
          <TreeRow
            key={file.id}
            depth={depth}
            selected={selectedKind === "file" && selectedId === file.id}
            onClick={() => onOpenFile?.(file)}
            helper={`${file.mime || "file"} · ${Math.round((Number(file.size || 0) / 1024) * 10) / 10} KB`}
            menuItems={[
              { label: "Open", onClick: () => onOpenFile?.(file) },
              { label: "Download", onClick: () => onDownloadFile?.(file) },
              { label: "Rename", onClick: () => onRenameFile?.(file.id) },
              { label: "Move", onClick: () => onMoveFile?.(file.id) },
              { label: "Delete", onClick: () => onDeleteFile?.(file.id) },
            ]}
          >
            📎 {file.name}
          </TreeRow>
        ))}
      </>
    );
  }

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="btn-red" type="button" onClick={onNewNote}>+ Note</button>
          <button className="btn" type="button" onClick={onNewFolder}>+ Folder</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="btn" type="button" onClick={onUploadFile}>Upload File</button>
          <button className="btn" type="button" onClick={onUploadFolder}>Upload Folder</button>
        </div>
        <input className="input" placeholder="Search notes and files..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%" }} />
      </div>

      <SectionLabel open={treeOpen} onToggle={() => setTreeOpen((v) => !v)} action={<button className="btn" type="button" onClick={() => setCurrentFolder(null)} style={{ padding: "4px 8px" }}>Root</button>}>
        Explorer
      </SectionLabel>
      {treeOpen ? <div style={{ display: "grid", gap: 4 }}>
        <TreeRow
          depth={0}
          selected={currentFolder === null}
          onClick={() => setCurrentFolder(null)}
          menuItems={[]}
        >
          ▾ root
        </TreeRow>
        {renderFolderTree(null, 1)}
        {!folders.length && !notes.length && !files.length ? <div className="helper" style={{ paddingLeft: 10 }}>Nothing here yet.</div> : null}
      </div> : null}

      <SectionLabel open={templatesOpen} onToggle={() => setTemplatesOpen((v) => !v)}>
        Templates
      </SectionLabel>
      {templatesOpen ? <div style={{ display: "grid", gap: 6 }}>
        {templates.length ? templates.map((tpl) => (
          <div key={tpl.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}>
            <button className="btn" type="button" onClick={() => onApplyTemplate?.(tpl)} style={{ textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tpl.name}</button>
            <RowMenu items={[
              { label: "Insert into current note", onClick: () => onApplyTemplate?.(tpl) },
              { label: "New note from template", onClick: () => onNewFromTemplate?.(tpl) },
              { label: "Edit template", onClick: () => onEditTemplate?.(tpl.id) },
              { label: "Delete template", onClick: () => onDeleteTemplate?.(tpl.id) },
            ]} />
          </div>
        )) : <div className="helper">No templates yet.</div>}
      </div> : null}

      <SectionLabel open={tagsOpen} onToggle={() => setTagsOpen((v) => !v)}>
        Tags
      </SectionLabel>
      {tagsOpen ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" type="button" onClick={() => setSelectedTag("")} style={{ fontWeight: !selectedTag ? 800 : 400 }}>all</button>
        {tags.map((tag) => <button key={tag} className="btn" type="button" onClick={() => setSelectedTag(tag)} style={{ fontWeight: selectedTag === tag ? 800 : 400 }}>#{tag}</button>)}
      </div> : null}
    </div>
  );
}
