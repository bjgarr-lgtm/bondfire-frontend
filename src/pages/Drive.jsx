import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import DriveSidebar from "../components/drive/DriveSidebar.jsx";
import DriveList from "../components/drive/DriveList.jsx";
import NoteEditor from "../components/drive/NoteEditor.jsx";
import NotePreview from "../components/drive/NotePreview.jsx";
import Breadcrumbs from "../components/drive/Breadcrumbs.jsx";
import { encryptBlob, decryptBlob } from "../lib/driveCrypto.js";

function storageKey(orgId) {
  return `bf_drive_v1_${orgId || "demo"}`;
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseWikiLinks(body) {
  const matches = [...String(body || "").matchAll(/\[\[(.*?)(\|(.*?))?\]\]/gim)];
  return matches.map((m) => String(m[1] || "").trim()).filter(Boolean);
}

export default function Drive() {
  const { orgId } = useParams();
  const [folders, setFolders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [title, setTitle] = useState("untitled");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("saved");
  const [search, setSearch] = useState("");
  const saveTimer = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(orgId));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setFolders(Array.isArray(parsed.folders) ? parsed.folders : []);
      setNotes(Array.isArray(parsed.notes) ? parsed.notes : []);
    } catch {
      setFolders([]);
      setNotes([]);
    }
  }, [orgId]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(orgId), JSON.stringify({ folders, notes }));
    } catch {}
  }, [orgId, folders, notes]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        createNote();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const noteMap = useMemo(() => {
    const m = new Map();
    notes.forEach((note) => m.set(String(note.title || "").trim().toLowerCase(), note.id));
    return m;
  }, [notes]);

  const selectedNote = notes.find((note) => note.id === selectedId) || null;

  const visibleNotes = notes
    .filter((note) => (note.parentId || null) === currentFolder)
    .filter((note) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return String(note.title || "").toLowerCase().includes(q) || String(note.body || "").toLowerCase().includes(q);
    })
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

  const backlinks = selectedNote
    ? notes.filter((note) => note.id !== selectedNote.id && parseWikiLinks(note.body).some((link) => link.toLowerCase() === String(selectedNote.title || "").toLowerCase()))
    : [];

  async function createNote() {
    const blob = await encryptBlob({ title: "untitled", body: "" });
    const note = {
      id: newId("note"),
      title: "untitled",
      body: "",
      blob,
      parentId: currentFolder,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
    setTitle(note.title);
    setContent(note.body);
    setStatus("saved");
  }

  async function selectNote(noteId) {
    const note = notes.find((item) => item.id === noteId);
    if (!note) return;
    const dec = note.blob ? await decryptBlob(note.blob) : { title: note.title, body: note.body };
    setSelectedId(note.id);
    setTitle(dec.title || note.title || "untitled");
    setContent(dec.body || note.body || "");
    setStatus("saved");
  }

  async function saveNow() {
    if (!selectedId) return;
    const blob = await encryptBlob({ title, body: content });
    setNotes((prev) => prev.map((note) => note.id === selectedId ? { ...note, title, body: content, blob, updatedAt: Date.now() } : note));
    setStatus("saved");
  }

  function queueSave() {
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNow();
    }, 700);
  }

  useEffect(() => {
    if (!selectedId) return;
    queueSave();
  }, [title, content]);

  function createFolder() {
    const name = prompt("Folder name?");
    if (!name) return;
    setFolders((prev) => [...prev, { id: newId("folder"), name: String(name).trim(), parentId: currentFolder, createdAt: Date.now(), updatedAt: Date.now() }]);
  }

  function renameFolder(id) {
    const nextName = prompt("New folder name?");
    if (!nextName) return;
    setFolders((prev) => prev.map((folder) => folder.id === id ? { ...folder, name: String(nextName).trim(), updatedAt: Date.now() } : folder));
  }

  function deleteFolder(id) {
    const parent = folders.find((folder) => folder.id === id)?.parentId || null;
    setFolders((prev) => prev.map((folder) => folder.parentId === id ? { ...folder, parentId: parent } : folder).filter((folder) => folder.id !== id));
    setNotes((prev) => prev.map((note) => note.parentId === id ? { ...note, parentId: parent } : note));
    if (currentFolder === id) setCurrentFolder(parent);
  }

  function moveNote(id, newParentId) {
    setNotes((prev) => prev.map((note) => note.id === id ? { ...note, parentId: newParentId, updatedAt: Date.now() } : note));
  }

  function deleteNote(id) {
    setNotes((prev) => prev.filter((note) => note.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setTitle("untitled");
      setContent("");
      setStatus("saved");
    }
  }

  function openLinkedNoteByTitle(linkTitle) {
    const noteId = noteMap.get(String(linkTitle || "").trim().toLowerCase());
    if (!noteId) return;
    const target = notes.find((note) => note.id === noteId);
    if (!target) return;
    setCurrentFolder(target.parentId || null);
    selectNote(noteId);
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ width: 280, borderRight: "1px solid #333" }}>
        <DriveSidebar
          folders={folders}
          currentFolder={currentFolder}
          setCurrentFolder={setCurrentFolder}
          onNewFolder={createFolder}
          onRename={renameFolder}
          onDelete={deleteFolder}
        />
      </div>

      <div style={{ width: 360, borderRight: "1px solid #333", padding: 8, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button className="btn-red" type="button" onClick={createNote}>+ Note</button>
        </div>
        <input className="input" placeholder="Search notes" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 8 }} />
        <DriveList
          notes={visibleNotes}
          folders={folders}
          onSelect={selectNote}
          onMove={moveNote}
          onDelete={deleteNote}
          selectedId={selectedId}
        />
      </div>

      <div style={{ flex: 1, padding: 12, minWidth: 0, overflow: "auto" }}>
        <Breadcrumbs folders={folders} currentFolder={currentFolder} setCurrentFolder={setCurrentFolder} />

        {selectedNote ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} style={{ fontSize: 18, width: "min(100%, 520px)" }} />
              <span className="helper">{status}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <NoteEditor value={content} onChange={setContent} />
              </div>
              <div>
                <NotePreview content={content} onOpenLink={openLinkedNoteByTitle} />
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <h3 style={{ marginBottom: 8 }}>Backlinks</h3>
              {backlinks.length ? backlinks.map((note) => (
                <button key={note.id} className="btn" type="button" style={{ marginRight: 8, marginBottom: 8 }} onClick={() => selectNote(note.id)}>
                  {note.title}
                </button>
              )) : <div className="helper">No backlinks yet.</div>}
            </div>
          </>
        ) : (
          <div className="helper">No note selected. Create one or click a note from the list.</div>
        )}
      </div>
    </div>
  );
}
