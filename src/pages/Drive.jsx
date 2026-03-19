import React, { useEffect, useState, useRef } from "react";
import DriveSidebar from "../components/drive/DriveSidebar";
import DriveList from "../components/drive/DriveList";
import NoteEditor from "../components/drive/NoteEditor";
import NotePreview from "../components/drive/NotePreview";
import Breadcrumbs from "../components/drive/Breadcrumbs";
import { encryptBlob, decryptBlob } from "../lib/driveCrypto";

const STORAGE_KEY = "bf_drive_demo";

export default function Drive() {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("untitled");
  const [status, setStatus] = useState("saved");
  const [search, setSearch] = useState("");
  const saveTimer = useRef(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setNotes(Array.isArray(parsed.notes) ? parsed.notes : Array.isArray(parsed) ? parsed : []);
        setFolders(Array.isArray(parsed.folders) ? parsed.folders : []);
      } catch {
        setNotes([]);
        setFolders([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, folders }));
  }, [notes, folders]);

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        createNote();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNote();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const createFolder = () => {
    const name = prompt("Folder name?");
    if (!name) return;
    setFolders((prev) => [
      ...prev,
      { id: Date.now().toString(), name: String(name).trim(), parentId: currentFolder },
    ]);
  };

  const renameFolder = (id) => {
    const nextName = prompt("New name?");
    if (!nextName) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: String(nextName).trim() } : f)));
  };

  const deleteFolder = (id) => {
    const parent = folders.find((f) => f.id === id)?.parentId ?? null;
    setFolders((prev) => prev.map((f) => (f.parentId === id ? { ...f, parentId: parent } : f)).filter((f) => f.id !== id));
    setNotes((prev) => prev.map((n) => (n.parentId === id ? { ...n, parentId: parent } : n)));
    if (currentFolder === id) setCurrentFolder(parent);
  };

  const createNote = async () => {
    const blob = await encryptBlob({ title: "untitled", body: "" });
    const note = {
      id: Date.now().toString(),
      blob,
      updatedAt: Date.now(),
      parentId: currentFolder,
    };
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
    setTitle("untitled");
    setContent("");
  };

  const selectNote = async (note) => {
    const data = await decryptBlob(note.blob);
    setSelectedId(note.id);
    setContent(data.body || "");
    setTitle(data.title || "untitled");
  };

  const deleteNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (id === selectedId) {
      setSelectedId(null);
      setContent("");
      setTitle("untitled");
    }
  };

  const moveNote = (id) => {
    const target = prompt("Move to folderId (blank for root)", currentFolder || "");
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, parentId: target || null } : n)));
  };

  const queueSave = () => {
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveNote, 800);
  };

  const saveNote = async () => {
    if (!selectedId) return;
    const blob = await encryptBlob({ title, body: content });
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== selectedId) return n;
        return { ...n, updatedAt: Date.now(), blob };
      })
    );
    setStatus("saved");
  };

  useEffect(() => {
    if (selectedId) queueSave();
  }, [content, title]);

  const filtered = notes
    .slice()
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .filter((n) => {
      if (n.parentId !== currentFolder) return false;
      try {
        const data = JSON.parse(atob(n.blob));
        const q = search.toLowerCase();
        return data.title.toLowerCase().includes(q) || data.body.toLowerCase().includes(q);
      } catch {
        return true;
      }
    });

  const currentNote = notes.find((n) => n.id === selectedId);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ width: 260, borderRight: "1px solid #333" }}>
        <DriveSidebar
          folders={folders}
          currentFolder={currentFolder}
          setCurrentFolder={setCurrentFolder}
          onNewFolder={createFolder}
          onRename={renameFolder}
          onDelete={deleteFolder}
        />
      </div>

      <div style={{ width: 320, borderRight: "1px solid #333", padding: 8 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button className="btn" type="button" onClick={createNote}>+ Note</button>
        </div>
        <input
          className="input"
          placeholder="search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <DriveList notes={filtered} onSelect={selectNote} onMove={moveNote} onDelete={deleteNote} />
      </div>

      <div style={{ flex: 1, padding: 12, minWidth: 0 }}>
        <Breadcrumbs folders={folders} currentFolder={currentFolder} setCurrentFolder={setCurrentFolder} />

        {currentNote ? (
          <>
            <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} style={{ fontSize: 18, width: "min(100%, 520px)" }} />
              <span className="helper">{status}</span>
            </div>
            <div style={{ display: "flex", gap: 12, minHeight: 0, alignItems: "stretch" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <NoteEditor value={content} onChange={setContent} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <NotePreview content={content} />
              </div>
            </div>
          </>
        ) : (
          <p className="helper">No note selected</p>
        )}
      </div>
    </div>
  );
}
