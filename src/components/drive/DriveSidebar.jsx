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
      {open ? <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", minWidth: 180, background: "rgba(16,16,20,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 6, boxShadow: "0 14px 32px rgba(0,0,0,0.42)", zIndex: 50, display: "grid", gap: 4 }}>
        {items.map((item, idx) => <button key={`${item.label}-${idx}`} className="btn" type="button" onClick={() => { item.onClick?.(); setOpen(false); }} style={{ textAlign: "left", justifyContent: "flex-start", padding: "7px 10px" }}>{item.label}</button>)}
      </div> : null}
    </div>
  );
}

function TemplateEditorModal({ template, onClose, onSave }) {
  const [name, setName] = useState(template?.name || "");
  const [title, setTitle] = useState(template?.title || "");
  const [body, setBody] = useState(template?.body || "");
  if (!template) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "grid", placeItems: "center", padding: 20 }}>
      <div className="card" style={{ width: "min(860px, 92vw)", maxHeight: "88vh", overflow: "auto", padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Edit template</h3>
        <div style={{ display: "grid", gap: 10 }}>
          <label><div className="helper" style={{ marginBottom: 4 }}>Template name</div><input className="input" value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} /></label>
          <label><div className="helper" style={{ marginBottom: 4 }}>Rendered note title template</div><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} /></label>
          <label><div className="helper" style={{ marginBottom: 4 }}>Body</div><textarea value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} style={{ width: "100%", minHeight: 340, background: "rgba(255,255,255,0.02)", color: "#fff", border: "1px solid #222", borderRadius: 12, padding: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, lineHeight: 1.5 }} /></label>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
          <button className="btn-red" type="button" onClick={() => onSave({ ...template, name, title, body })}>Save template</button>
        </div>
      </div>
    </div>
  );
}

