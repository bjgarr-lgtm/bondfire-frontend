// src/pages/MeetingDetail.jsx
import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useStore, updateMeeting } from "../utils/store.js";

// tiny helper: convert file -> data URL (kept local so we don't depend on anything else)
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function MeetingDetail() {
  const { orgId, meetingId } = useParams();

  // live meeting from store
  const meeting = useStore(
    (s) => (s.meetings || []).find((m) => m.id === meetingId) || null
  );

  const files = useMemo(() => meeting?.files || [], [meeting]);

  if (!meeting) {
    return (
      <div className="card" style={{ margin: 16 }}>
        <div className="helper">Meeting not found.</div>
        <Link className="btn" to={`/org/${orgId}/meetings`} style={{ marginTop: 8 }}>
          Back to Meetings
        </Link>
      </div>
    );
  }

  async function onUpload(e) {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    const newFiles = [];
    for (const f of selected) {
      const dataUrl = await fileToDataUrl(f);
      newFiles.push({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        mime: f.type || "application/octet-stream",
        dataUrl,
      });
    }

    updateMeeting(meetingId, { files: [...(meeting.files || []), ...newFiles] });
    // clear the file input so the same file can be re-selected if needed
    e.target.value = "";
  }

  function onNotesChange(e) {
    updateMeeting(meetingId, { notes: e.target.value });
  }

  function removeFile(id) {
    const next = (meeting.files || []).filter((f) => f.id !== id);
    updateMeeting(meetingId, { files: next });
  }

  return (
    <div className="grid" style={{ gap: 12, margin: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Link className="btn" to={`/org/${orgId}/meetings`}>← Back</Link>
        <div className="helper">
          {meeting.when ? new Date(meeting.when).toLocaleString() : ""}
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>
          {meeting.title || "(Untitled meeting)"}
        </h2>

        <label className="helper" style={{ display: "block", marginBottom: 6 }}>
          Agenda & Minutes
        </label>
        <textarea
          className="input"
          style={{ minHeight: 220, width: "100%", resize: "vertical" }}
          placeholder="Type agenda, notes, and minutes here…"
          value={meeting.notes || ""}
          onChange={onNotesChange}
        />
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="section-title" style={{ margin: 0 }}>Attachments</h3>
          <label className="btn" style={{ cursor: "pointer" }}>
            Upload file(s)
            <input
              type="file"
              multiple
              onChange={onUpload}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {files.length === 0 ? (
          <div className="helper" style={{ marginTop: 8 }}>No files yet.</div>
        ) : (
          <ul style={{ listStyle: "none", paddingLeft: 0, marginTop: 10 }}>
            {files.map((f) => (
              <li
                key={f.id}
                className="row"
                style={{ justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}
              >
                <div>
                  <strong>{f.name}</strong>{" "}
                  <span className="helper">({Math.round((f.size || 0) / 1024)} KB)</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a className="btn" href={f.dataUrl} download={f.name}>Download</a>
                  <button className="btn" onClick={() => removeFile(f.id)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
