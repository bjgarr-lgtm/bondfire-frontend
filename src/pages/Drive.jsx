import React, { useEffect, useMemo, useRef, useState } from "react";
import DriveSidebar from "../components/drive/DriveSidebar.jsx";
import NoteEditor from "../components/drive/NoteEditor.jsx";
import NotePreview from "../components/drive/NotePreview.jsx";
import Breadcrumbs from "../components/drive/Breadcrumbs.jsx";
import NoteInspector from "../components/drive/NoteInspector.jsx";
import RichTextToolbar from "../components/drive/RichTextToolbar.jsx";
import HelpFab from "../components/drive/HelpFab.jsx";
import { renderTemplate, templateDocs } from "../components/drive/templateEngine.js";

const STORAGE_KEY = "bf_drive_v13";
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
  if (!match) return { properties: [], body: raw, hasFrontmatter: false };
  const properties = match[1].split("\n").map((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return null;
    return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
  }).filter((x) => x && x.key);
  return { properties, body: raw.slice(match[0].length), hasFrontmatter: true };
}
function serializeFrontmatter(properties, body) {
  const entries = (properties || []).filter((p) => String(p?.key || "").trim() !== "");
  if (!entries.length) return String(body || "");
  const lines = entries.map((p) => `${String(p.key).trim()}: ${String(p.value || "").trim()}`);
  return `---\n${lines.join("\n")}\n---\n\n${String(body || "")}`;
}
const STARTER_TEMPLATES = [
  { id: "tpl_daily_note", name: "daily note", title: '<% tp.date.now("YYYY-MM-DD") %>', body: `---
type: daily-note
date: <% tp.date.now("YYYY-MM-DD") %>
weekday: <% tp.date.now("dddd") %>
tags: daily
---

# <% tp.file.title %>

## schedule

- [ ] 

## notes

<% tp.date.now("HH:mm") %> — 

## wins

- [ ] 

## tomorrow

- [ ] 
` },
  { id: "tpl_timestamp", name: "timestamp block", title: "timestamp", body: `<% tp.date.now("HH:mm") %> — ` },
  { id: "tpl_weekly_checkin", name: "weekly check-in", title: '<% tp.date.now("YYYY-[W]WW") %> weekly check-in', body: `---
type: weekly-checkin
date: <% tp.date.now("YYYY-MM-DD") %>
tags: weekly, checkin
---

# weekly relationship accountability check-in

## what i did well this week

- [ ] 

## where i fell short

- [ ] 

## one concrete change for next week

- [ ] 

## evidence i am becoming safer, not just apologetic

- [ ] 
` },
  { id: "tpl_meeting", name: "meeting notes", title: '<% tp.date.now("YYYY-MM-DD") %> meeting', body: `---
type: meeting-note
date: <% tp.date.now("YYYY-MM-DD") %>
tags: meeting
---

# <% tp.file.title %>

## attendees

- 

## agenda

- 

## notes

- 

## action items

- [ ] 
` },
];

