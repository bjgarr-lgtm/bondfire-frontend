import React, { useEffect, useMemo, useRef, useState } from "react";
import DriveSidebar from "../components/drive/DriveSidebar.jsx";
import NoteEditor from "../components/drive/NoteEditor.jsx";
import NotePreview from "../components/drive/NotePreview.jsx";
import DriveFilePreview from "../components/drive/DriveFilePreview.jsx";
import Breadcrumbs from "../components/drive/Breadcrumbs.jsx";
import NoteInspector from "../components/drive/NoteInspector.jsx";
import RichTextToolbar from "../components/drive/RichTextToolbar.jsx";
import HelpFab from "../components/drive/HelpFab.jsx";
import { renderTemplate, templateDocs } from "../components/drive/templateEngine.js";

const STORAGE_KEY = "bf_drive_v14";
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
  const properties = match[1]
    .split("\n")
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return null;
      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    })
    .filter((x) => x && x.key);
  return { properties, body: raw.slice(match[0].length), hasFrontmatter: true };
}
function serializeFrontmatter(properties, body) {
  const entries = (properties || []).filter((p) => String(p?.key || "").trim() !== "");
  if (!entries.length) return String(body || "");
  const lines = entries.map((p) => `${String(p.key).trim()}: ${String(p.value || "").trim()}`);
  return `---\n${lines.join("\n")}\n---\n\n${String(body || "")}`;
}
function getFileExtension(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}
function isMarkdownFile(file) {
  const ext = getFileExtension(file?.name);
  return file?.mime === "text/markdown" || ext === "md" || ext === "markdown";
}
function isEditableTextFile(file) {
  const ext = getFileExtension(file?.name);
  return String(file?.mime || "").startsWith("text/") || ["md", "markdown", "txt", "json", "js", "jsx", "ts", "tsx", "css", "html", "yml", "yaml", "xml", "csv"].includes(ext);
}
function canPreviewFileInApp(file) {
  if (!file?.dataUrl) return false;
  const mime = String(file.mime || "");
  if (mime.startsWith("image/")) return true;
  if (mime === "application/pdf") return true;
  if (mime.startsWith("audio/")) return true;
  if (mime.startsWith("video/")) return true;
  if (isEditableTextFile(file)) return true;
  return false;
}
function textToDataUrl(text, mime = "text/plain;charset=utf-8") {
  const safeMime = String(mime || "text/plain;charset=utf-8");
  return `data:${safeMime};base64,${btoa(unescape(encodeURIComponent(String(text || ""))))}`;
}

