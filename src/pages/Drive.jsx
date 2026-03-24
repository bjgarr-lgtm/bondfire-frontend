import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../utils/api.js";
import DriveSidebar from "../components/drive/DriveSidebar.jsx";
import NoteEditor from "../components/drive/NoteEditor.jsx";
import NotePreview from "../components/drive/NotePreview.jsx";
import DriveFilePreview from "../components/drive/DriveFilePreview.jsx";
import Breadcrumbs from "../components/drive/Breadcrumbs.jsx";
import NoteInspector from "../components/drive/NoteInspector.jsx";
import RichTextToolbar from "../components/drive/RichTextToolbar.jsx";
import DriveCreateModal from "../components/drive/DriveCreateModal.jsx";
import SpreadsheetFileView from "../components/drive/SpreadsheetFileView.jsx";
import FormFileView from "../components/drive/FormFileView.jsx";
import { renderTemplate } from "../components/drive/templateEngine.js";
import { DRIVE_ZK_FILE_MIME, decryptDriveBytesString, decryptDriveJson, decryptDriveText, encryptDriveBytesToString, encryptDriveJson, encryptDriveText, getDriveOrgKey, isZkString } from "../lib/driveZk.js";

const LEGACY_STORAGE_KEY = "bf_drive_v14";
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

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
  const mime = String(file?.mime || "");
  if (mime === "application/vnd.bondfire.sheet+json") return true;
  if (mime === "application/vnd.bondfire.form+json") return true;
  return mime.startsWith("text/") || ["md", "markdown", "txt", "json", "js", "jsx", "ts", "tsx", "css", "html", "yml", "yaml", "xml", "csv", "bfsheet", "bfform"].includes(ext);
}
function canPreviewFileInApp(file) {
  const mime = String(file?.mime || "");
  if (mime.startsWith("image/")) return true;
  if (mime === "application/pdf") return true;
  if (mime.startsWith("audio/")) return true;
  if (mime.startsWith("video/")) return true;
  if (mime === "application/vnd.bondfire.sheet+json") return true;
  if (mime === "application/vnd.bondfire.form+json") return true;
  if (isEditableTextFile(file)) return true;
  return false;
}
function textToDataUrl(text, mime = "text/plain;charset=utf-8") {
  const safeMime = String(mime || "text/plain;charset=utf-8");
  return `data:${safeMime};base64,${btoa(unescape(encodeURIComponent(String(text || ""))))}`;
}
function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(String(text || "")); } catch { return fallback; }
}
function isBondfireSheetFile(file, rawContent = "") {
  const mime = String(file?.mime || "");
  if (mime === "application/vnd.bondfire.sheet+json") return true;
  const ext = getFileExtension(file?.name);
  if (ext === "bfsheet") return true;
  const parsed = safeJsonParse(rawContent, null);
  return parsed?.type === "bondfire-sheet";
}
function isBondfireFormFile(file, rawContent = "") {
  const mime = String(file?.mime || "");
  if (mime === "application/vnd.bondfire.form+json") return true;
  const ext = getFileExtension(file?.name);
  if (ext === "bfform") return true;
  const parsed = safeJsonParse(rawContent, null);
  return parsed?.type === "bondfire-form";
}
function buildStarterSheet() {
  return JSON.stringify({
    type: "bondfire-sheet",
    version: 1,
    columns: ["A", "B", "C", "D"],
    rows: [["", "", "", ""], ["", "", "", ""], ["", "", "", ""]],
  }, null, 2);
}
function buildStarterForm() {
  return JSON.stringify({
    type: "bondfire-form",
    version: 2,
    title: "Untitled form",
    description: "",
    fields: [
      { id: "field_1", type: "text", label: "Your name", required: false, options: [] },
      { id: "field_2", type: "paragraph", label: "Details", required: false, options: [] },
    ],
    responses: [],
    publicShare: { enabled: false, token: "" },
  }, null, 2);
}

const ZK_FILE_PLACEHOLDER = "encrypted file";

function uint8ToText(bytes) {
  try { return new TextDecoder().decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || [])); } catch { return ""; }
}