function TreeNode({ folder, depth, folders, notes, files, currentFolder, setCurrentFolder, selectedId, selectedKind, onSelectNote, onOpenFile, onRenameFolder, onDeleteFolder, onRenameNote, onDeleteNote, onMoveNote, onRenameFile, onDeleteFile, onMoveFile, onDownloadFile, search }) {
  const [open, setOpen] = useState(true);
  const q = String(search || "").trim().toLowerCase();
  const childFolders = folders.filter((f) => (f.parentId || null) === folder.id);
  const childNotes = notes.filter((n) => (n.parentId || null) === folder.id);
  const childFiles = files.filter((f) => (f.parentId || null) === folder.id);
  const visibleChildFolders = childFolders.filter((f) => !q || String(f.name || "").toLowerCase().includes(q));
  const visibleChildNotes = childNotes.filter((n) => !q || String(n.title || "").toLowerCase().includes(q) || String(n.body || "").toLowerCase().includes(q));
  const visibleChildFiles = childFiles.filter((f) => !q || String(f.name || "").toLowerCase().includes(q));
  const hasChildren = visibleChildFolders.length || visibleChildNotes.length || visibleChildFiles.length;
  if (q && !String(folder.name || "").toLowerCase().includes(q) && !hasChildren) return null;
  return (
    <div style={{ paddingLeft: depth * 12, marginTop: 6 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}>
        <button className="btn" type="button" onClick={() => setOpen((v) => !v)} style={{ justifyContent: "flex-start", fontWeight: currentFolder === folder.id ? 800 : 500, padding: "6px 8px" }}><span style={{ opacity: 0.7, marginRight: 6 }}>{open ? "▾" : "▸"}</span>{folder.name}</button>
        <RowMenu items={[{ label: "Open folder", onClick: () => setCurrentFolder(folder.id) }, { label: "Rename folder", onClick: () => onRenameFolder(folder.id) }, { label: "Delete folder", onClick: () => onDeleteFolder(folder.id) }]} />
      </div>
      {open ? <div style={{ marginTop: 4 }}>
        {visibleChildFolders.map((child) => <TreeNode key={child.id} folder={child} depth={depth + 1} folders={folders} notes={notes} files={files} currentFolder={currentFolder} setCurrentFolder={setCurrentFolder} selectedId={selectedId} selectedKind={selectedKind} onSelectNote={onSelectNote} onOpenFile={onOpenFile} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} onRenameNote={onRenameNote} onDeleteNote={onDeleteNote} onMoveNote={onMoveNote} onRenameFile={onRenameFile} onDeleteFile={onDeleteFile} onMoveFile={onMoveFile} onDownloadFile={onDownloadFile} search={search} />)}
        {visibleChildNotes.map((n) => <div key={n.id} style={{ paddingLeft: 14, marginTop: 4, display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}><button className="btn" type="button" onClick={() => onSelectNote(n.id)} style={{ justifyContent: "flex-start", padding: "6px 8px", fontWeight: selectedKind === "note" && selectedId === n.id ? 800 : 500 }}>{n.title || "untitled"}</button><RowMenu items={[{ label: "Open note", onClick: () => onSelectNote(n.id) }, { label: "Rename note", onClick: () => onRenameNote(n.id) }, { label: "Move note", onClick: () => onMoveNote(n.id) }, { label: "Delete note", onClick: () => onDeleteNote(n.id) }]} /></div>)}
        {visibleChildFiles.map((f) => <div key={f.id} style={{ paddingLeft: 14, marginTop: 4, display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}><button className="btn" type="button" onClick={() => onOpenFile(f)} style={{ justifyContent: "flex-start", padding: "6px 8px", fontWeight: selectedKind === "file" && selectedId === f.id ? 800 : 500 }}>{f.name}</button><RowMenu items={[{ label: "Open file", onClick: () => onOpenFile(f) }, { label: "Download file", onClick: () => onDownloadFile(f) }, { label: "Rename file", onClick: () => onRenameFile(f.id) }, { label: "Move file", onClick: () => onMoveFile(f.id) }, { label: "Delete file", onClick: () => onDeleteFile(f.id) }]} /></div>)}
      </div> : null}
    </div>
  );
}

export default function DriveSidebar(props) {
  const { folders = [], notes = [], files = [], currentFolder, setCurrentFolder, selectedId, selectedKind, onSelectNote, onOpenFile, onNewFolder, onCreateNote, onUploadFileClick, onUploadFolderClick, onRenameFolder, onDeleteFolder, onRenameNote, onDeleteNote, onMoveNote, onRenameFile, onDeleteFile, onMoveFile, onDownloadFile, templates = [], onInsertTemplate, onNewFromTemplate, onUpdateTemplate, onDeleteTemplate, search, setSearch } = props;
  const [mode, setMode] = useState("files");
  const [editingTemplate, setEditingTemplate] = useState(null);
  const rootFolders = useMemo(() => folders.filter((f) => !f.parentId), [folders]);
  const rootNotes = useMemo(() => notes.filter((n) => !n.parentId), [notes]);
  const rootFiles = useMemo(() => files.filter((f) => !f.parentId), [files]);
  const q = String(search || "").trim().toLowerCase();
  const visibleRootNotes = rootNotes.filter((n) => !q || String(n.title || "").toLowerCase().includes(q) || String(n.body || "").toLowerCase().includes(q));
  const visibleRootFiles = rootFiles.filter((f) => !q || String(f.name || "").toLowerCase().includes(q));

  return <>
    <div style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr)", height: "100%" }}>
      <div style={{ borderRight: "1px solid #1b1b1b", padding: "10px 6px", display: "grid", gap: 8, alignContent: "start" }}>
        <button className="btn" type="button" onClick={() => setMode("files")} title="Files" style={{ padding: "8px 0", fontWeight: mode === "files" ? 800 : 400 }}>📁</button>
        <button className="btn" type="button" onClick={() => setMode("templates")} title="Templates" style={{ padding: "8px 0", fontWeight: mode === "templates" ? 800 : 400 }}>🧩</button>
      </div>
      <div style={{ overflow: "auto", padding: 10 }}>
        {mode === "files" ? <>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={() => setCurrentFolder(null)}>Root</button>
            <button className="btn" type="button" onClick={onNewFolder}>+ Folder</button>
            <button className="btn-red" type="button" onClick={onCreateNote}>+ Note</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={onUploadFileClick}>Upload File</button>
            <button className="btn" type="button" onClick={onUploadFolderClick}>Upload Folder</button>
          </div>
          <input className="input" placeholder="search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
          {rootFolders.map((folder) => <TreeNode key={folder.id} folder={folder} depth={0} folders={folders} notes={notes} files={files} currentFolder={currentFolder} setCurrentFolder={setCurrentFolder} selectedId={selectedId} selectedKind={selectedKind} onSelectNote={onSelectNote} onOpenFile={onOpenFile} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} onRenameNote={onRenameNote} onDeleteNote={onDeleteNote} onMoveNote={onMoveNote} onRenameFile={onRenameFile} onDeleteFile={onDeleteFile} onMoveFile={onMoveFile} onDownloadFile={onDownloadFile} search={search} />)}
          {visibleRootNotes.map((n) => <div key={n.id} style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}><button className="btn" type="button" onClick={() => onSelectNote(n.id)} style={{ justifyContent: "flex-start", padding: "6px 8px", fontWeight: selectedKind === "note" && selectedId === n.id ? 800 : 500 }}>{n.title || "untitled"}</button><RowMenu items={[{ label: "Open note", onClick: () => onSelectNote(n.id) }, { label: "Rename note", onClick: () => onRenameNote(n.id) }, { label: "Move note", onClick: () => onMoveNote(n.id) }, { label: "Delete note", onClick: () => onDeleteNote(n.id) }]} /></div>)}
          {visibleRootFiles.map((f) => <div key={f.id} style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}><button className="btn" type="button" onClick={() => onOpenFile(f)} style={{ justifyContent: "flex-start", padding: "6px 8px", fontWeight: selectedKind === "file" && selectedId === f.id ? 800 : 500 }}>{f.name}</button><RowMenu items={[{ label: "Open file", onClick: () => onOpenFile(f) }, { label: "Download file", onClick: () => onDownloadFile(f) }, { label: "Rename file", onClick: () => onRenameFile(f.id) }, { label: "Move file", onClick: () => onMoveFile(f.id) }, { label: "Delete file", onClick: () => onDeleteFile(f.id) }]} /></div>)}
        </> : <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}><h3 style={{ margin: 0 }}>Templates</h3><div className="helper">{templates.length}</div></div>
          <div style={{ display: "grid", gap: 8 }}>
            {templates.map((tpl) => <div key={tpl.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}><button className="btn" type="button" onClick={() => onInsertTemplate?.(tpl)} style={{ textAlign: "left", justifyContent: "flex-start", padding: "8px 10px" }}>{tpl.name}</button><RowMenu items={[{ label: "Insert into current note", onClick: () => onInsertTemplate?.(tpl) }, { label: "New note from template", onClick: () => onNewFromTemplate?.(tpl) }, { label: "Edit template", onClick: () => setEditingTemplate(tpl) }, { label: "Delete template", onClick: () => onDeleteTemplate?.(tpl.id) }]} /></div>)}
          </div>
        </>}
      </div>
    </div>
    <TemplateEditorModal template={editingTemplate} onClose={() => setEditingTemplate(null)} onSave={(next) => { onUpdateTemplate?.(next); setEditingTemplate(null); }} />
  </>;
}