const STARTER_TEMPLATES = [
  {
    id: "tpl_daily_note",
    name: "daily note",
    title: '<% tp.date.now("YYYY-MM-DD") %>',
    body: `---
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
`,
  },
  {
    id: "tpl_timestamp",
    name: "timestamp block",
    title: "timestamp",
    body: `<% tp.date.now("HH:mm") %> — `,
  },
  {
    id: "tpl_weekly_checkin",
    name: "weekly check-in",
    title: '<% tp.date.now("YYYY-[W]WW") %> weekly check-in',
    body: `---
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
`,
  },
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
  const [sidebarWidth, setSidebarWidth] = useState(296);
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
      setSidebarWidth(Number.isFinite(raw.sidebarWidth) ? clamp(raw.sidebarWidth, 220, 380) : 296);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ folders, notes, files, templates, sidebarWidth, splitRatio, viewMode, inspectorOpen, propertiesCollapsed }));
    } catch {}
  }, [folders, notes, files, templates, sidebarWidth, splitRatio, viewMode, inspectorOpen, propertiesCollapsed]);

  useEffect(() => { setHelpPulseKey((k) => k + 1); }, [currentFolder, selectedId, selectedKind, viewMode]);

  useEffect(() => {
    const onMove = (e) => {
      if (!resizeMode.current) return;
      if (resizeMode.current === "sidebar") setSidebarWidth(clamp(e.clientX, 220, 380));
      if (resizeMode.current === "split") {
        const main = document.getElementById("bf-drive-editor-zone");
        if (!main) return;
        const rect = main.getBoundingClientRect();
        setSplitRatio(clamp((e.clientX - rect.left) / rect.width, 0.3, 0.7));
      }
    };
    const onUp = () => {
      resizeMode.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") { e.preventDefault(); createNote(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveNow(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "1") { e.preventDefault(); setViewMode("edit"); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "2") { e.preventDefault(); setViewMode("read"); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "3") { e.preventDefault(); setViewMode("split"); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") { e.preventDefault(); setInspectorOpen((v) => !v); }
      if (e.key === "Escape") {
        if (focusMode) setFocusMode(false);
        setInspectorOpen(false);
        setMenuOpen(false);
        setShowHelp(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  const selectedNote = selectedKind === "note" ? notes.find((n) => n.id === selectedId) || null : null;
  const selectedFile = selectedKind === "file" ? files.find((f) => f.id === selectedId) || null : null;
  const fileIsEditable = isEditableTextFile(selectedFile);
  const fileIsMarkdown = isMarkdownFile(selectedFile);

  const noteMap = useMemo(() => {
    const map = new Map();
    notes.forEach((note) => map.set(String(note.title || "").trim().toLowerCase(), note.id));
    return map;
  }, [notes]);

  const backlinks = selectedNote ? notes.filter((note) => note.id !== selectedNote.id && parseWikiLinks(note.body).some((link) => link.toLowerCase() === String(selectedNote.title || "").toLowerCase())) : [];

  function beginResize(which) {
    resizeMode.current = which;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }

  function createFolder() {
    const name = prompt("Folder name?");
    if (!name) return;
    setFolders((prev) => [...prev, { id: newId("folder"), name: String(name).trim(), parentId: currentFolder }]);
  }
  function renameFolder(id) {
    const folder = folders.find((f) => f.id === id);
    const name = prompt("Rename folder", folder?.name || "");
    if (!name) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: String(name).trim() } : f)));
  }
  function deleteFolder(id) {
    const parent = folders.find((f) => f.id === id)?.parentId ?? null;
    setFolders((prev) => prev.map((f) => (f.parentId === id ? { ...f, parentId: parent } : f)).filter((f) => f.id !== id));
    setNotes((prev) => prev.map((n) => (n.parentId === id ? { ...n, parentId: parent } : n)));
    setFiles((prev) => prev.map((f) => (f.parentId === id ? { ...f, parentId: parent } : f)));
    if (currentFolder === id) setCurrentFolder(parent);
  }

  function createNote() {
    const note = { id: newId("note"), title: "untitled", body: "", parentId: currentFolder, updatedAt: Date.now(), tags: [] };
    skipNextSave.current = true;
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
    setSelectedKind("note");
    setTitle(note.title);
    setContent(note.body);
    setStatus("saved");
  }
  function createNoteFromTemplate(template) {
    const renderedTitle = renderTemplate(template.title || template.name || "untitled", {});
    const renderedBody = renderTemplate(template.body || "", { title: renderedTitle });
    const note = { id: newId("note"), title: renderedTitle, body: renderedBody, parentId: currentFolder, updatedAt: Date.now(), tags: [] };
    skipNextSave.current = true;
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
    setSelectedKind("note");
    setTitle(note.title);
    setContent(note.body);
    setStatus("saved");
  }
  function selectNote(id) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    skipNextSave.current = true;
    setSelectedId(id);
    setSelectedKind("note");
    setTitle(note.title || "untitled");
    setContent(note.body || "");
    setStatus("saved");
  }
  function renameNote(id) {
    const note = notes.find((n) => n.id === id);
    const name = prompt("Rename note", note?.title || "");
    if (!name) return;
    const nextName = String(name).trim();
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title: nextName, updatedAt: Date.now() } : n)));
    if (selectedId === id && selectedKind === "note") {
      skipNextSave.current = true;
      setTitle(nextName);
      setStatus("saved");
    }
  }
  function deleteNote(id) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedId === id && selectedKind === "note") {
      setSelectedId(null);
      setTitle("untitled");
      setContent("");
      setStatus("saved");
    }
  }
  function moveNote(id) {
    const target = prompt("Move to folderId (blank for root)", currentFolder || "");
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, parentId: target || null, updatedAt: Date.now() } : n)));
  }

  function renameFile(id) {
    const file = files.find((f) => f.id === id);
    const name = prompt("Rename file", file?.name || "");
    if (!name) return;
    const nextName = String(name).trim();
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: nextName, updatedAt: Date.now() } : f)));
    if (selectedId === id && selectedKind === "file") {
      skipNextSave.current = true;
      setTitle(nextName);
      setStatus("saved");
    }
  }
  function deleteFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id && selectedKind === "file") {
      setSelectedId(null);
      setTitle("untitled");
      setContent("");
      setStatus("saved");
    }
  }
  function moveFile(id) {
    const target = prompt("Move to folderId (blank for root)", currentFolder || "");
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, parentId: target || null, updatedAt: Date.now() } : f)));
  }

  function openFileInBrowser(file) {
    if (!file?.dataUrl) return;
    const a = document.createElement("a");
    a.href = file.dataUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }
  function openFile(file) {
    if (!file?.dataUrl) return;
    if (canPreviewFileInApp(file)) {
      skipNextSave.current = true;
      setSelectedId(file.id);
      setSelectedKind("file");
      setTitle(file.name || "untitled");
      setContent(file.textContent || "");
      setStatus("saved");
      return;
    }
    openFileInBrowser(file);
  }
  function downloadFile(file) {
    const a = document.createElement("a");
    a.href = file.dataUrl;
    a.download = file.name || "download";
    a.click();
  }

  function saveNow() {
    if (!selectedId) return;
    if (selectedKind === "note") {
      const parsed = parseFrontmatter(content);
      const propertyTags = parsed.properties.find((p) => p.key.toLowerCase() === "tags")?.value || "";
      const combinedTags = [...new Set([...parseTags(parsed.body), ...String(propertyTags).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)])];
      setNotes((prev) => prev.map((n) => (n.id === selectedId ? { ...n, title, body: content, tags: combinedTags, updatedAt: Date.now() } : n)));
      setStatus("saved");
      return;
    }
    if (selectedKind === "file" && fileIsEditable) {
      setFiles((prev) => prev.map((file) => {
        if (file.id !== selectedId) return file;
        const mime = file.mime || (fileIsMarkdown ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8");
        return {
          ...file,
          name: title,
          textContent: content,
          dataUrl: textToDataUrl(content, mime),
          size: new Blob([content], { type: mime }).size,
          updatedAt: Date.now(),
        };
      }));
      setStatus("saved");
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    if (selectedKind !== "note" && !(selectedKind === "file" && fileIsEditable)) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNow(), 350);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [selectedId, selectedKind, title, content, fileIsEditable]);

  async function fileToStoredRecord(file, parentId, relativePath = "") {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    let textContent = "";
    if (isEditableTextFile(file) || String(file.type || "").startsWith("text/")) {
      try { textContent = await file.text(); } catch {}
    }
    return { id: newId("file"), name: file.name, parentId, updatedAt: Date.now(), size: file.size, mime: file.type || "application/octet-stream", dataUrl, textContent, relativePath };
  }
  async function onUploadFiles(event) {
    const chosen = Array.from(event.target.files || []);
    if (!chosen.length) return;
    const records = await Promise.all(chosen.map((file) => fileToStoredRecord(file, currentFolder)));
    setFiles((prev) => [...records, ...prev]);
    event.target.value = "";
  }
  async function onUploadFolder(event) {
    const chosen = Array.from(event.target.files || []);
    if (!chosen.length) return;
    let nextFolders = [...folders];
    const folderLookup = new Map(nextFolders.map((f) => [`${f.parentId || "root"}::${f.name}`, f.id]));
    function ensureFolderChain(segments) {
      let parentId = currentFolder;
      for (const segment of segments) {
        const key = `${parentId || "root"}::${segment}`;
        let existingId = folderLookup.get(key);
        if (!existingId) {
          existingId = newId("folder");
          nextFolders.push({ id: existingId, name: segment, parentId });
          folderLookup.set(key, existingId);
        }
        parentId = existingId;
      }
      return parentId;
    }
    const records = [];
    for (const file of chosen) {
      const rel = String(file.webkitRelativePath || file.name);
      const parts = rel.split("/").filter(Boolean);
      const fileName = parts.pop() || file.name;
      const folderParent = parts.length ? ensureFolderChain(parts) : currentFolder;
      const wrapped = new File([file], fileName, { type: file.type });
      const record = await fileToStoredRecord(wrapped, folderParent, rel);
      records.push(record);
    }
    setFolders(nextFolders);
    setFiles((prev) => [...records, ...prev]);
    event.target.value = "";
  }

  function openLinkedNoteByTitle(rawTitle) {
    const clean = String(rawTitle || "").trim();
    const existingId = noteMap.get(clean.toLowerCase());
    if (existingId) {
      const n = notes.find((x) => x.id === existingId);
      setCurrentFolder(n?.parentId || null);
      selectNote(existingId);
      return;
    }
    if (!window.confirm(`Create note "${clean}"?`)) return;
    const note = { id: newId("note"), title: clean || "untitled", body: "", parentId: currentFolder, updatedAt: Date.now(), tags: [] };
    skipNextSave.current = true;
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
    setSelectedKind("note");
    setTitle(note.title);
    setContent("");
    setStatus("saved");
  }

  function wrapSelection(prefix, suffix = prefix) {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selected = content.slice(start, end);
    setContent(content.slice(0, start) + prefix + selected + suffix + content.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + prefix.length);
    });
  }
  function prefixLines(prefix) {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selected = content.slice(start, end) || "";
    const nextSelected = selected.split("\n").map((line) => `${prefix}${line}`).join("\n");
    setContent(content.slice(0, start) + nextSelected + content.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + nextSelected.length);
    });
  }
  function insertBlock(block) {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    setContent(content.slice(0, start) + block + content.slice(start));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + block.length, start + block.length);
    });
  }
  function insertFrontmatterTemplate() {
    const parsed = parseFrontmatter(content);
    if (parsed.hasFrontmatter) return;
    setContent(serializeFrontmatter([{ key: "type", value: "bit-log" }, { key: "date", value: "" }, { key: "status", value: "" }, { key: "tags", value: "" }], content));
  }
  function updateFrontmatterProperty(key, value) {
    const parsed = parseFrontmatter(content);
    setContent(serializeFrontmatter(parsed.properties.map((p) => (p.key === key ? { ...p, value } : p)), parsed.body));
  }
  function addFrontmatterProperty() {
    const parsed = parseFrontmatter(content);
    const key = prompt("Property name?");
    if (!key) return;
    if (!parsed.hasFrontmatter) {
      setContent(serializeFrontmatter([{ key: String(key).trim(), value: "" }], content));
      return;
    }
    if (parsed.properties.some((p) => p.key === String(key).trim())) return;
    setContent(serializeFrontmatter([...parsed.properties, { key: String(key).trim(), value: "" }], parsed.body));
  }
  function removeFrontmatterProperty(key) {
    const parsed = parseFrontmatter(content);
    setContent(serializeFrontmatter(parsed.properties.filter((p) => p.key !== key), parsed.body));
  }
  function saveCurrentAsTemplate() {
    if (!content) return;
    const name = prompt("Template name?", title || "Untitled template");
    if (!name) return;
    const next = { id: newId("tpl"), name: String(name).trim(), title: title || "untitled", body: content || "" };
    setTemplates((prev) => [next, ...prev.filter((x) => x.name !== next.name)]);
  }
  function editTemplate(id) {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    const nextName = prompt("Template name", tpl.name || "") ?? tpl.name;
    if (nextName === null) return;
    const nextTitle = prompt("Template note title", tpl.title || "") ?? tpl.title;
    if (nextTitle === null) return;
    const nextBody = prompt("Template body", tpl.body || "") ?? tpl.body;
    if (nextBody === null) return;
    setTemplates((prev) => prev.map((x) => (x.id === id ? { ...x, name: String(nextName).trim(), title: String(nextTitle), body: String(nextBody) } : x)));
  }
  function applyTemplate(template) {
    if (!template) return;
    const renderedTitle = renderTemplate(template.title || template.name || "untitled", { title });
    const renderedBody = renderTemplate(template.body || "", { title: renderedTitle });
    if (!selectedId || selectedKind !== "note") {
      const note = { id: newId("note"), title: renderedTitle, body: renderedBody, parentId: currentFolder, updatedAt: Date.now(), tags: [] };
      skipNextSave.current = true;
      setNotes((prev) => [note, ...prev]);
      setSelectedId(note.id);
      setSelectedKind("note");
      setTitle(note.title);
      setContent(note.body);
      setStatus("saved");
      return;
    }
    const el = editorRef.current;
    const insertion = renderedBody || "";
    if (!el) {
      setContent((prev) => `${prev}${prev ? "\n" : ""}${insertion}`);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    setContent((prev) => prev.slice(0, start) + insertion + prev.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + insertion.length, start + insertion.length);
    });
  }
  function deleteTemplate(id) {
    setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
  }

  const showEditableDocument = selectedKind === "note" || (selectedKind === "file" && fileIsEditable);
  const showEditor = showEditableDocument && viewMode !== "read";
  const showPreview = showEditableDocument && viewMode !== "edit";
  const workspaceHeight = focusMode ? "100vh" : "calc(100vh - 86px)";

  return (
    <div style={{ position: focusMode ? "fixed" : "relative", inset: focusMode ? 0 : "auto", zIndex: focusMode ? 80 : "auto", background: "#0b0b0b", height: workspaceHeight }}>
      <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={onUploadFiles} />
      <input ref={folderInputRef} type="file" multiple webkitdirectory="true" directory="true" style={{ display: "none" }} onChange={onUploadFolder} />

      <div style={{ display: "grid", gridTemplateColumns: `${sidebarWidth}px 6px minmax(0,1fr)`, height: "100%" }}>
        <div style={{ borderRight: "1px solid #1b1b1b", overflow: "hidden" }}>
          <DriveSidebar
            folders={folders}
            notes={notes}
            files={files}
            currentFolder={currentFolder}
            selectedId={selectedId}
            selectedKind={selectedKind}
            search={search}
            setSearch={setSearch}
            onSelectFolder={setCurrentFolder}
            onSelectNote={selectNote}
            onSelectFile={openFile}
            onNewNote={createNote}
            onNewFolder={createFolder}
            onUploadFile={() => fileInputRef.current?.click()}
            onUploadFolder={() => folderInputRef.current?.click()}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
            onRenameNote={renameNote}
            onMoveNote={moveNote}
            onDeleteNote={deleteNote}
            onRenameFile={renameFile}
            onMoveFile={moveFile}
            onDeleteFile={deleteFile}
            onDownloadFile={downloadFile}
            onOpenFileInBrowser={openFileInBrowser}
            templates={templates}
            onApplyTemplate={applyTemplate}
            onNewFromTemplate={createNoteFromTemplate}
            onDeleteTemplate={deleteTemplate}
            onEditTemplate={editTemplate}
          />
        </div>

        <div onMouseDown={() => beginResize("sidebar")} style={{ cursor: "col-resize", background: "rgba(255,255,255,0.03)" }} title="Drag to resize explorer" />

        <div style={{ minWidth: 0, overflow: "auto", padding: 10 }}>
          <Breadcrumbs folders={folders} currentFolder={currentFolder} setCurrentFolder={setCurrentFolder} compact />

          {showEditableDocument ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" style={{ flex: 1, minWidth: 220, fontSize: 20, fontWeight: 800, background: "transparent", border: "none", outline: "none", color: "#fff", padding: "2px 0" }} />
                <span className="helper">{status}</span>
                {selectedFile && !fileIsEditable ? <span className="helper">read only</span> : null}
              </div>

              <RichTextToolbar
                onBold={showEditor ? () => wrapSelection("**") : undefined}
                onItalic={showEditor ? () => wrapSelection("*") : undefined}
                onH1={showEditor ? () => prefixLines("# ") : undefined}
                onH2={showEditor ? () => prefixLines("## ") : undefined}
                onBullet={showEditor ? () => prefixLines("- ") : undefined}
                onQuote={showEditor ? () => prefixLines("> ") : undefined}
                onCode={showEditor ? () => wrapSelection("`") : undefined}
                onRule={showEditor ? () => insertBlock("\n---\n") : undefined}
                onLink={showEditor ? () => wrapSelection("[", "](https://)") : undefined}
                onWikiLink={showEditor ? () => wrapSelection("[[", "]]") : undefined}
                menuOpen={menuOpen}
                onToggleMenu={() => setMenuOpen((v) => !v)}
                menuItems={[
                  { label: "Source", onClick: () => { setViewMode("edit"); setMenuOpen(false); } },
                  { label: "Reading", onClick: () => { setViewMode("read"); setMenuOpen(false); } },
                  { label: "Split", onClick: () => { setViewMode("split"); setMenuOpen(false); } },
                  { label: "Props", onClick: () => { insertFrontmatterTemplate(); setMenuOpen(false); } },
                  { label: inspectorOpen ? "Hide inspector" : "Inspector", onClick: () => { setInspectorOpen((v) => !v); setMenuOpen(false); } },
                  { label: "Save as template", onClick: () => { saveCurrentAsTemplate(); setMenuOpen(false); } },
                  selectedFile ? { label: "Open in browser", onClick: () => { openFileInBrowser(selectedFile); setMenuOpen(false); } } : null,
                  selectedFile ? { label: "Download", onClick: () => { downloadFile(selectedFile); setMenuOpen(false); } } : null,
                  { label: focusMode ? "Exit focus" : "Focus", onClick: () => { setFocusMode((v) => !v); setMenuOpen(false); } },
                ].filter(Boolean)}
              />

              <div id="bf-drive-editor-zone" style={{ display: "grid", gridTemplateColumns: viewMode === "split" ? `${Math.round(splitRatio * 100)}% 6px minmax(0,1fr)` : "minmax(0,1fr)", gap: viewMode === "split" ? 6 : 0, alignItems: "start" }}>
                {showEditor ? <div style={{ minWidth: 0 }}><NoteEditor value={content} onChange={setContent} focusMode={focusMode} editorRef={editorRef} compact /></div> : null}
                {viewMode === "split" ? <div onMouseDown={() => beginResize("split")} style={{ cursor: "col-resize", background: "rgba(255,255,255,0.03)", minHeight: focusMode ? "84vh" : "72vh" }} title="Drag to resize split" /> : null}
                {showPreview ? (
                  <div style={{ minWidth: 0 }}>
                    {selectedKind === "file" && !fileIsMarkdown ? (
                      <pre style={{ whiteSpace: "pre-wrap", margin: 0, background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 12, padding: 16, minHeight: "72vh", overflow: "auto" }}>{String(content || "")}</pre>
                    ) : (
                      <NotePreview content={content} onOpenLink={openLinkedNoteByTitle} focusMode={focusMode} onUpdateProperty={updateFrontmatterProperty} onAddProperty={addFrontmatterProperty} onRemoveProperty={removeFrontmatterProperty} propertiesCollapsed={propertiesCollapsed} onToggleProperties={() => setPropertiesCollapsed((v) => !v)} compact />
                    )}
                  </div>
                ) : null}
              </div>
            </>
          ) : selectedFile ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>{selectedFile.name}</h2>
                <span className="helper">{selectedFile.mime || "file"}</span>
                <span className="helper">{Math.round((Number(selectedFile.size || 0) / 1024) * 10) / 10} KB</span>
              </div>
              <DriveFilePreview file={selectedFile} />
            </>
          ) : (
            <div className="card" style={{ padding: 14 }}>
              <h2 style={{ marginTop: 0 }}>Drive</h2>
              <div className="helper" style={{ marginBottom: 10 }}>Compact explorer on the left, editor on the right. Humans do love rebuilding the same file browser forever.</div>
              <div className="helper" style={{ whiteSpace: "pre-wrap" }}>{templateDocs}</div>
            </div>
          )}
        </div>
      </div>

      <HelpFab pulseKey={helpPulseKey} isOpen={showHelp} onToggle={() => setShowHelp((v) => !v)} contentTitle="Drive help">
        <div className="helper" style={{ marginBottom: 8 }}>Templates insert into the current note. New note from template lives in the template menu.</div>
        <div className="helper" style={{ marginBottom: 8 }}>Markdown and other text uploads can be edited in app. PDFs, images, audio, and video preview in place.</div>
        <div className="helper" style={{ whiteSpace: "pre-wrap" }}>{templateDocs}</div>
      </HelpFab>

      {inspectorOpen && selectedNote ? (
        <div style={{ position: "fixed", top: focusMode ? 8 : 94, right: 8, width: 250, maxHeight: focusMode ? "calc(100vh - 16px)" : "calc(100vh - 102px)", overflow: "auto", zIndex: 90 }}>
          <NoteInspector note={selectedNote} backlinks={backlinks} onOpenNote={selectNote} onClose={() => setInspectorOpen(false)} compact />
        </div>
      ) : null}
    </div>
  );
}