async function decryptFolderForDrive(orgId, folder) {
  if (!folder) return folder;
  if (!isZkString(folder.name)) return folder;
  return { ...folder, zkEncrypted: true, encryptedName: folder.name, name: await decryptDriveText(orgId, folder.name, "untitled folder") || "untitled folder" };
}
async function decryptNoteForDrive(orgId, note) {
  if (!note) return note;
  if (!isZkString(note.title) && !isZkString(note.body) && !isZkString(note.tags)) return note;
  const tags = await decryptDriveJson(orgId, note.tags, Array.isArray(note.tags) ? note.tags : []);
  return {
    ...note,
    zkEncrypted: true,
    encryptedTitle: note.title,
    encryptedBody: note.body,
    encryptedTags: note.tags,
    title: await decryptDriveText(orgId, note.title, "untitled") || "untitled",
    body: await decryptDriveText(orgId, note.body, ""),
    tags: Array.isArray(tags) ? tags : [],
  };
}
async function decryptTemplateForDrive(orgId, template) {
  if (!template) return template;
  if (!isZkString(template.name) && !isZkString(template.title) && !isZkString(template.body)) return template;
  return {
    ...template,
    zkEncrypted: true,
    encryptedName: template.name,
    encryptedTitle: template.title,
    encryptedBody: template.body,
    name: await decryptDriveText(orgId, template.name, "template") || "template",
    title: await decryptDriveText(orgId, template.title, "untitled") || "untitled",
    body: await decryptDriveText(orgId, template.body, ""),
  };
}
async function decryptFileMetaForDrive(orgId, file) {
  if (!file) return file;
  if (String(file?.mime || "") !== DRIVE_ZK_FILE_MIME || !isZkString(file?.name)) return file;
  const meta = await decryptDriveJson(orgId, file.name, null);
  return {
    ...file,
    zkEncrypted: true,
    encryptedName: file.name,
    encryptedMime: file.mime,
    name: String(meta?.name || ZK_FILE_PLACEHOLDER),
    mime: String(meta?.mime || "application/octet-stream"),
    size: Number(meta?.size || file.size || 0),
  };
}
async function decryptDriveTree(orgId, data) {
  const folders = await Promise.all((Array.isArray(data?.folders) ? data.folders : []).map((row) => decryptFolderForDrive(orgId, row)));
  const notes = await Promise.all((Array.isArray(data?.notes) ? data.notes : []).map((row) => decryptNoteForDrive(orgId, row)));
  const files = await Promise.all((Array.isArray(data?.files) ? data.files : []).map((row) => decryptFileMetaForDrive(orgId, row)));
  const templates = await Promise.all((Array.isArray(data?.templates) ? data.templates : []).map((row) => decryptTemplateForDrive(orgId, row)));
  return { folders, notes, files, templates };
}

async function encryptDriveFileMeta(orgId, meta) {
  return encryptDriveJson(orgId, { name: meta?.name || ZK_FILE_PLACEHOLDER, mime: meta?.mime || "application/octet-stream", size: Number(meta?.size || 0) });
}


