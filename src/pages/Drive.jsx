import React, { useEffect, useMemo, useRef, useState } from "react";
import DriveSidebar from "../components/drive/DriveSidebar.jsx";
import DriveList from "../components/drive/DriveList.jsx";
import NoteEditor from "../components/drive/NoteEditor.jsx";
import NotePreview from "../components/drive/NotePreview.jsx";
import Breadcrumbs from "../components/drive/Breadcrumbs.jsx";
import NoteInspector from "../components/drive/NoteInspector.jsx";
import RichTextToolbar from "../components/drive/RichTextToolbar.jsx";

const STORAGE_KEY = "bf_drive_v7";
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const newId = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function parseTags(body) {
  const matches = [...String(body || "").matchAll(/(^|\s)#([a-zA-Z0-9/_-]+)/gim)];
  return [...new Set(matches.map((m) => String(m[2] || "").trim().toLowerCase()).filter(Boolean))];
}
function parseWikiLinks(body) {
  const matches = [...String(body || "").matchAll(/\[\[(.*?)(\|(.*?))?\]\]/gim)];
  return matches.map((m) => String(m[1] || "").trim()).filter(Boolean);
}
function parseFrontmatter(text) {
  const raw = String(text || "");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { properties: {}, body: raw, hasFrontmatter: false };
  const properties = {};
  match[1].split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) properties[key] = value;
  });
  return { properties, body: raw.slice(match[0].length), hasFrontmatter: true };
}
function serializeFrontmatter(properties, body) {
  const entries = Object.entries(properties || {}).filter(([, v]) => String(v || "").trim() !== "");
  if (!entries.length) return String(body || "");
  return `---\n${entries.map(([k, v]) => `${k}: ${String(v || "").trim()}`).join("\n")}\n---\n\n${String(body || "")}`;
}

