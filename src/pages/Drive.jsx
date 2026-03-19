import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import DriveSidebar from "../components/drive/DriveSidebar.jsx";
import DriveList from "../components/drive/DriveList.jsx";
import NoteEditor from "../components/drive/NoteEditor.jsx";
import NotePreview from "../components/drive/NotePreview.jsx";
import Breadcrumbs from "../components/drive/Breadcrumbs.jsx";
import NoteInspector from "../components/drive/NoteInspector.jsx";
import { encryptBlob, decryptBlob } from "../lib/driveCrypto.js";

function storageKey(orgId) {
  return `bf_drive_v2_${orgId || "demo"}`;
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseWikiLinks(body) {
  const matches = [...String(body || "").matchAll(/\[\[(.*?)(\|(.*?))?\]\]/gim)];
  return matches.map((m) => String(m[1] || "").trim()).filter(Boolean);
}

function parseTags(body) {
  const matches = [...String(body || "").matchAll(/(^|\s)#([a-zA-Z0-9/_-]+)/gim)];
  return [...new Set(matches.map((m) => String(m[2] || "").trim().toLowerCase()).filter(Boolean))];
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
  const [selectedTag, setSelectedTag] = useState("");
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

  const selectedNote = notes.find((note) => note.id === selectedId) || null;

  const noteMap = useMemo(() => {
    const m = new Map();
    notes.forEach((note) => m.set(String(note.title || "").trim().toLowerCase(), note.id));
    return m;
  }, [notes]);

  const allTags = useMemo(() => {
    const out = new Set();
    notes.forEach((note) => (note.tags || []).forEach((tag) => out.add(tag)));
    return [...out].sort();
  }, [notes]);

  const visibleNotes = notes
    .filter((note) => (note.parentId || null) === currentFolder)
    .filter((note) => {
      const q = search.trim().toLowerCase();
      const qOk = !q || String(note.title || "").toLowerCase().includes(q) || String(note.body || "").toLowerCase().includes(q);
      const tagOk = !selectedTag || (note.tags || []).includes(selectedTag);
      return qOk && tagOk;
    })
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

  const backlinks = selectedNote
    ? notes.filter((note) => note.id !== selectedNote.id && parseWikiLinks(note.body).some((link) => link.toLowerCase() === String(selectedNote.title || "").toLowerCase()))
    : [];

  async function createNote() {
    const note = {
      id: newId("note"),
      title: "untitled",
      body: "",
      blob: await encryptBlob({ title: "untitled", body: "" }),
      parentId: currentFolder,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      recordLinks: [],
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
    const tags = parseTags(content);
    const blob = await encryptBlob({ title, body: content });
    setNotes((prev) =>
      prev.map((note) =>
        note.id === selectedId
          ? { ...note, title, body: content, blob, tags, updatedAt: Date.now() }
          : note
      )
    );
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
    const parent = folders.find((f) => f.id === id)?.parentId ?? null;
    setFolders((prev) =>
      prev.map((f) => (f.parentId === id ? { ...f, parentId: parent } : f)).filter((f) => f.id !== id)
    );
    setNotes((prev) => prev.map((n) => (n.parentId === id ? { ...n, parentId: parent } : n)));
    if (currentFolder === id) setCurrentFolder(parent);
  }

  function renameNote(id) {
    const note = notes.find((n) => n.id === id);
    const nextTitle = prompt("New note title?", note?.title || "");
    if (!nextTitle) return;
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, title: String(nextTitle).trim(), updatedAt: Date.now() } : n));
    if (selectedId === id) setTitle(String(nextTitle).trim());
  }

  function deleteNote(id) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (id === selectedId) {
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

  function openLinkedNoteByTitle(rawTitle) {
    const targetId = noteMap.get(String(rawTitle || "").trim().toLowerCase());
    if (targetId) {
      selectNote(targetId);
      const target = notes.find((n) => n.id === targetId);
      setCurrentFolder(target?.parentId || null);
      return;
    }
    const shouldCreate = window.confirm(`Create note "${rawTitle}"?`);
    if (!shouldCreate) return;
    const note = {
      id: newId("note"),
      title: String(rawTitle).trim() || "untitled",
      body: "",
      blob: btoa(JSON.stringify({ title: String(rawTitle).trim() || "untitled", body: "" })),
      parentId: currentFolder,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      recordLinks: [],
    };
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
    setTitle(note.title);
    setContent("");
    setStatus("saved");
  }

  function addRecordLink() {
    if (!selectedId) return;
    const targetType = prompt("Record type? (meeting / need / inventory / person / pledge)", "meeting");
    if (!targetType) return;
    const targetId = prompt("Record id?");
    if (!targetId) return;
    const label = prompt("Label?", `${targetType}:${targetId}`) || `${targetType}:${targetId}`;
    setNotes((prev) =>
      prev.map((note) =>
        note.id === selectedId
          ? {
              ...note,
              recordLinks: [...(note.recordLinks || []), { id: newId("link"), targetType: String(targetType).trim(), targetId: String(targetId).trim(), label: String(label).trim() }],
              updatedAt: Date.now(),
            }
          : note
      )
    );
  }

  function removeRecordLink(linkId) {
    if (!selectedId) return;
    setNotes((prev) =>
      prev.map((note) =>
        note.id === selectedId
          ? { ...note, recordLinks: (note.recordLinks || []).filter((link) => link.id !== linkId), updatedAt: Date.now() }
          : note
      )
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ width: 280, borderRight: "1px solid #333", overflow: "auto" }}>
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

      <div style={{ width: 360, borderRight: "1px solid #333", padding: 10, overflow: "auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button className="btn" type="button" onClick={createNote}>+ Note</button>
        </div>
        <input
          className="input"
          placeholder="search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", marginBottom: 10 }}
        />
        <DriveList
          notes={visibleNotes}
          folders={folders}
          onSelect={selectNote}
          onMove={moveNote}
          onDelete={deleteNote}
          onRename={renameNote}
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
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) 300px", gap: 12 }}>
              <div>
                <NoteEditor value={content} onChange={setContent} />
              </div>
              <div>
                <NotePreview content={content} onOpenLink={openLinkedNoteByTitle} />
              </div>
              <div>
                <NoteInspector
                  note={selectedNote}
                  backlinks={backlinks}
                  onOpenNote={selectNote}
                  onAddRecordLink={addRecordLink}
                  onRemoveRecordLink={removeRecordLink}
                />
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