function buildDriveFileUrls(orgId, fileId) {
  const encodedOrgId = encodeURIComponent(String(orgId || ""));
  const encodedFileId = encodeURIComponent(String(fileId || ""));
  const base = `/api/orgs/${encodedOrgId}/drive/files/${encodedFileId}/download`;
  return { previewUrl: base, downloadUrl: `${base}?download=1`, url: base };
}
function withFileUrls(orgId, file) {
  if (!file?.id) return file;
  return { ...file, ...buildDriveFileUrls(orgId, file.id) };
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
  const { orgId = "" } = useParams();
  const uiStorageKey = `bf_drive_ui_v14_${orgId}`;
  const importMarkerKey = `bf_drive_imported_${orgId}`;

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
  const [loadState, setLoadState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const saveTimer = useRef(null);
  const skipNextSave = useRef(false);
  const resizeMode = useRef(null);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const objectUrlRegistry = useRef(new Set());

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(uiStorageKey) || "{}");
      setSidebarWidth(Number.isFinite(raw.sidebarWidth) ? clamp(raw.sidebarWidth, 220, 380) : 296);
      setSplitRatio(Number.isFinite(raw.splitRatio) ? clamp(raw.splitRatio, 0.3, 0.7) : 0.5);
      setViewMode(["edit", "read", "split"].includes(raw.viewMode) ? raw.viewMode : "split");
      setInspectorOpen(!!raw.inspectorOpen);
      setPropertiesCollapsed(!!raw.propertiesCollapsed);
    } catch {}
  }, [uiStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(uiStorageKey, JSON.stringify({ sidebarWidth, splitRatio, viewMode, inspectorOpen, propertiesCollapsed }));
    } catch {}
  }, [uiStorageKey, sidebarWidth, splitRatio, viewMode, inspectorOpen, propertiesCollapsed]);

  async function loadDrive({ preserveSelection = true } = {}) {
    if (!orgId) return;
    setLoadState("loading");
    setLoadError("");
    try {
      let data = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive`);
      const empty = !data?.folders?.length && !data?.notes?.length && !data?.files?.length && !data?.templates?.length;
      if (empty) {
        try {
          const alreadyImported = localStorage.getItem(importMarkerKey) === "1";
          const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
          const hasLegacy = Array.isArray(legacy?.folders) && legacy.folders.length || Array.isArray(legacy?.notes) && legacy.notes.length || Array.isArray(legacy?.files) && legacy.files.length || Array.isArray(legacy?.templates) && legacy.templates.length;
          if (!alreadyImported && hasLegacy) {
            await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/import`, {
              method: "POST",
              body: JSON.stringify({
                folders: legacy.folders || [],
                notes: legacy.notes || [],
                files: legacy.files || [],
                templates: legacy.templates || STARTER_TEMPLATES,
              }),
            });
            localStorage.setItem(importMarkerKey, "1");
            data = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive`);
          }
        } catch {}
      }
      const decrypted = await decryptDriveTree(orgId, data || {});
      const nextFolders = Array.isArray(decrypted?.folders) ? decrypted.folders : [];
      const nextNotes = Array.isArray(decrypted?.notes) ? decrypted.notes : [];
      const nextFiles = (Array.isArray(decrypted?.files) ? decrypted.files : []).map((file) => withFileUrls(orgId, file));
      const nextTemplates = Array.isArray(decrypted?.templates) && decrypted.templates.length ? decrypted.templates : STARTER_TEMPLATES;
      setFolders(nextFolders);
      setNotes(nextNotes);
      setFiles(nextFiles);
      setTemplates(nextTemplates);
      if (preserveSelection && selectedId) {
        if (selectedKind === "note") {
          const note = nextNotes.find((n) => n.id === selectedId);
          if (note) {
            skipNextSave.current = true;
            setTitle(note.title || "untitled");
            setContent(note.body || "");
          } else {
            setSelectedId(null);
            setTitle("untitled");
            setContent("");
          }
        }
        if (selectedKind === "file") {
          const file = nextFiles.find((f) => f.id === selectedId);
          if (!file) {
            setSelectedId(null);
            setTitle("untitled");
            setContent("");
          }
        }
      }
      setLoadState("ready");
    } catch (e) {
      setLoadError(String(e?.message || e || "Failed to load Drive"));
      setLoadState("error");
    }
  }

  useEffect(() => {
    loadDrive({ preserveSelection: false });
  }, [orgId]);

  useEffect(() => {
    const folderInput = folderInputRef.current;
    if (folderInput) {
      folderInput.setAttribute("webkitdirectory", "true");
      folderInput.setAttribute("directory", "true");
    }
    return () => {
      objectUrlRegistry.current.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch {}
      });
      objectUrlRegistry.current.clear();
    };
  }, []);

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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode, selectedId, selectedKind, title, content]);

  const selectedNote = selectedKind === "note" ? notes.find((n) => n.id === selectedId) || null : null;
  const selectedFile = selectedKind === "file" ? files.find((f) => f.id === selectedId) || null : null;
  const selectedFileSubtype = selectedKind === "file" && selectedFile ? (isBondfireSheetFile(selectedFile, content) ? "sheet" : isBondfireFormFile(selectedFile, content) ? "form" : null) : null;
  const fileIsEditable = isEditableTextFile(selectedFile);
  const fileIsMarkdown = isMarkdownFile(selectedFile);
  const isStructuredDriveDoc = selectedFileSubtype === "sheet" || selectedFileSubtype === "form";

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

  async function createFolder() {
    const name = prompt("Folder name?");
    if (!name) return;
    const payloadName = getDriveOrgKey(orgId) ? await encryptDriveText(orgId, String(name).trim()) : String(name).trim();
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/folders`, {
      method: "POST",
      body: JSON.stringify({ name: payloadName, parentId: currentFolder }),
    });
    const folder = await decryptFolderForDrive(orgId, res?.folder);
    if (!folder) return;
    setFolders((prev) => [...prev, folder]);
    setCurrentFolder(folder.id);
  }
  async function renameFolder(id) {
    const folder = folders.find((f) => f.id === id);
    const name = prompt("Rename folder", folder?.name || "");
    if (!name) return;
    const payloadName = getDriveOrgKey(orgId) ? await encryptDriveText(orgId, String(name).trim()) : String(name).trim();
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/folders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: payloadName }),
    });
    const nextFolder = await decryptFolderForDrive(orgId, res?.folder);
    if (!nextFolder) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? nextFolder : f)));
  }
  async function deleteFolder(id) {
    await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/folders/${encodeURIComponent(id)}`, { method: "DELETE" });
    const parent = folders.find((f) => f.id === id)?.parentId ?? null;
    setFolders((prev) => prev.map((f) => (f.parentId === id ? { ...f, parentId: parent } : f)).filter((f) => f.id !== id));
    setNotes((prev) => prev.map((n) => (n.parentId === id ? { ...n, parentId: parent } : n)));
    setFiles((prev) => prev.map((f) => (f.parentId === id ? { ...f, parentId: parent } : f)));
    if (currentFolder === id) setCurrentFolder(parent);
  }

  async function createNoteWithPayload(payload) {
    const toSend = getDriveOrgKey(orgId) ? {
      ...payload,
      title: await encryptDriveText(orgId, payload?.title || "untitled"),
      body: await encryptDriveText(orgId, payload?.body || payload?.content || ""),
      tags: await encryptDriveJson(orgId, Array.isArray(payload?.tags) ? payload.tags : []),
    } : payload;
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes`, {
      method: "POST",
      body: JSON.stringify(toSend),
    });
    const note = await decryptNoteForDrive(orgId, res?.note);
    if (!note) return null;
    skipNextSave.current = true;
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
    setSelectedKind("note");
    setTitle(note.title || "untitled");
    setContent(note.body || "");
    setStatus("saved");
    return note;
  }
  async function createNote() {
    await createNoteWithPayload({ title: "untitled", body: "", parentId: currentFolder, tags: [] });
  }
  async function createFileWithPayload(payload) {
    const name = String(payload?.name || "untitled.txt");
    const mime = String(payload?.mime || "text/plain;charset=utf-8");
    const textContent = String(payload?.textContent || "");
    const bytes = new TextEncoder().encode(textContent);
    const orgKey = getDriveOrgKey(orgId);
    if (!orgKey) {
      const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files`, {
        method: "POST",
        body: JSON.stringify({
          name,
          parentId: payload?.parentId ?? currentFolder,
          mime,
          size: new Blob([textContent], { type: mime }).size,
          textContent,
          dataUrl: textToDataUrl(textContent, mime),
        }),
      });
      const file = res?.file ? withFileUrls(orgId, res.file) : null;
      if (!file) return null;
      setFiles((prev) => [file, ...prev.filter((existing) => existing.id !== file.id)]);
      skipNextSave.current = true;
      setSelectedId(file.id);
      setSelectedKind("file");
      setTitle(file.name || "untitled");
      setContent(file.textContent || textContent);
      setStatus("saved");
      return file;
    }
    const metaCipher = await encryptDriveFileMeta(orgId, { name, mime, size: bytes.byteLength });
    const contentCipher = await encryptDriveBytesToString(orgId, bytes);
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files`, {
      method: "POST",
      body: JSON.stringify({
        name: metaCipher,
        parentId: payload?.parentId ?? currentFolder,
        mime: DRIVE_ZK_FILE_MIME,
        size: bytes.byteLength,
        textContent: contentCipher,
        dataUrl: textToDataUrl(contentCipher, "text/plain;charset=utf-8"),
      }),
    });
    const file = res?.file ? withFileUrls(orgId, await decryptFileMetaForDrive(orgId, res.file)) : null;
    if (!file) return null;
    const nextFile = { ...file, textContent, zkEncrypted: true };
    setFiles((prev) => [nextFile, ...prev.filter((existing) => existing.id !== file.id)]);
    skipNextSave.current = true;
    setSelectedId(file.id);
    setSelectedKind("file");
    setTitle(nextFile.name || "untitled");
    setContent(textContent);
    setStatus("saved");
    return nextFile;
  }
  async function createSpreadsheet() {
    await createFileWithPayload({
      name: `${new Date().toISOString().slice(0, 10)} sheet.bfsheet`,
      mime: "application/vnd.bondfire.sheet+json",
      textContent: buildStarterSheet(),
    });
  }
  async function createForm() {
    await createFileWithPayload({
      name: `${new Date().toISOString().slice(0, 10)} form.bfform`,
      mime: "application/vnd.bondfire.form+json",
      textContent: buildStarterForm(),
    });
  }
  async function createNoteFromTemplate(template) {
    const renderedTitle = renderTemplate(template.title || template.name || "untitled", {});
    const renderedBody = renderTemplate(template.body || "", { title: renderedTitle });
    await createNoteWithPayload({ title: renderedTitle, body: renderedBody, parentId: currentFolder, tags: [] });
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
  async function renameNote(id) {
    const note = notes.find((n) => n.id === id);
    const name = prompt("Rename note", note?.title || "");
    if (!name) return;
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ title: String(name).trim() }),
    });
    const nextNote = await decryptNoteForDrive(orgId, res?.note);
    if (!nextNote) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? nextNote : n)));
    if (selectedId === id && selectedKind === "note") {
      skipNextSave.current = true;
      setTitle(res.note.title || "untitled");
      setContent(res.note.body || "");
      setStatus("saved");
    }
  }
  async function deleteNote(id) {
    await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedId === id && selectedKind === "note") {
      setSelectedId(null);
      setTitle("untitled");
      setContent("");
      setStatus("saved");
    }
  }
  async function moveNote(id) {
    const target = prompt("Move to folderId (blank for root)", currentFolder || "");
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ parentId: target || null }),
    });
    const nextNote = await decryptNoteForDrive(orgId, res?.note);
    if (!nextNote) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? nextNote : n)));
  }

  async function renameFile(id) {
    const file = files.find((f) => f.id === id);
    const name = prompt("Rename file", file?.name || "");
    if (!name) return;
    const payload = file?.zkEncrypted ? { name: await encryptDriveFileMeta(orgId, { name: String(name).trim(), mime: file.mime, size: file.size }) } : { name: String(name).trim() };
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const nextFile = await decryptFileMetaForDrive(orgId, res?.file);
    if (!nextFile) return;
    setFiles((prev) => prev.map((f) => (f.id === id ? withFileUrls(orgId, { ...f, ...nextFile }) : f)));
    if (selectedId === id && selectedKind === "file") {
      skipNextSave.current = true;
      setTitle(nextFile.name || "untitled");
      setContent(file?.textContent || content);
      setStatus("saved");
    }
  }
  async function deleteFile(id) {
    await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(id)}`, { method: "DELETE" });
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id && selectedKind === "file") {
      setSelectedId(null);
      setTitle("untitled");
      setContent("");
      setStatus("saved");
    }
  }
  async function moveFile(id) {
    const target = prompt("Move to folderId (blank for root)", currentFolder || "");
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ parentId: target || null }),
    });
    const nextFile = await decryptFileMetaForDrive(orgId, res?.file);
    if (!nextFile) return;
    setFiles((prev) => prev.map((f) => (f.id === id ? withFileUrls(orgId, { ...f, ...nextFile }) : f)));
  }

  async function hydrateFile(fileId) {
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(fileId)}`);
    let hydrated = res?.file || null;
    if (!hydrated) return null;
    hydrated = await decryptFileMetaForDrive(orgId, hydrated);
    if (hydrated?.zkEncrypted) {
      const cipher = String(res?.file?.textContent || hydrated?.textContent || "");
      if (cipher) {
        try {
          const bytes = await decryptDriveBytesString(orgId, cipher);
          const blob = new Blob([bytes], { type: hydrated.mime || "application/octet-stream" });
          const objectUrl = URL.createObjectURL(blob);
          objectUrlRegistry.current.add(objectUrl);
          hydrated = { ...hydrated, previewObjectUrl: objectUrl, dataUrl: objectUrl };
          if (isEditableTextFile(hydrated) || isMarkdownFile(hydrated)) hydrated = { ...hydrated, textContent: uint8ToText(bytes) };
        } catch (e) {
          console.error("Drive decrypt failed", e);
        }
      }
    }
    setFiles((prev) => prev.map((f) => (f.id === fileId ? withFileUrls(orgId, { ...f, ...hydrated }) : f)));
    return hydrated;
  }

  async function openFileInBrowser(file) {
    let current = file;
    if (current?.zkEncrypted && !current?.dataUrl && !current?.previewObjectUrl && current?.id) current = await hydrateFile(current.id);
    const name = String(current?.name || "");
    const mime = String(current?.mime || "");
    const textContent = String(current?.textContent || "");
    if ((/\.bfform$/i.test(name) || mime === "application/vnd.bondfire.form+json") && textContent) {
      try {
        const parsed = JSON.parse(textContent);
        const token = String(parsed?.publicShare?.token || "");
        if (parsed?.publicShare?.enabled && token) {
          window.open(`${window.location.origin}/api/public/forms/${encodeURIComponent(current.id)}?token=${encodeURIComponent(token)}`, "_blank", "noopener,noreferrer");
          return;
        }
        const blob = new Blob([`<!doctype html><html><head><meta charset="utf-8" /><title>${name}</title><style>body{font-family:Inter,system-ui,sans-serif;background:#090909;color:#fff;padding:24px}pre{white-space:pre-wrap;background:#111214;border:1px solid #232427;border-radius:12px;padding:16px}</style></head><body><h1>${name}</h1><pre>${textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></body></html>`], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
        return;
      } catch {}
    }
    if ((/\.bfsheet$/i.test(name) || mime === "application/vnd.bondfire.sheet+json") && textContent) {
      try {
        const parsed = JSON.parse(textContent);
        const sheet = Array.isArray(parsed?.sheets) && parsed.sheets.length ? parsed.sheets[0] : null;
        const rows = Math.max(25, Number(sheet?.rowCount || 25));
        const cols = Math.max(10, Number(sheet?.columnCount || 10));
        const labels = Array.from({ length: cols }, (_, idx) => {
          let n = idx + 1; let out = ""; while (n > 0) { const rem = (n - 1) % 26; out = String.fromCharCode(65 + rem) + out; n = Math.floor((n - 1) / 26); } return out;
        });
        const cells = sheet?.cells || {};
        const esc = (value) => String(value || "").replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const table = `<table><thead><tr><th>#</th>${labels.map((label)=>`<th>${label}</th>`).join("")}</tr></thead><tbody>${Array.from({ length: rows }, (_, r)=>`<tr><th>${r+1}</th>${labels.map((label)=>`<td>${esc(cells[`${label}${r+1}`]?.input || "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        const blob = new Blob([`<!doctype html><html><head><meta charset="utf-8" /><title>${name}</title><style>body{font-family:Inter,system-ui,sans-serif;background:#090909;color:#fff;padding:24px}table{border-collapse:collapse;background:#111214}th,td{border:1px solid #26282c;padding:8px 10px;min-width:120px}th{background:#15171b;position:sticky;top:0}</style></head><body><h1>${name}</h1>${table}</body></html>`], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
        return;
      } catch {}
    }
    if (current?.dataUrl) {
      const a = document.createElement("a");
      a.href = current.dataUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
      return;
    }
    window.open(current?.previewUrl || `/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(current.id)}/download`, "_blank", "noopener,noreferrer");
  }
  async function openFile(file) {
    let nextFile = withFileUrls(orgId, file);
    if (!nextFile) return;
    if (((nextFile.zkEncrypted || isEditableTextFile(nextFile)) && !nextFile.textContent && !nextFile.dataUrl && !nextFile.previewObjectUrl) || (nextFile.zkEncrypted && !nextFile.previewObjectUrl && !nextFile.textContent)) {
      nextFile = await hydrateFile(nextFile.id);
      if (!nextFile) return;
      nextFile = withFileUrls(orgId, nextFile);
    }
    if (canPreviewFileInApp(nextFile)) {
      skipNextSave.current = true;
      setSelectedId(nextFile.id);
      setSelectedKind("file");
      setTitle(nextFile.name || "untitled");
      setContent(nextFile.textContent || "");
      setStatus("saved");
      return;
    }
    openFileInBrowser(nextFile);
  }
  async function downloadFile(file) {
    let nextFile = file;
    if (nextFile?.zkEncrypted && !nextFile?.dataUrl && !nextFile?.previewObjectUrl) nextFile = await hydrateFile(file.id);
    const a = document.createElement("a");
    a.href = nextFile?.dataUrl || nextFile?.previewObjectUrl || nextFile?.downloadUrl || `/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(file.id)}/download?download=1`;
    a.download = nextFile?.name || "download";
    a.click();
  }

  async function saveNow() {
    if (!selectedId) return;
    try {
      if (selectedKind === "note") {
        const parsed = parseFrontmatter(content);
        const propertyTags = parsed.properties.find((p) => p.key.toLowerCase() === "tags")?.value || "";
        const combinedTags = [...new Set([...parseTags(parsed.body), ...String(propertyTags).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)])];
        const notePayload = getDriveOrgKey(orgId) ? { title: await encryptDriveText(orgId, title), body: await encryptDriveText(orgId, content), tags: await encryptDriveJson(orgId, combinedTags) } : { title, body: content, tags: combinedTags };
        const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes/${encodeURIComponent(selectedId)}`, {
          method: "PATCH",
          body: JSON.stringify(notePayload),
        });
        const nextNote = await decryptNoteForDrive(orgId, res?.note);
        if (nextNote) {
          setNotes((prev) => prev.map((n) => (n.id === selectedId ? nextNote : n)));
        }
        setStatus("saved");
        return;
      }
      if (selectedKind === "file" && fileIsEditable) {
        const mime = selectedFile?.mime || (fileIsMarkdown ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8");
        let payload;
        if (selectedFile?.zkEncrypted) {
          const bytes = new TextEncoder().encode(content);
          const cipher = await encryptDriveBytesToString(orgId, bytes);
          payload = {
            name: await encryptDriveFileMeta(orgId, { name: title, mime, size: bytes.byteLength }),
            mime: DRIVE_ZK_FILE_MIME,
            size: bytes.byteLength,
            dataUrl: textToDataUrl(cipher, "text/plain;charset=utf-8"),
            textContent: cipher,
          };
        } else {
          const dataUrl = textToDataUrl(content, mime);
          payload = { name: title, mime, size: new Blob([content], { type: mime }).size, dataUrl, textContent: content };
        }
        const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(selectedId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        const nextFile = await decryptFileMetaForDrive(orgId, res?.file);
        if (nextFile) {
          setFiles((prev) => prev.map((file) => (file.id === selectedId ? withFileUrls(orgId, { ...file, ...nextFile, textContent: content }) : file)));
        }
        setStatus("saved");
      }
    } catch {
      setStatus("error");
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
    saveTimer.current = setTimeout(() => { saveNow(); }, 350);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [selectedId, selectedKind, title, content, fileIsEditable]);

  async function fileToStoredRecord(file, parentId, relativePath = "") {
    let textContent = "";
    if (isEditableTextFile({ name: file?.name, mime: file?.type })) {
      try { textContent = await file.text(); } catch {}
    }
    return {
      name: file?.name || "file",
      parentId,
      updatedAt: Date.now(),
      size: Number(file?.size || 0),
      mime: file?.type || "application/octet-stream",
      textContent,
      relativePath,
    };
  }

  async function uploadFileRecord(rawFile, parentId, relativePath = "") {
    const record = await fileToStoredRecord(rawFile, parentId, relativePath);
    const isPreviewableBinary = canPreviewFileInApp(record) && !isEditableTextFile(record);
    const localPreviewUrl = isPreviewableBinary ? URL.createObjectURL(rawFile) : "";
    if (localPreviewUrl) objectUrlRegistry.current.add(localPreviewUrl);

    const tempId = `uploading_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimisticFile = withFileUrls(orgId, {
      id: tempId,
      ...record,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      previewObjectUrl: localPreviewUrl || undefined,
      isUploading: true,
      zkEncrypted: !!getDriveOrgKey(orgId),
    });
    setFiles((prev) => [optimisticFile, ...prev.filter((existing) => existing.id !== tempId)]);

    try {
      let res;
      if (getDriveOrgKey(orgId)) {
        const bytes = new Uint8Array(await rawFile.arrayBuffer());
        const encryptedString = await encryptDriveBytesToString(orgId, bytes);
        const encryptedBytes = new TextEncoder().encode(encryptedString);
        const headers = {
          "x-drive-name": await encryptDriveFileMeta(orgId, { name: record.name || rawFile.name || "file", mime: record.mime || rawFile.type || "application/octet-stream", size: Number(rawFile?.size || bytes.byteLength || 0) }),
          "x-drive-mime": DRIVE_ZK_FILE_MIME,
        };
        if (parentId) headers["x-drive-parent-id"] = String(parentId);
        if (relativePath) headers["x-drive-relative-path"] = String(relativePath);
        res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files`, { method: "POST", headers, body: encryptedBytes });
      } else {
        const headers = {
          "x-drive-name": record.name || rawFile.name || "file",
          "x-drive-mime": record.mime || rawFile.type || "application/octet-stream",
        };
        if (parentId) headers["x-drive-parent-id"] = String(parentId);
        if (relativePath) headers["x-drive-relative-path"] = String(relativePath);
        try {
          res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files`, { method: "POST", headers, body: rawFile });
        } catch {
          const form = new FormData();
          form.append("file", rawFile, rawFile.name || record.name || "file");
          form.append("name", record.name || rawFile.name || "file");
          form.append("mime", record.mime || rawFile.type || "application/octet-stream");
          if (parentId) form.append("parentId", String(parentId));
          if (relativePath) form.append("relativePath", String(relativePath));
          res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files`, { method: "POST", body: form });
        }
      }

      const createdFile = res?.file || (res?.id ? { id: res.id } : null);
      if (!createdFile?.id) throw new Error("UPLOAD_FAILED");

      const decryptedCreated = await decryptFileMetaForDrive(orgId, createdFile);
      const nextFile = withFileUrls(orgId, {
        ...record,
        ...decryptedCreated,
        previewObjectUrl: localPreviewUrl || undefined,
      });
      setFiles((prev) => [nextFile, ...prev.filter((existing) => existing.id !== tempId && existing.id !== nextFile.id)]);
      return nextFile;
    } catch (error) {
      setFiles((prev) => prev.filter((existing) => existing.id !== tempId));
      if (localPreviewUrl) {
        try { URL.revokeObjectURL(localPreviewUrl); } catch {}
        objectUrlRegistry.current.delete(localPreviewUrl);
      }
      throw error;
    }
  }


  async function onUploadFiles(event) {
    const chosen = Array.from(event.target.files || []);
    if (!chosen.length) return;
    for (const rawFile of chosen) {
      try {
        await uploadFileRecord(rawFile, currentFolder);
      } catch (error) {
        console.error("Drive file upload failed", error);
      }
    }
    event.target.value = "";
  }
  async function ensureFolderChain(segments) {
    let parentId = currentFolder;
    let nextFolders = folders;
    for (const segment of segments) {
      let existing = nextFolders.find((folder) => (folder.parentId || null) === (parentId || null) && folder.name === segment);
      if (!existing) {
        const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/folders`, {
          method: "POST",
          body: JSON.stringify({ name: segment, parentId }),
        });
        existing = res?.folder || null;
        if (existing) {
          nextFolders = [...nextFolders, existing];
          setFolders(nextFolders);
        }
      }
      parentId = existing?.id || parentId;
    }
    return parentId;
  }
  async function onUploadFolder(event) {
    const chosen = Array.from(event.target.files || []);
    if (!chosen.length) return;
    for (const file of chosen) {
      const rel = String(file.webkitRelativePath || file.name);
      const parts = rel.split("/").filter(Boolean);
      const fileName = parts.pop() || file.name;
      const parentId = parts.length ? await ensureFolderChain(parts) : currentFolder;
      const wrapped = new File([file], fileName, { type: file.type });
      try {
        await uploadFileRecord(wrapped, parentId, rel);
      } catch (error) {
        console.error("Drive folder upload failed", error);
      }
    }
    event.target.value = "";
  }

  async function openLinkedNoteByTitle(rawTitle) {
    const clean = String(rawTitle || "").trim();
    const existingId = noteMap.get(clean.toLowerCase());
    if (existingId) {
      const n = notes.find((x) => x.id === existingId);
      setCurrentFolder(n?.parentId || null);
      selectNote(existingId);
      return;
    }
    if (!window.confirm(`Create note "${clean}"?`)) return;
    await createNoteWithPayload({ title: clean || "untitled", body: "", parentId: currentFolder, tags: [] });
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
  async function saveCurrentAsTemplate() {
    if (!content) return;
    const name = prompt("Template name?", title || "Untitled template");
    if (!name) return;
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/templates`, {
      method: "POST",
      body: JSON.stringify({ name: String(name).trim(), title: title || "untitled", body: content || "" }),
    });
    if (res?.template) {
      setTemplates((prev) => [res.template, ...prev.filter((x) => x.id !== res.template.id)]);
    }
  }
  async function editTemplate(id) {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    const nextName = prompt("Template name", tpl.name || "");
    if (nextName === null) return;
    const nextTitle = prompt("Template note title", tpl.title || "");
    if (nextTitle === null) return;
    const nextBody = prompt("Template body", tpl.body || "");
    if (nextBody === null) return;
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/templates/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: String(nextName).trim(), title: String(nextTitle), body: String(nextBody) }),
    });
    if (res?.template) setTemplates((prev) => prev.map((x) => (x.id === id ? res.template : x)));
  }
  async function applyTemplate(template) {
    if (!template) return;
    const renderedTitle = renderTemplate(template.title || template.name || "untitled", { title });
    const renderedBody = renderTemplate(template.body || "", { title: renderedTitle });
    if (!selectedId || selectedKind !== "note") {
      await createNoteWithPayload({ title: renderedTitle, body: renderedBody, parentId: currentFolder, tags: [] });
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
  async function deleteTemplate(id) {
    await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
  }

  const showEditableDocument = selectedKind === "note" || (selectedKind === "file" && fileIsEditable);
  const showEditor = showEditableDocument && viewMode !== "read";
  const showPreview = showEditableDocument && viewMode !== "edit";
  const workspaceHeight = focusMode ? "100vh" : "calc(100vh - 86px)";
  const createModalActions = [
    { id: "folder", label: "Folder", hint: "Create a new folder in the current location.", icon: "📁", onClick: createFolder },
    { id: "upload-file", label: "Upload files", hint: "Import one or more existing files.", icon: "⤴", onClick: () => { if (fileInputRef.current) fileInputRef.current.value = ""; fileInputRef.current?.click(); } },
    { id: "upload-folder", label: "Upload folder", hint: "Import a whole folder tree.", icon: "🗂", onClick: () => { const input = folderInputRef.current; if (input) { input.value = ""; input.setAttribute("webkitdirectory", "true"); input.setAttribute("directory", "true"); } input?.click(); } },
    { id: "note", label: "Rich note", hint: "Markdown note with templates and backlinks.", icon: "📝", onClick: createNote },
    { id: "sheet", label: "Sheet", hint: "Simple grid document stored directly in Drive.", icon: "📊", onClick: createSpreadsheet },
    { id: "form", label: "Form", hint: "Build an intake form with a live preview.", icon: "☑", onClick: createForm },
  ];

  return (
    <div style={{ position: focusMode ? "fixed" : "relative", inset: focusMode ? 0 : "auto", zIndex: focusMode ? 80 : "auto", background: "#0b0b0b", height: workspaceHeight }}>
      <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={onUploadFiles} />
      <input ref={folderInputRef} type="file" multiple style={{ display: "none" }} onChange={onUploadFolder} />

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
            onNewSpreadsheet={createSpreadsheet}
            onNewForm={createForm}
            onOpenCreatePicker={() => setCreateModalOpen(true)}
            onUploadFile={() => {
              if (fileInputRef.current) fileInputRef.current.value = "";
              fileInputRef.current?.click();
            }}
            onUploadFolder={() => {
              const input = folderInputRef.current;
              if (input) {
                input.value = "";
                input.setAttribute("webkitdirectory", "true");
                input.setAttribute("directory", "true");
              }
              input?.click();
            }}
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

          {loadState === "loading" ? (
            <div className="card" style={{ padding: 18, maxWidth: 560 }}>
              <h2 style={{ marginTop: 0, marginBottom: 10 }}>Drive</h2>
              <div className="helper">Loading org Drive…</div>
            </div>
          ) : loadState === "error" ? (
            <div className="card" style={{ padding: 18, maxWidth: 560 }}>
              <h2 style={{ marginTop: 0, marginBottom: 10 }}>Drive</h2>
              <div className="helper" style={{ marginBottom: 12 }}>{loadError || "Drive failed to load."}</div>
              <button className="btn" type="button" onClick={() => loadDrive({ preserveSelection: false })}>Retry</button>
            </div>
          ) : showEditableDocument ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" style={{ flex: 1, minWidth: 220, fontSize: 20, fontWeight: 800, background: "transparent", border: "none", outline: "none", color: "#fff", padding: "2px 0" }} />
                <span className="helper">{status}</span>
                {selectedFile && !fileIsEditable ? <span className="helper">read only</span> : null}
              </div>

              {!isStructuredDriveDoc ? <RichTextToolbar
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
              /> : null}

              <div id="bf-drive-editor-zone" style={{ display: "grid", gridTemplateColumns: viewMode === "split" ? `${Math.round(splitRatio * 100)}% 6px minmax(0,1fr)` : "minmax(0,1fr)", gap: viewMode === "split" ? 6 : 0, alignItems: "start" }}>
                {showEditor ? (
                  <div style={{ minWidth: 0 }}>
                    {selectedFileSubtype === "sheet" ? (
                      <SpreadsheetFileView value={content} onChange={setContent} mode="edit" />
                    ) : selectedFileSubtype === "form" ? (
                      <FormFileView value={content} onChange={setContent} mode="edit" fileId={selectedFile?.id || ""} orgId={orgId} />
                    ) : (
                      <NoteEditor value={content} onChange={setContent} focusMode={focusMode} editorRef={editorRef} compact />
                    )}
                  </div>
                ) : null}
                {viewMode === "split" ? <div onMouseDown={() => beginResize("split")} style={{ cursor: "col-resize", background: "rgba(255,255,255,0.03)", minHeight: focusMode ? "84vh" : "72vh" }} title="Drag to resize split" /> : null}
                {showPreview ? (
                  <div style={{ minWidth: 0 }}>
                    {selectedFileSubtype === "sheet" ? (
                      <SpreadsheetFileView value={content} mode="preview" />
                    ) : selectedFileSubtype === "form" ? (
                      <FormFileView value={content} onChange={setContent} mode="preview" fileId={selectedFile?.id || ""} orgId={orgId} />
                    ) : selectedKind === "file" && !fileIsMarkdown ? (
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
            <div className="card" style={{ padding: 18, maxWidth: 760 }}>
              <h2 style={{ marginTop: 0, marginBottom: 10 }}>Drive</h2>
              <div className="helper" style={{ marginBottom: 14 }}>
                Select a note or file from the explorer, or create something new from the sidebar.
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>What works here</div>
                  <div className="helper">Notes, folders, uploaded files, markdown editing, templates, backlinks, frontmatter properties, split view, and inspector.</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Storage</div>
                  <div className="helper">Drive content now loads from this org instead of living only in browser localStorage.</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Templates</div>
                  <div className="helper">Templates can create a new note, insert into the current note, and be edited in app.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <DriveCreateModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} actions={createModalActions} />

      {inspectorOpen && selectedNote ? (
        <div style={{ position: "fixed", top: focusMode ? 8 : 94, right: 8, width: 250, maxHeight: focusMode ? "calc(100vh - 16px)" : "calc(100vh - 102px)", overflow: "auto", zIndex: 90 }}>
          <NoteInspector note={selectedNote} backlinks={backlinks} onOpenNote={selectNote} onClose={() => setInspectorOpen(false)} compact />
        </div>
      ) : null}
    </div>
  );
}