export default function Drive() {
  const [folders, setFolders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [files, setFiles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedKind, setSelectedKind] = useState("note");
  const [title, setTitle] = useState("untitled");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("saved");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("split");
  const [focusMode, setFocusMode] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navWidth, setNavWidth] = useState(310);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [showHelp, setShowHelp] = useState(false);
  const [helpPulseKey, setHelpPulseKey] = useState(0);
  const saveTimer = useRef(null);
  const skipNextSave = useRef(false);
  const resizeMode = useRef(null);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      setFolders(Array.isArray(raw.folders) ? raw.folders : []);
      setNotes(Array.isArray(raw.notes) ? raw.notes : []);
      setFiles(Array.isArray(raw.files) ? raw.files : []);
      setTemplates(Array.isArray(raw.templates) && raw.templates.length ? raw.templates : STARTER_TEMPLATES);
      setNavWidth(Number.isFinite(raw.navWidth) ? clamp(raw.navWidth, 240, 420) : 310);
      setSplitRatio(Number.isFinite(raw.splitRatio) ? clamp(raw.splitRatio, 0.3, 0.7) : 0.5);
      setViewMode(["edit", "read", "split"].includes(raw.viewMode) ? raw.viewMode : "split");
      setInspectorOpen(!!raw.inspectorOpen);
      setPropertiesCollapsed(!!raw.propertiesCollapsed);
    } catch {
      setTemplates(STARTER_TEMPLATES);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ folders, notes, files, templates, navWidth, splitRatio, viewMode, inspectorOpen, propertiesCollapsed }));
    } catch {}
  }, [folders, notes, files, templates, navWidth, splitRatio, viewMode, inspectorOpen, propertiesCollapsed]);

  useEffect(() => { setHelpPulseKey((k) => k + 1); }, [currentFolder, selectedId, selectedKind, viewMode]);

  useEffect(() => {
    const onMove = (e) => {
      if (!resizeMode.current) return;
      if (resizeMode.current === "nav") setNavWidth(clamp(e.clientX - 52, 240, 420));
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
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") { e.preventDefault(); createNote(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveNow(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "1") { e.preventDefault(); setViewMode("edit"); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "2") { e.preventDefault(); setViewMode("read"); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "3") { e.preventDefault(); setViewMode("split"); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") { e.preventDefault(); setInspectorOpen((v) => !v); }
      if (e.key === "Escape") { if (focusMode) setFocusMode(false); setInspectorOpen(false); setMenuOpen(false); setShowHelp(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  const selectedNote = notes.find((n) => n.id === selectedId) || null;
  const noteMap = useMemo(() => {
    const map = new Map();
    notes.forEach((note) => map.set(String(note.title || "").trim().toLowerCase(), note.id));
    return map;
  }, [notes]);
  const backlinks = selectedNote ? notes.filter((note) => note.id !== selectedNote.id && parseWikiLinks(note.body).some((link) => link.toLowerCase() === String(selectedNote.title || "").toLowerCase())) : [];

  function beginResize(which) { resizeMode.current = which; document.body.style.userSelect = "none"; document.body.style.cursor = "col-resize"; }
  function createFolder() { const name = prompt("Folder name?"); if (!name) return; setFolders((prev) => [...prev, { id: newId("folder"), name: String(name).trim(), parentId: currentFolder }]); }
  function renameFolder(id) { const folder = folders.find((f) => f.id === id); const name = prompt("Rename folder", folder?.name || ""); if (!name) return; setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: String(name).trim() } : f))); }
  function deleteFolder(id) { const parent = folders.find((f) => f.id === id)?.parentId ?? null; setFolders((prev) => prev.map((f) => (f.parentId === id ? { ...f, parentId: parent } : f)).filter((f) => f.id !== id)); setNotes((prev) => prev.map((n) => (n.parentId === id ? { ...n, parentId: parent } : n))); setFiles((prev) => prev.map((f) => (f.parentId === id ? { ...f, parentId: parent } : f))); if (currentFolder === id) setCurrentFolder(parent); }

  function createNote() { const note = { id: newId("note"), title: "untitled", body: "", parentId: currentFolder, updatedAt: Date.now(), tags: [] }; skipNextSave.current = true; setNotes((prev) => [note, ...prev]); setSelectedKind("note"); setSelectedId(note.id); setTitle(note.title); setContent(note.body); setStatus("saved"); }
  function createNoteFromTemplate(template) { const renderedTitle = renderTemplate(template.title || template.name || "untitled", {}); const renderedBody = renderTemplate(template.body || "", { title: renderedTitle }); const note = { id: newId("note"), title: renderedTitle, body: renderedBody, parentId: currentFolder, updatedAt: Date.now(), tags: parseTags(renderedBody) }; skipNextSave.current = true; setNotes((prev) => [note, ...prev]); setSelectedKind("note"); setSelectedId(note.id); setTitle(note.title); setContent(note.body); setStatus("saved"); }
  function selectNote(id) { const note = notes.find((n) => n.id === id); if (!note) return; skipNextSave.current = true; setSelectedKind("note"); setSelectedId(id); setTitle(note.title || "untitled"); setContent(note.body || ""); setStatus("saved"); }
  function renameNote(id) { const note = notes.find((n) => n.id === id); const name = prompt("Rename note", note?.title || ""); if (!name) return; setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title: String(name).trim(), updatedAt: Date.now() } : n))); if (selectedId === id && selectedKind === "note") { skipNextSave.current = true; setTitle(String(name).trim()); setStatus("saved"); } }
  function deleteNote(id) { setNotes((prev) => prev.filter((n) => n.id !== id)); if (selectedId === id && selectedKind === "note") { setSelectedId(null); setTitle("untitled"); setContent(""); setStatus("saved"); } }
  function moveNote(id) { const target = prompt("Move to folderId (blank for root)", currentFolder || ""); setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, parentId: target || null, updatedAt: Date.now() } : n))); }

  function renameFile(id) { const file = files.find((f) => f.id === id); const name = prompt("Rename file", file?.name || ""); if (!name) return; setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: String(name).trim(), updatedAt: Date.now() } : f))); }
  function deleteFile(id) { setFiles((prev) => prev.filter((f) => f.id !== id)); }
  function moveFile(id) { const target = prompt("Move to folderId (blank for root)", currentFolder || ""); setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, parentId: target || null, updatedAt: Date.now() } : f))); }
  function openFile(file) { if (!file?.dataUrl) return; const w = window.open(); if (!w) return; if (String(file.mime || "").startsWith("text/") || file.textContent) { w.document.write(`<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;">${String(file.textContent || "").replace(/[<&>]/g, (m) => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[m]))}</pre>`); } else { w.location.href = file.dataUrl; } }
  function downloadFile(file) { if (!file?.dataUrl) return; const a = document.createElement("a"); a.href = file.dataUrl; a.download = file.name || "download"; a.click(); }

  async function fileToStoredRecord(file, parentId, relativePath = "") {
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = reject; reader.readAsDataURL(file); });
    let textContent = "";
    if (String(file.type || "").startsWith("text/") || /\.(md|txt|json|js|jsx|ts|tsx|css|html|yml|yaml)$/i.test(file.name)) { try { textContent = await file.text(); } catch {} }
    return { id: newId("file"), name: file.name, parentId, updatedAt: Date.now(), size: file.size, mime: file.type || "application/octet-stream", dataUrl, textContent, relativePath };
  }
  async function onUploadFiles(event) { const chosen = Array.from(event.target.files || []); if (!chosen.length) return; const records = await Promise.all(chosen.map((file) => fileToStoredRecord(file, currentFolder))); setFiles((prev) => [...records, ...prev]); event.target.value = ""; }
  async function onUploadFolder(event) {
    const chosen = Array.from(event.target.files || []);
    if (!chosen.length) return;
    let nextFolders = [...folders];
    const folderLookup = new Map(nextFolders.map((f) => [`${f.parentId || "root"}::${f.name}`, f.id]));
    function ensureFolderChain(segments) {
      let parentId = currentFolder;
      for (const segment of segments) {
        const key = `${parentId || "root"}::${segment}`;
        if (!folderLookup.has(key)) {
          const id = newId("folder");
          const created = { id, name: segment, parentId };
          nextFolders.push(created);
          folderLookup.set(key, id);
          parentId = id;
        } else parentId = folderLookup.get(key);
      }
      return parentId;
    }
    const records = [];
    for (const file of chosen) {
      const rel = String(file.webkitRelativePath || "").trim();
      const parts = rel.split("/").filter(Boolean);
      const fileName = parts.pop() || file.name;
      const targetFolderId = parts.length ? ensureFolderChain(parts) : currentFolder;
      const stored = await fileToStoredRecord(new File([file], fileName, { type: file.type }), targetFolderId, rel);
      records.push(stored);
    }
    setFolders(nextFolders);
    setFiles((prev) => [...records, ...prev]);
    event.target.value = "";
  }

  function saveNow() {
    if (!selectedId || selectedKind !== "note") return;
    const parsed = parseFrontmatter(content);
    const propertyTags = parsed.properties.find((p) => p.key.toLowerCase() === "tags")?.value || "";
    const combinedTags = [...new Set([...parseTags(parsed.body), ...String(propertyTags).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)])];
    setNotes((prev) => prev.map((n) => (n.id === selectedId ? { ...n, title, body: content, tags: combinedTags, updatedAt: Date.now() } : n)));
    setStatus("saved");
  }
  useEffect(() => {
    if (!selectedId || selectedKind !== "note") return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNow(), 350);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [selectedId, selectedKind, title, content]);

  function insertTemplateIntoCurrent(template) {
    const rendered = renderTemplate(template.body || "", { title });
    if (selectedKind !== "note" || !selectedId) { createNoteFromTemplate(template); return; }
    const el = editorRef.current;
    if (!el) { setContent((prev) => `${prev}${prev && !prev.endsWith("\n") ? "\n" : ""}${rendered}`); return; }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const joinerBefore = before && !before.endsWith("\n") ? "\n" : "";
    const joinerAfter = after && !after.startsWith("\n") ? "\n" : "";
    const next = `${before}${joinerBefore}${rendered}${joinerAfter}${after}`;
    setContent(next);
    requestAnimationFrame(() => { const pos = (before + joinerBefore + rendered).length; el.focus(); el.setSelectionRange(pos, pos); });
  }

  function saveCurrentAsTemplate() { if (selectedKind !== "note" || !selectedId) return; const name = prompt("Template name?", title || "untitled template"); if (!name) return; const next = { id: newId("tpl"), name: String(name).trim(), title: title || "untitled", body: content || "" }; setTemplates((prev) => [next, ...prev.filter((x) => x.name !== next.name)]); }
  function updateTemplate(nextTemplate) { setTemplates((prev) => prev.map((tpl) => (tpl.id === nextTemplate.id ? nextTemplate : tpl))); }
  function deleteTemplate(id) { setTemplates((prev) => prev.filter((tpl) => tpl.id !== id)); }

  function updateFrontmatterProperty(key, value) { const parsed = parseFrontmatter(content); setContent(serializeFrontmatter(parsed.properties.map((p) => (p.key === key ? { ...p, value } : p)), parsed.body)); }
  function addFrontmatterProperty() { const parsed = parseFrontmatter(content); const key = prompt("Property name?"); if (!key) return; if (!parsed.hasFrontmatter) { setContent(serializeFrontmatter([{ key: String(key).trim(), value: "" }], content)); return; } if (parsed.properties.some((p) => p.key === String(key).trim())) return; setContent(serializeFrontmatter([...parsed.properties, { key: String(key).trim(), value: "" }], parsed.body)); }
  function removeFrontmatterProperty(key) { const parsed = parseFrontmatter(content); setContent(serializeFrontmatter(parsed.properties.filter((p) => p.key !== key), parsed.body)); }
  function insertFrontmatterTemplate() { const parsed = parseFrontmatter(content); if (parsed.hasFrontmatter) return; setContent(serializeFrontmatter([{ key: "type", value: "bit-log" }, { key: "date", value: "" }, { key: "status", value: "" }, { key: "tags", value: "" }], content)); }

  function openLinkedNoteByTitle(rawTitle) {
    const clean = String(rawTitle || "").trim();
    const existingId = noteMap.get(clean.toLowerCase());
    if (existingId) { const n = notes.find((x) => x.id === existingId); setCurrentFolder(n?.parentId || null); selectNote(existingId); return; }
    if (!window.confirm(`Create note "${clean}"?`)) return;
    const note = { id: newId("note"), title: clean || "untitled", body: "", parentId: currentFolder, updatedAt: Date.now(), tags: [] };
    skipNextSave.current = true;
    setNotes((prev) => [note, ...prev]);
    setSelectedKind("note");
    setSelectedId(note.id);
    setTitle(note.title);
    setContent("");
    setStatus("saved");
  }

  function wrapSelection(prefix, suffix = prefix) { const el = editorRef.current; if (!el) return; const start = el.selectionStart || 0, end = el.selectionEnd || 0; const selected = content.slice(start, end); setContent(content.slice(0, start) + prefix + selected + suffix + content.slice(end)); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + prefix.length, end + prefix.length); }); }
  function prefixLines(prefix) { const el = editorRef.current; if (!el) return; const start = el.selectionStart || 0, end = el.selectionEnd || 0; const selected = content.slice(start, end) || ""; const nextSelected = selected.split("\n").map((line) => `${prefix}${line}`).join("\n"); setContent(content.slice(0, start) + nextSelected + content.slice(end)); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start, start + nextSelected.length); }); }
  function insertBlock(block) { const el = editorRef.current; if (!el) return; const start = el.selectionStart || 0; setContent(content.slice(0, start) + block + content.slice(start)); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + block.length, start + block.length); }); }

  const showEditor = viewMode !== "read";
  const showPreview = viewMode !== "edit";
  const workspaceHeight = focusMode ? "100vh" : "calc(100vh - 86px)";

  return (
    <div style={{ position: focusMode ? "fixed" : "relative", inset: focusMode ? 0 : "auto", zIndex: focusMode ? 80 : "auto", background: "#0b0b0b", height: workspaceHeight }}>
      <div style={{ display: "grid", gridTemplateColumns: `52px ${navWidth}px 6px minmax(0,1fr)`, height: "100%" }}>
        <DriveSidebar folders={folders} notes={notes} files={files} currentFolder={currentFolder} setCurrentFolder={setCurrentFolder} selectedId={selectedId} selectedKind={selectedKind} onSelectNote={selectNote} onOpenFile={openFile} onNewFolder={createFolder} onCreateNote={createNote} onUploadFileClick={() => fileInputRef.current?.click()} onUploadFolderClick={() => folderInputRef.current?.click()} onRenameFolder={renameFolder} onDeleteFolder={deleteFolder} onRenameNote={renameNote} onDeleteNote={deleteNote} onMoveNote={moveNote} onRenameFile={renameFile} onDeleteFile={deleteFile} onMoveFile={moveFile} onDownloadFile={downloadFile} templates={templates} onInsertTemplate={insertTemplateIntoCurrent} onNewFromTemplate={createNoteFromTemplate} onUpdateTemplate={updateTemplate} onDeleteTemplate={deleteTemplate} search={search} setSearch={setSearch} />
        <div onMouseDown={() => beginResize("nav")} style={{ cursor: "col-resize", background: "rgba(255,255,255,0.03)" }} title="Drag to resize navigation" />
        <div style={{ minWidth: 0, overflow: "auto", padding: 10 }}>
          <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={onUploadFiles} />
          <input ref={folderInputRef} type="file" multiple webkitdirectory="true" directory="true" style={{ display: "none" }} onChange={onUploadFolder} />
          <Breadcrumbs folders={folders} currentFolder={currentFolder} setCurrentFolder={setCurrentFolder} compact />
          {selectedKind === "note" && selectedNote ? <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" style={{ flex: 1, minWidth: 220, fontSize: 20, fontWeight: 800, background: "transparent", border: "none", outline: "none", color: "#fff", padding: "2px 0" }} />
              <span className="helper">{status}</span>
            </div>
            <RichTextToolbar onBold={showEditor ? () => wrapSelection("**") : undefined} onItalic={showEditor ? () => wrapSelection("*") : undefined} onH1={showEditor ? () => prefixLines("# ") : undefined} onH2={showEditor ? () => prefixLines("## ") : undefined} onBullet={showEditor ? () => prefixLines("- ") : undefined} onQuote={showEditor ? () => prefixLines("> ") : undefined} onCode={showEditor ? () => wrapSelection("`") : undefined} onLink={showEditor ? () => wrapSelection("[", "](https://)") : undefined} onWikiLink={showEditor ? () => wrapSelection("[[", "]]") : undefined} onRule={showEditor ? () => insertBlock("\\n---\\n") : undefined} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((v) => !v)} menuItems={[{ label: "Source", onClick: () => { setViewMode("edit"); setMenuOpen(false); } }, { label: "Reading", onClick: () => { setViewMode("read"); setMenuOpen(false); } }, { label: "Split", onClick: () => { setViewMode("split"); setMenuOpen(false); } }, { label: "Props", onClick: () => { insertFrontmatterTemplate(); setMenuOpen(false); } }, { label: inspectorOpen ? "Hide inspector" : "Inspector", onClick: () => { setInspectorOpen((v) => !v); setMenuOpen(false); } }, { label: "Save as template", onClick: () => { saveCurrentAsTemplate(); setMenuOpen(false); } }, { label: focusMode ? "Exit focus" : "Focus", onClick: () => { setFocusMode((v) => !v); setMenuOpen(false); } }]} />
            <div id="bf-drive-editor-zone" style={{ display: "grid", gridTemplateColumns: viewMode === "split" ? `${Math.round(splitRatio * 100)}% 6px minmax(0,1fr)` : "minmax(0,1fr)", gap: viewMode === "split" ? 6 : 0, alignItems: "start" }}>
              {showEditor ? <div style={{ minWidth: 0 }}><NoteEditor value={content} onChange={setContent} focusMode={focusMode} editorRef={editorRef} compact /></div> : null}
              {viewMode === "split" ? <div onMouseDown={() => beginResize("split")} style={{ cursor: "col-resize", background: "rgba(255,255,255,0.03)", minHeight: focusMode ? "84vh" : "72vh" }} title="Drag to resize split" /> : null}
              {showPreview ? <div style={{ minWidth: 0 }}><NotePreview content={content} onOpenLink={openLinkedNoteByTitle} focusMode={focusMode} onUpdateProperty={updateFrontmatterProperty} onAddProperty={addFrontmatterProperty} onRemoveProperty={removeFrontmatterProperty} propertiesCollapsed={propertiesCollapsed} onToggleProperties={() => setPropertiesCollapsed((v) => !v)} compact /></div> : null}
            </div>
          </> : <div className="card" style={{ padding: 14 }}><h2 style={{ marginTop: 0 }}>Drive</h2><div className="helper" style={{ marginBottom: 10 }}>Folders, notes, and files now live in one navigation column. Templates can insert into the current note instead of replacing it.</div><div className="helper" style={{ whiteSpace: "pre-wrap" }}>{templateDocs}</div></div>}
        </div>
      </div>
      <HelpFab pulseKey={helpPulseKey} isOpen={showHelp} onToggle={() => setShowHelp((v) => !v)} contentTitle="Drive help"><div className="helper" style={{ marginBottom: 8 }}>Templates can now be inserted into the current note instead of replacing the whole file.</div><div className="helper" style={{ marginBottom: 8 }}>Folders, notes, and files now share one navigation column. Templates live behind the tiny left rail icon.</div><div className="helper" style={{ whiteSpace: "pre-wrap" }}>{templateDocs}</div></HelpFab>
      {inspectorOpen && selectedNote ? <div style={{ position: "fixed", top: focusMode ? 8 : 94, right: 8, width: 250, maxHeight: focusMode ? "calc(100vh - 16px)" : "calc(100vh - 102px)", overflow: "auto", zIndex: 90 }}><NoteInspector note={selectedNote} backlinks={backlinks} onOpenNote={selectNote} onClose={() => setInspectorOpen(false)} compact /></div> : null}
    </div>
  );
}
