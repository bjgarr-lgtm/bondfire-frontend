import React, { useEffect, useMemo, useRef, useState } from "react";
import DriveSidebar from "../components/drive/DriveSidebar.jsx";
import DriveList from "../components/drive/DriveList.jsx";
import NoteEditor from "../components/drive/NoteEditor.jsx";
import NotePreview from "../components/drive/NotePreview.jsx";
import Breadcrumbs from "../components/drive/Breadcrumbs.jsx";

const STORAGE_KEY = "bf_drive_v4";

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseTags(body) {
  const matches = [...String(body || "").matchAll(/(^|\s)#([a-zA-Z0-9/_-]+)/gim)];
  return [...new Set(matches.map((m) => String(m[2] || "").trim().toLowerCase()).filter(Boolean))];
}

function parseWikiLinks(body) {
  const matches = [...String(body || "").matchAll(/\[\[(.*?)(\|(.*?))?\]\]/gim)];
  return matches.map((m) => String(m[1] || "").trim()).filter(Boolean);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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

  const [listWidth, setListWidth] = useState(330);
  const [splitRatio, setSplitRatio] = useState(0.5);

  const saveTimer = useRef(null);
  const skipNextSave = useRef(false);
  const resizeMode = useRef(null);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      setFolders(Array.isArray(raw.folders) ? raw.folders : []);
      setNotes(Array.isArray(raw.notes) ? raw.notes : []);
      setListWidth(Number.isFinite(raw.listWidth) ? clamp(raw.listWidth, 260, 480) : 330);
      setSplitRatio(Number.isFinite(raw.splitRatio) ? clamp(raw.splitRatio, 0.3, 0.7) : 0.5);
      setViewMode(["edit", "read", "split"].includes(raw.viewMode) ? raw.viewMode : "split");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ folders, notes, listWidth, splitRatio, viewMode }));
    } catch {}
  }, [folders, notes, listWidth, splitRatio, viewMode]);

  useEffect(() => {
    const onMove = (e) => {
      if (!resizeMode.current) return;
      if (resizeMode.current === "list") {
        setListWidth(clamp(e.clientX - 280, 260, 480));
      }
      if (resizeMode.current === "split") {
        const main = document.getElementById("bf-drive-editor-zone");
        if (!main) return;
        const rect = main.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        setSplitRatio(clamp(ratio, 0.3, 0.7));
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

  function beginResize(which) {
    resizeMode.current = which;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }

  const selectedNote = notes.find((n) => n.id === selectedId) || null;

  const noteMap = useMemo(() => {
    const map = new Map();
    notes.forEach((note) => {
      map.set(String(note.title || "").trim().toLowerCase(), note.id);
    });
    return map;
  }, [notes]);

  const allTags = useMemo(() => {
    const tags = new Set();
    notes.forEach((note) => (note.tags || []).forEach((tag) => tags.add(tag)));
    return [...tags].sort();
  }, [notes]);

  const backlinks = selectedNote
    ? notes.filter(
        (note) =>
          note.id !== selectedNote.id &&
          parseWikiLinks(note.body).some((link) => link.toLowerCase() === String(selectedNote.title || "").toLowerCase())
      )
    : [];

  const visibleNotes = notes
    .filter((note) => (note.parentId || null) === currentFolder)
    .filter((note) => {
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || String(note.title || "").toLowerCase().includes(q) || String(note.body || "").toLowerCase().includes(q);
      const matchesTag = !selectedTag || (note.tags || []).includes(selectedTag);
      return matchesSearch && matchesTag;
    })
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

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
    if (currentFolder === id) setCurrentFolder(parent);
  }

  function createNote() {
    const note = {
      id: newId("note"),
      title: "untitled",
      body: "",
      parentId: currentFolder,
      updatedAt: Date.now(),
      tags: [],
    };
    skipNextSave.current = true;
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
    setTitle(note.title);
    setContent(note.body);
    setStatus("saved");
  }

  function selectNote(id) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    skipNextSave.current = true;
    setSelectedId(id);
    setTitle(note.title || "untitled");
    setContent(note.body || "");
    setStatus("saved");
  }

  function renameNote(id) {
    const note = notes.find((n) => n.id === id);
    const name = prompt("Rename note", note?.title || "");
    if (!name) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title: String(name).trim(), updatedAt: Date.now() } : n)));
    if (selectedId === id) {
      skipNextSave.current = true;
      setTitle(String(name).trim());
      setStatus("saved");
    }
  }

  function deleteNote(id) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedId === id) {
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

  function saveNow() {
    if (!selectedId) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedId
          ? { ...n, title, body: content, tags: parseTags(content), updatedAt: Date.now() }
          : n
      )
    );
    setStatus("saved");
  }

  useEffect(() => {
    if (!selectedId) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNow();
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [selectedId, title, content]);

  function openLinkedNoteByTitle(rawTitle) {
    const cleanTitle = String(rawTitle || "").trim();
    const existingId = noteMap.get(cleanTitle.toLowerCase());
    if (existingId) {
      const existing = notes.find((n) => n.id === existingId);
      setCurrentFolder(existing?.parentId || null);
      selectNote(existingId);
      return;
    }
    if (!window.confirm(`Create note "${cleanTitle}"?`)) return;
    const note = {
      id: newId("note"),
      title: cleanTitle || "untitled",
      body: "",
      parentId: currentFolder,
      updatedAt: Date.now(),
      tags: [],
    };
    skipNextSave.current = true;
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
    setTitle(note.title);
    setContent("");
    setStatus("saved");
  }

  const chromeHeight = 84;
  const outerHeight = focusMode ? "100vh" : `calc(100vh - ${chromeHeight}px)`;

  return (
    <div style={{ position: focusMode ? "fixed" : "relative", inset: focusMode ? 0 : "auto", zIndex: focusMode ? 80 : "auto", background: "#0b0b0b", height: outerHeight }}>
      <div style={{ display: "grid", gridTemplateColumns: focusMode ? `280px ${listWidth}px 8px minmax(0,1fr)` : `280px ${listWidth}px 8px minmax(0,1fr)`, height: "100%" }}>
        <div style={{ borderRight: "1px solid #222", overflow: "auto" }}>
          <DriveSidebar
            folders={folders}
            currentFolder={currentFolder}
            setCurrentFolder={setCurrentFolder}
            onNewFolder={createFolder}
            onRename={renameFolder}
            onDelete={deleteFolder}
            tags={allTags}
            selectedTag={selectedTag}
            setSelectedTag={setSelectedTag}
          />
        </div>

        <div style={{ borderRight: "1px solid #222", overflow: "auto", padding: 12 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button className="btn-red" type="button" onClick={createNote}>+ Note</button>
          </div>
          <input className="input" placeholder="search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
          <DriveList notes={visibleNotes} onSelect={selectNote} onRename={renameNote} onMove={moveNote} onDelete={deleteNote} selectedId={selectedId} />
        </div>

        <div onMouseDown={() => beginResize("list")} style={{ cursor: "col-resize", background: "rgba(255,255,255,0.06)" }} title="Drag to resize" />

        <div style={{ minWidth: 0, overflow: "auto", padding: 18 }}>
          <Breadcrumbs folders={folders} currentFolder={currentFolder} setCurrentFolder={setCurrentFolder} />

          {selectedNote ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Untitled"
                  style={{
                    flex: 1,
                    minWidth: 260,
                    fontSize: 34,
                    fontWeight: 800,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#fff",
                    padding: "4px 0",
                  }}
                />
                <span className="helper">{status}</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto" }}>
                  <button className="btn" type="button" onClick={() => setViewMode("edit")} style={{ fontWeight: viewMode === "edit" ? 800 : 500 }}>Source</button>
                  <button className="btn" type="button" onClick={() => setViewMode("read")} style={{ fontWeight: viewMode === "read" ? 800 : 500 }}>Reading</button>
                  <button className="btn" type="button" onClick={() => setViewMode("split")} style={{ fontWeight: viewMode === "split" ? 800 : 500 }}>Split</button>
                  <button className="btn" type="button" onClick={() => setFocusMode((v) => !v)}>{focusMode ? "Exit Focus" : "Focus"}</button>
                </div>
              </div>

              <div id="bf-drive-editor-zone" style={{ display: "grid", gridTemplateColumns: viewMode === "split" ? `${Math.round(splitRatio * 100)}% 8px minmax(0,1fr)` : "minmax(0,1fr)", gap: viewMode === "split" ? 12 : 0, alignItems: "start" }}>
                {viewMode !== "read" ? (
                  <div style={{ minWidth: 0 }}>
                    <NoteEditor value={content} onChange={setContent} focusMode={focusMode} />
                  </div>
                ) : null}

                {viewMode === "split" ? (
                  <div onMouseDown={() => beginResize("split")} style={{ cursor: "col-resize", background: "rgba(255,255,255,0.06)", minHeight: focusMode ? "84vh" : "72vh" }} title="Drag to resize" />
                ) : null}

                {viewMode !== "edit" ? (
                  <div style={{ minWidth: 0 }}>
                    <NotePreview content={content} onOpenLink={openLinkedNoteByTitle} focusMode={focusMode} />
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #222" }}>
                <h3 style={{ marginTop: 0 }}>Backlinks</h3>
                {backlinks.length ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {backlinks.map((item) => (
                      <button key={item.id} className="btn" type="button" onClick={() => selectNote(item.id)}>
                        {item.title}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="helper">No backlinks yet.</div>
                )}
              </div>
            </>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              <h2 style={{ marginTop: 0 }}>Drive</h2>
              <div className="helper">Create or select a note. Source is markdown input, Reading is rendered output, Split shows both. Focus keeps the explorer available and gives you a cleaner document workspace.</div>
            </div>
          )}
        </div>
      </div>
    </div>
}
