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
import { renderTemplate } from "../components/drive/templateEngine.js";

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
  return String(file?.mime || "").startsWith("text/") || ["md", "markdown", "txt", "json", "js", "jsx", "ts", "tsx", "css", "html", "yml", "yaml", "xml", "csv"].includes(ext);
}
function canPreviewFileInApp(file) {
  const mime = String(file?.mime || "");
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
function normalizeTemplateName(name) {
  return String(name || "").trim().toLowerCase();
}
function normalizeHeadingKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function parseMarkdownSections(body) {
  const sections = {};
  let current = "";
  const lines = String(body || "").split("\n");
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      current = normalizeHeadingKey(heading[1]);
      if (!sections[current]) sections[current] = [];
      continue;
    }
    if (!current) continue;
    sections[current].push(line);
  }
  return Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, value.join("\n").trim()]));
}
function getPropertyValue(properties, key) {
  const found = (properties || []).find((entry) => String(entry?.key || "").trim().toLowerCase() === String(key || "").trim().toLowerCase());
  return found ? String(found.value || "").trim() : "";
}
function upsertProperty(properties, key, value) {
  const next = Array.isArray(properties) ? [...properties] : [];
  const idx = next.findIndex((entry) => String(entry?.key || "").trim().toLowerCase() === String(key || "").trim().toLowerCase());
  const item = { key: String(key || "").trim(), value: String(value || "").trim() };
  if (idx === -1) next.push(item);
  else next[idx] = item;
  return next;
}
function stripListMarker(line) {
  return String(line || "").replace(/^\s*[-*+]\s*(\[[xX ]\]\s*)?/, "").trim();
}
function getSectionChecklistValue(sectionText) {
  const lines = String(sectionText || "").split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^[-*+]\s*\[([ xX])\]\s*(.+)$/);
    if (match && String(match[1]).toLowerCase() === "x") return String(match[2] || "").trim();
  }
  return "";
}
function getSectionPlainText(sectionText) {
  const lines = String(sectionText || "").split("\n").map((line) => stripListMarker(line)).filter(Boolean);
  return lines.join("\n").trim();
}
function getSectionList(sectionText) {
  return String(sectionText || "").split("\n").map((line) => stripListMarker(line)).filter(Boolean);
}
function parseQuantityText(value) {
  const raw = String(value || "").trim();
  if (!raw) return { qty: 0, unit: "" };
  const match = raw.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { qty: 0, unit: raw };
  return { qty: Number(match[1] || 0) || 0, unit: String(match[2] || "").trim() };
}
function buildNeedDescription(title, sections) {
  const parts = [];
  const requester = getSectionList(sections.requester || "");
  if (requester.length) parts.push(`Requester:
${requester.join("\n")}`);
  const need = getSectionPlainText(sections.need || "");
  if (need) parts.push(`Need:
${need}`);
  const category = getSectionChecklistValue(sections.category || "") || getSectionPlainText(sections.category || "");
  if (category) parts.push(`Category: ${category}`);
  const notes = getSectionPlainText(sections.notes || "");
  if (notes) parts.push(`Notes:
${notes}`);
  if (!parts.length) parts.push(title);
  return parts.join("\n\n").trim();
}
function buildMeetingPayload(noteTitle, sections) {
  const agendaSource = sections.agenda || sections.topics || "";
  const agenda = getSectionList(agendaSource).join("\n").trim();
  const notesChunks = [];
  [
    ["attendees", sections.attendees],
    ["discussion", sections.discussion],
    ["decisions", sections.decisions],
    ["action items", sections["action items"]],
    ["next meeting", sections["next meeting"]],
    ["time allocations", sections["time allocations"]],
    ["facilitator", sections.facilitator],
    ["notes", sections.notes],
  ].forEach(([label, value]) => {
    const text = getSectionPlainText(value || "");
    if (text) notesChunks.push(`${label}:\n${text}`);
  });
  return {
    title: noteTitle,
    agenda,
    notes: notesChunks.join("\n\n").trim(),
  };
}
function buildInventoryPayload(noteTitle, sections) {
  const itemName = getSectionPlainText(sections.item || "") || noteTitle;
  const quantity = parseQuantityText(getSectionPlainText(sections.quantity || ""));
  const notesBits = [];
  const condition = getSectionPlainText(sections.condition || "");
  if (condition) notesBits.push(`Condition: ${condition}`);
  const availability = getSectionChecklistValue(sections.availability || "") || getSectionPlainText(sections.availability || "");
  if (availability) notesBits.push(`Availability: ${availability}`);
  const notes = getSectionPlainText(sections.notes || "");
  if (notes) notesBits.push(notes);
  return {
    name: itemName,
    qty: quantity.qty,
    unit: quantity.unit,
    location: getSectionPlainText(sections.location || ""),
    notes: notesBits.join("\n\n").trim(),
  };
}
function extractStructuredSyncPayload(noteTitle, rawContent) {
  const parsed = parseFrontmatter(rawContent);
  const properties = parsed.properties || [];
  const sections = parseMarkdownSections(parsed.body || "");
  const syncRecord = getPropertyValue(properties, "sync_record") || getPropertyValue(properties, "record_type");
  const noteType = getPropertyValue(properties, "type");
  const recordId = getPropertyValue(properties, "record_id");
  const normalizedType = normalizeHeadingKey(syncRecord || noteType).replace(/ /g, "-");
  if (["need", "need-intake"].includes(normalizedType)) {
    return {
      endpoint: "needs",
      recordType: "need",
      recordId,
      payload: {
        title: noteTitle,
        description: buildNeedDescription(noteTitle, sections),
        urgency: getSectionChecklistValue(sections.urgency || "") || getPropertyValue(properties, "urgency") || "",
        status: getPropertyValue(properties, "status") || "open",
      },
      parsed,
    };
  }
  if (["inventory", "resource-item"].includes(normalizedType)) {
    return {
      endpoint: "inventory",
      recordType: "inventory",
      recordId,
      payload: buildInventoryPayload(noteTitle, sections),
      parsed,
    };
  }
  if (["meeting", "meeting-notes", "meeting-agenda"].includes(normalizedType)) {
    return {
      endpoint: "meetings",
      recordType: "meeting",
      recordId,
      payload: buildMeetingPayload(noteTitle, sections),
      parsed,
    };
  }
  return null;
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

## notes

<% tp.date.now("HH:mm") %> — 
`,
  },
  {
    id: "tpl_timestamp",
    name: "timestamp block",
    title: "timestamp",
    body: `<% tp.date.now("HH:mm") %> — `,
  },
  {
    id: "tpl_meeting_notes",
    name: "meeting notes",
    title: 'meeting — <% tp.date.now("YYYY-MM-DD") %>',
    body: `---
type: meeting-notes
sync_record: meeting
---

# <% tp.file.title %>

## attendees
-

## agenda
- [ ] topic

## discussion
-

## decisions
- [ ] 

## action items
- [ ] task — owner

## next meeting
-
`,
  },
  {
    id: "tpl_meeting_agenda",
    name: "meeting agenda",
    title: 'agenda — <% tp.date.now("YYYY-MM-DD") %>',
    body: `---
type: meeting-agenda
sync_record: meeting
---

# <% tp.file.title %>

## topics
- [ ] topic

## time allocations
- topic — time

## facilitator
-

## notes
-
`,
  },
  {
    id: "tpl_need_intake",
    name: "need intake",
    title: 'need intake — <% tp.date.now("YYYY-MM-DD") %>',
    body: `---
type: need-intake
sync_record: need
status: open
---

# <% tp.file.title %>

## requester
- name:
- contact:

## need
-

## urgency
- [ ] low
- [ ] medium
- [ ] high
- [ ] critical

## category
- [ ] food
- [ ] housing
- [ ] medical
- [ ] transport
- [ ] other:

## notes
-
`,
  },
  {
    id: "tpl_resource_item",
    name: "resource / inventory item",
    title: 'resource — <% tp.date.now("YYYY-MM-DD") %>',
    body: `---
type: resource-item
sync_record: inventory
status: available
---

# <% tp.file.title %>

## item
-

## quantity
-

## location
-

## condition
-

## availability
- [ ] available
- [ ] reserved
- [ ] in use
- [ ] unavailable

## notes
-
`,
  },
  {
    id: "tpl_distribution_log",
    name: "distribution log",
    title: 'distribution — <% tp.date.now("YYYY-MM-DD") %>',
    body: `---
type: distribution-log
---

# <% tp.file.title %>

## items distributed
- item — quantity

## recipients
-

## handled by
-

## location
-

## notes
-
`,
  },
  {
    id: "tpl_volunteer_shift",
    name: "volunteer shift log",
    title: 'volunteer shift — <% tp.date.now("YYYY-MM-DD") %>',
    body: `---
type: volunteer-shift
---

# <% tp.file.title %>

## volunteers
-

## roles
- name — role

## hours
-

## tasks completed
- [ ] 

## issues
-

## notes
-
`,
  },
  {
    id: "tpl_incident_log",
    name: "incident log",
    title: 'incident — <% tp.date.now("YYYY-MM-DD") %>',
    body: `---
type: incident-log
---

# <% tp.file.title %>

## what happened
-

## where
-

## who was involved
-

## impact
-

## response taken
-

## follow up
- [ ] 
`,
  },
  {
    id: "tpl_project_initiative",
    name: "project / initiative",
    title: 'project — <% tp.date.now("YYYY-MM-DD") %>',
    body: `---
type: project-initiative
---

# <% tp.file.title %>

## goal
-

## scope
-

## team
-

## current status
-

## tasks
- [ ] 

## blockers
-

## notes
-
`,
  },
  {
    id: "tpl_supply_run",
    name: "supply run",
    title: 'supply run — <% tp.date.now("YYYY-MM-DD") %>',
    body: `---
type: supply-run
---

# <% tp.file.title %>

## purchased items
- item — quantity — cost

## total cost
-

## purchased by
-

## destination
-

## notes
-
`,
  },
];
const TEMPLATE_REMOVALS = new Set(["weekly check-in"]);

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

  const saveTimer = useRef(null);
  const skipNextSave = useRef(false);
  const resizeMode = useRef(null);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const objectUrlRegistry = useRef(new Set());
  const templateSyncState = useRef({ running: false, done: false });
  const structuredSyncState = useRef(new Map());

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
      const nextFolders = Array.isArray(data?.folders) ? data.folders : [];
      const nextNotes = Array.isArray(data?.notes) ? data.notes : [];
      const nextFiles = (Array.isArray(data?.files) ? data.files : []).map((file) => withFileUrls(orgId, file));
      const nextTemplates = Array.isArray(data?.templates) && data.templates.length ? data.templates : STARTER_TEMPLATES;
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
    templateSyncState.current = { running: false, done: false };
  }, [orgId]);

  useEffect(() => {
    if (!orgId || loadState !== "ready" || templateSyncState.current.done || templateSyncState.current.running) return;
    templateSyncState.current.running = true;
    (async () => {
      try {
        const currentTemplates = Array.isArray(templates) ? templates : [];
        const byName = new Map(currentTemplates.map((template) => [normalizeTemplateName(template.name), template]));
        for (const template of currentTemplates) {
          if (!TEMPLATE_REMOVALS.has(normalizeTemplateName(template.name))) continue;
          await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/templates/${encodeURIComponent(template.id)}`, { method: "DELETE" });
        }
        for (const template of STARTER_TEMPLATES) {
          const existing = byName.get(normalizeTemplateName(template.name));
          if (!existing) {
            await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/templates`, {
              method: "POST",
              body: JSON.stringify({ name: template.name, title: template.title, body: template.body }),
            });
            continue;
          }
          if (String(existing.title || "") !== String(template.title || "") || String(existing.body || "") !== String(template.body || "")) {
            await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/templates/${encodeURIComponent(existing.id)}`, {
              method: "PATCH",
              body: JSON.stringify({ name: template.name, title: template.title, body: template.body }),
            });
          }
        }
        await loadDrive({ preserveSelection: true });
      } catch (e) {
        console.error("template sync failed", e);
      } finally {
        templateSyncState.current.running = false;
        templateSyncState.current.done = true;
      }
    })();
  }, [orgId, loadState, templates]);

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

  async function createFolder() {
    const name = prompt("Folder name?");
    if (!name) return;
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/folders`, {
      method: "POST",
      body: JSON.stringify({ name: String(name).trim(), parentId: currentFolder }),
    });
    const folder = res?.folder;
    if (!folder) return;
    setFolders((prev) => [...prev, folder]);
    setCurrentFolder(folder.id);
  }
  async function renameFolder(id) {
    const folder = folders.find((f) => f.id === id);
    const name = prompt("Rename folder", folder?.name || "");
    if (!name) return;
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/folders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: String(name).trim() }),
    });
    if (!res?.folder) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? res.folder : f)));
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
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const note = res?.note;
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
    if (!res?.note) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? res.note : n)));
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
    if (!res?.note) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? res.note : n)));
  }

  async function renameFile(id) {
    const file = files.find((f) => f.id === id);
    const name = prompt("Rename file", file?.name || "");
    if (!name) return;
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: String(name).trim() }),
    });
    if (!res?.file) return;
    setFiles((prev) => prev.map((f) => (f.id === id ? withFileUrls(orgId, { ...f, ...res.file }) : f)));
    if (selectedId === id && selectedKind === "file") {
      skipNextSave.current = true;
      setTitle(res.file.name || "untitled");
      setContent(res.file.textContent || content);
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
    if (!res?.file) return;
    setFiles((prev) => prev.map((f) => (f.id === id ? withFileUrls(orgId, { ...f, ...res.file }) : f)));
  }

  async function hydrateFile(fileId) {
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(fileId)}`);
    const hydrated = res?.file || null;
    if (!hydrated) return null;
    setFiles((prev) => prev.map((f) => (f.id === fileId ? withFileUrls(orgId, { ...f, ...hydrated }) : f)));
    return hydrated;
  }

  function openFileInBrowser(file) {
    if (file?.dataUrl) {
      const a = document.createElement("a");
      a.href = file.dataUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
      return;
    }
    window.open(file?.previewUrl || `/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(file.id)}/download`, "_blank", "noopener,noreferrer");
  }
  async function openFile(file) {
    let nextFile = withFileUrls(orgId, file);
    if (!nextFile) return;
    if (isEditableTextFile(nextFile) && !nextFile.textContent && !nextFile.dataUrl) {
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
  function downloadFile(file) {
    const a = document.createElement("a");
    a.href = file?.downloadUrl || `/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(file.id)}/download?download=1`;
    a.download = file.name || "download";
    a.click();
  }

  async function syncStructuredRecord(noteId, noteTitle, noteContent) {
    const sync = extractStructuredSyncPayload(noteTitle, noteContent);
    if (!sync) return { nextContent: noteContent, synced: false };

    const syncKey = JSON.stringify({ endpoint: sync.endpoint, recordId: sync.recordId || "", payload: sync.payload });
    const lastKey = structuredSyncState.current.get(noteId);
    if (lastKey === syncKey) return { nextContent: noteContent, synced: false };

    const method = sync.recordId ? "PUT" : "POST";
    const body = method === "PUT" ? { id: sync.recordId, ...sync.payload } : sync.payload;
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/${sync.endpoint}`, {
      method,
      body: JSON.stringify(body),
    });

    const nextRecordId = sync.recordId || String(res?.id || res?.item?.id || "").trim();
    structuredSyncState.current.set(noteId, JSON.stringify({ endpoint: sync.endpoint, recordId: nextRecordId, payload: sync.payload }));

    if (nextRecordId && nextRecordId !== sync.recordId) {
      const nextProperties = upsertProperty(upsertProperty(sync.parsed.properties || [], "record_type", sync.recordType), "record_id", nextRecordId);
      return { nextContent: serializeFrontmatter(nextProperties, sync.parsed.body || ""), synced: true };
    }
    return { nextContent: noteContent, synced: true };
  }

  async function saveNow() {
    if (!selectedId) return;
    try {
      if (selectedKind === "note") {
        const parsed = parseFrontmatter(content);
        const propertyTags = parsed.properties.find((p) => p.key.toLowerCase() === "tags")?.value || "";
        const combinedTags = [...new Set([...parseTags(parsed.body), ...String(propertyTags).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)])];
        let nextBody = content;
        let res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes/${encodeURIComponent(selectedId)}`, {
          method: "PATCH",
          body: JSON.stringify({ title, body: nextBody, tags: combinedTags }),
        });
        const syncResult = await syncStructuredRecord(selectedId, title, nextBody);
        if (syncResult?.nextContent && syncResult.nextContent !== nextBody) {
          nextBody = syncResult.nextContent;
          const nextParsed = parseFrontmatter(nextBody);
          const nextPropertyTags = nextParsed.properties.find((p) => p.key.toLowerCase() === "tags")?.value || "";
          const nextCombinedTags = [...new Set([...parseTags(nextParsed.body), ...String(nextPropertyTags).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)])];
          res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes/${encodeURIComponent(selectedId)}`, {
            method: "PATCH",
            body: JSON.stringify({ title, body: nextBody, tags: nextCombinedTags }),
          });
          skipNextSave.current = true;
          setContent(nextBody);
        }
        if (res?.note) {
          setNotes((prev) => prev.map((n) => (n.id === selectedId ? { ...res.note, body: nextBody } : n)));
        }
        setStatus("saved");
        return;
      }
      if (selectedKind === "file" && fileIsEditable) {
        const mime = selectedFile?.mime || (fileIsMarkdown ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8");
        const dataUrl = textToDataUrl(content, mime);
        const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(selectedId)}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: title,
            mime,
            size: new Blob([content], { type: mime }).size,
            dataUrl,
            textContent: content,
          }),
        });
        if (res?.file) {
          setFiles((prev) => prev.map((file) => (file.id === selectedId ? withFileUrls(orgId, { ...file, ...res.file }) : file)));
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
    });
    setFiles((prev) => [optimisticFile, ...prev.filter((existing) => existing.id !== tempId)]);

    try {
      const headers = {
        "x-drive-name": record.name || rawFile.name || "file",
        "x-drive-mime": record.mime || rawFile.type || "application/octet-stream",
      };
      if (parentId) headers["x-drive-parent-id"] = String(parentId);
      if (relativePath) headers["x-drive-relative-path"] = String(relativePath);

      let res;
      try {
        res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files`, {
          method: "POST",
          headers,
          body: rawFile,
        });
      } catch {
        const form = new FormData();
        form.append("file", rawFile, rawFile.name || record.name || "file");
        form.append("name", record.name || rawFile.name || "file");
        form.append("mime", record.mime || rawFile.type || "application/octet-stream");
        if (parentId) form.append("parentId", String(parentId));
        if (relativePath) form.append("relativePath", String(relativePath));
        res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files`, {
          method: "POST",
          body: form,
        });
      }

      const createdFile = res?.file || (res?.id ? { id: res.id } : null);
      if (!createdFile?.id) throw new Error("UPLOAD_FAILED");

      const nextFile = withFileUrls(orgId, {
        ...record,
        ...createdFile,
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

      {inspectorOpen && selectedNote ? (
        <div style={{ position: "fixed", top: focusMode ? 8 : 94, right: 8, width: 250, maxHeight: focusMode ? "calc(100vh - 16px)" : "calc(100vh - 102px)", overflow: "auto", zIndex: 90 }}>
          <NoteInspector note={selectedNote} backlinks={backlinks} onOpenNote={selectNote} onClose={() => setInspectorOpen(false)} compact />
        </div>
      ) : null}
    </div>
  );
}