export default function Drive() {
  const [folders, setFolders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [title, setTitle] = useState("untitled");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("saved");
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [viewMode, setViewMode] = useState("split");
  const [focusMode, setFocusMode] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [listWidth, setListWidth] = useState(260);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const saveTimer = useRef(null);
  const skipNextSave = useRef(false);
  const resizeMode = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      setFolders(Array.isArray(raw.folders) ? raw.folders : []);
      setNotes(Array.isArray(raw.notes) ? raw.notes : []);
      setSidebarWidth(Number.isFinite(raw.sidebarWidth) ? clamp(raw.sidebarWidth, 150, 340) : 220);
      setListWidth(Number.isFinite(raw.listWidth) ? clamp(raw.listWidth, 190, 360) : 260);
      setSplitRatio(Number.isFinite(raw.splitRatio) ? clamp(raw.splitRatio, 0.3, 0.7) : 0.5);
      setViewMode(["edit", "read", "split"].includes(raw.viewMode) ? raw.viewMode : "split");
      setInspectorOpen(!!raw.inspectorOpen);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ folders, notes, sidebarWidth, listWidth, splitRatio, viewMode, inspectorOpen }));
    } catch {}
  }, [folders, notes, sidebarWidth, listWidth, splitRatio, viewMode, inspectorOpen]);

  useEffect(() => {
    const onMove = (e) => {
      if (!resizeMode.current) return;
      if (resizeMode.current === "sidebar") setSidebarWidth(clamp(e.clientX, 150, 340));
      if (resizeMode.current === "list") setListWidth(clamp(e.clientX - sidebarWidth - 8, 190, 360));
      if (resizeMode.current === "split") {
        const main = document.getElementById("bf-drive-editor-zone");
        if (!main) return;
        const rect = main.getBoundingClientRect();
        setSplitRatio(clamp((e.clientX - rect.left) / rect.width, 0.3, 0.7));
      }
    };
    const onUp = () => { resizeMode.current = null; document.body.style.userSelect = ""; document.body.style.cursor = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [sidebarWidth]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") { e.preventDefault(); createNote(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveNow(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "1") { e.preventDefault(); setViewMode("edit"); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "2") { e.preventDefault(); setViewMode("read"); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "3") { e.preventDefault(); setViewMode("split"); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") { e.preventDefault(); setInspectorOpen((v) => !v); }
      if (e.key === "Escape") { if (focusMode) setFocusMode(false); setInspectorOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  const selectedNote = notes.find((n) => n.id === selectedId) || null;
  const noteMap = useMemo(() => { const m = new Map(); notes.forEach((n) => m.set(String(n.title || "").trim().toLowerCase(), n.id)); return m; }, [notes]);
  const allTags = useMemo(() => { const s = new Set(); notes.forEach((n) => (n.tags || []).forEach((t) => s.add(t))); return [...s].sort(); }, [notes]);
  const backlinks = selectedNote ? notes.filter((n) => n.id !== selectedNote.id && parseWikiLinks(n.body).some((l) => l.toLowerCase() === String(selectedNote.title || "").toLowerCase())) : [];
  const visibleNotes = notes.filter((n) => (n.parentId || null) === currentFolder).filter((n) => {
    const q = search.trim().toLowerCase();
    const ms = !q || String(n.title || "").toLowerCase().includes(q) || String(n.body || "").toLowerCase().includes(q);
    const mt = !selectedTag || (n.tags || []).includes(selectedTag);
    return ms && mt;
  }).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

  function beginResize(which) { resizeMode.current = which; document.body.style.userSelect = "none"; document.body.style.cursor = "col-resize"; }
  function createFolder() { const name = prompt("Folder name?"); if (!name) return; setFolders((p) => [...p, { id: newId("folder"), name: String(name).trim(), parentId: currentFolder }]); }
  function renameFolder(id) { const f = folders.find((x) => x.id === id); const name = prompt("Rename folder", f?.name || ""); if (!name) return; setFolders((p) => p.map((x) => x.id === id ? { ...x, name: String(name).trim() } : x)); }
  function deleteFolder(id) { const parent = folders.find((f) => f.id === id)?.parentId ?? null; setFolders((p) => p.map((f) => f.parentId === id ? { ...f, parentId: parent } : f).filter((f) => f.id !== id)); setNotes((p) => p.map((n) => n.parentId === id ? { ...n, parentId: parent } : n)); if (currentFolder === id) setCurrentFolder(parent); }
  function createNote() { const note = { id: newId("note"), title: "untitled", body: "", parentId: currentFolder, updatedAt: Date.now(), tags: [] }; skipNextSave.current = true; setNotes((p) => [note, ...p]); setSelectedId(note.id); setTitle(note.title); setContent(note.body); setStatus("saved"); }
  function selectNote(id) { const n = notes.find((x) => x.id === id); if (!n) return; skipNextSave.current = true; setSelectedId(id); setTitle(n.title || "untitled"); setContent(n.body || ""); setStatus("saved"); }
  function renameNote(id) { const n = notes.find((x) => x.id === id); const name = prompt("Rename note", n?.title || ""); if (!name) return; setNotes((p) => p.map((x) => x.id === id ? { ...x, title: String(name).trim(), updatedAt: Date.now() } : x)); if (selectedId === id) { skipNextSave.current = true; setTitle(String(name).trim()); setStatus("saved"); } }
  function deleteNote(id) { setNotes((p) => p.filter((n) => n.id !== id)); if (selectedId === id) { setSelectedId(null); setTitle("untitled"); setContent(""); setStatus("saved"); } }
  function moveNote(id) { const target = prompt("Move to folderId (blank for root)", currentFolder || ""); setNotes((p) => p.map((n) => n.id === id ? { ...n, parentId: target || null, updatedAt: Date.now() } : n)); }
  function saveNow() {
    if (!selectedId) return;
    const parsed = parseFrontmatter(content);
    const propertyTags = String(parsed.properties.tags || "").trim();
    const combinedTags = [...new Set([...parseTags(parsed.body), ...propertyTags.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)])];
    setNotes((p) => p.map((n) => n.id === selectedId ? { ...n, title, body: content, tags: combinedTags, updatedAt: Date.now() } : n));
    setStatus("saved");
  }

  useEffect(() => {
    if (!selectedId) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNow(), 400);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [selectedId, title, content]);

  function openLinkedNoteByTitle(rawTitle) {
    const clean = String(rawTitle || "").trim();
    const existingId = noteMap.get(clean.toLowerCase());
    if (existingId) { const n = notes.find((x) => x.id === existingId); setCurrentFolder(n?.parentId || null); selectNote(existingId); return; }
    if (!window.confirm(`Create note "${clean}"?`)) return;
    const note = { id: newId("note"), title: clean || "untitled", body: "", parentId: currentFolder, updatedAt: Date.now(), tags: [] };
    skipNextSave.current = true; setNotes((p) => [note, ...p]); setSelectedId(note.id); setTitle(note.title); setContent(""); setStatus("saved");
  }

  function wrapSelection(prefix, suffix = prefix) {
    const el = editorRef.current; if (!el) return;
    const start = el.selectionStart || 0, end = el.selectionEnd || 0;
    const selected = content.slice(start, end);
    setContent(content.slice(0, start) + prefix + selected + suffix + content.slice(end));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + prefix.length, end + prefix.length); });
  }
  function prefixLines(prefix) {
    const el = editorRef.current; if (!el) return;
    const start = el.selectionStart || 0, end = el.selectionEnd || 0;
    const selected = content.slice(start, end) || "";
    const nextSelected = selected.split("\n").map((line) => `${prefix}${line}`).join("\n");
    setContent(content.slice(0, start) + nextSelected + content.slice(end));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start, start + nextSelected.length); });
  }
  function insertBlock(block) {
    const el = editorRef.current; if (!el) return;
    const start = el.selectionStart || 0;
    setContent(content.slice(0, start) + block + content.slice(start));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + block.length, start + block.length); });
  }
  function insertFrontmatterTemplate() {
    const parsed = parseFrontmatter(content);
    if (parsed.hasFrontmatter) return;
    setContent(serializeFrontmatter({ type: "bit-log", date: "", status: "", tags: "" }, content));
  }
  function updateFrontmatterProperty(key, value) {
    const parsed = parseFrontmatter(content);
    setContent(serializeFrontmatter({ ...parsed.properties, [key]: value }, parsed.body));
  }

  const workspaceHeight = focusMode ? "100vh" : "calc(100vh - 86px)";
  const showEditor = viewMode !== "read";
  const showPreview = viewMode !== "edit";

  return (
    <div style={{ position: focusMode ? "fixed" : "relative", inset: focusMode ? 0 : "auto", zIndex: focusMode ? 80 : "auto", background: "#0b0b0b", height: workspaceHeight }}>
      <div style={{ display: "grid", gridTemplateColumns: `${sidebarWidth}px 8px ${listWidth}px 8px minmax(0,1fr)`, height: "100%" }}>
        <div style={{ borderRight: "1px solid #222", overflow: "auto" }}><DriveSidebar folders={folders} currentFolder={currentFolder} setCurrentFolder={setCurrentFolder} onNewFolder={createFolder} onRename={renameFolder} onDelete={deleteFolder} tags={allTags} selectedTag={selectedTag} setSelectedTag={setSelectedTag} /></div>
        <div onMouseDown={() => beginResize("sidebar")} style={{ cursor: "col-resize", background: "rgba(255,255,255,0.04)" }} title="Drag to resize explorer" />
        <div style={{ borderRight: "1px solid #222", overflow: "auto", padding: 8 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}><button className="btn-red" type="button" onClick={createNote}>+ Note</button></div>
          <input className="input" placeholder="search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
          <DriveList notes={visibleNotes} onSelect={selectNote} onRename={renameNote} onMove={moveNote} onDelete={deleteNote} selectedId={selectedId} />
        </div>
        <div onMouseDown={() => beginResize("list")} style={{ cursor: "col-resize", background: "rgba(255,255,255,0.04)" }} title="Drag to resize note list" />
        <div style={{ minWidth: 0, overflow: "auto", padding: 12 }}>
          <Breadcrumbs folders={folders} currentFolder={currentFolder} setCurrentFolder={setCurrentFolder} />
          {selectedNote ? <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" style={{ flex: 1, minWidth: 220, fontSize: 22, fontWeight: 800, background: "transparent", border: "none", outline: "none", color: "#fff", padding: "2px 0" }} />
              <span className="helper">{status}</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginLeft: "auto" }}>
                <button className="btn" type="button" onClick={() => setViewMode("edit")} style={{ fontWeight: viewMode === "edit" ? 800 : 500 }}>Source</button>
                <button className="btn" type="button" onClick={() => setViewMode("read")} style={{ fontWeight: viewMode === "read" ? 800 : 500 }}>Reading</button>
                <button className="btn" type="button" onClick={() => setViewMode("split")} style={{ fontWeight: viewMode === "split" ? 800 : 500 }}>Split</button>
                <button className="btn" type="button" onClick={insertFrontmatterTemplate}>Props</button>
                <button className="btn" type="button" onClick={() => setInspectorOpen((v) => !v)}>{inspectorOpen ? "Hide Inspector" : "Inspector"}</button>
                <button className="btn" type="button" onClick={() => setFocusMode((v) => !v)}>{focusMode ? "Exit Focus" : "Focus"}</button>
              </div>
            </div>
            {showEditor ? <RichTextToolbar onBold={() => wrapSelection("**")} onItalic={() => wrapSelection("*")} onH1={() => prefixLines("# ")} onH2={() => prefixLines("## ")} onBullet={() => prefixLines("- ")} onQuote={() => prefixLines("> ")} onCode={() => wrapSelection("`")} onRule={() => insertBlock("\n---\n")} onLink={() => wrapSelection("[", "](https://)")} onWikiLink={() => wrapSelection("[[", "]]")} /> : null}
            <div id="bf-drive-editor-zone" style={{ display: "grid", gridTemplateColumns: viewMode === "split" ? `${Math.round(splitRatio * 100)}% 6px minmax(0,1fr)` : "minmax(0,1fr)", gap: viewMode === "split" ? 8 : 0, alignItems: "start" }}>
              {showEditor ? <div style={{ minWidth: 0 }}><NoteEditor value={content} onChange={setContent} focusMode={focusMode} editorRef={editorRef} /></div> : null}
              {viewMode === "split" ? <div onMouseDown={() => beginResize("split")} style={{ cursor: "col-resize", background: "rgba(255,255,255,0.04)", minHeight: focusMode ? "84vh" : "72vh" }} title="Drag to resize split" /> : null}
              {showPreview ? <div style={{ minWidth: 0 }}><NotePreview content={content} onOpenLink={openLinkedNoteByTitle} focusMode={focusMode} onUpdateProperty={updateFrontmatterProperty} /></div> : null}
            </div>
          </> : <div className="card" style={{ padding: 16 }}><h2 style={{ marginTop: 0 }}>Drive</h2><div className="helper">Create or select a note. Properties now live in frontmatter in source mode and render as fields in reading mode.</div></div>}
        </div>
      </div>
      {inspectorOpen && selectedNote ? <div style={{ position: "fixed", top: focusMode ? 10 : 96, right: 10, width: 280, maxHeight: focusMode ? "calc(100vh - 20px)" : "calc(100vh - 106px)", overflow: "auto", zIndex: 90 }}><NoteInspector note={selectedNote} backlinks={backlinks} onOpenNote={selectNote} onClose={() => setInspectorOpen(false)} /></div> : null}
    </div>
  );
}
