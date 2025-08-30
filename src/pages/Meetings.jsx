// src/pages/MeetingDetail.jsx
import React, { useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useStore, updateMeeting, deleteMeeting } from "../utils/store.js";

function fmtWhen(w) {
  if (!w) return "";
  if (/^\d{4}-\d{2}-\d{2}T/.test(w)) {
    const d = new Date(w);
    return d.toLocaleString();
  }
  return String(w);
}

export default function MeetingDetail() {
  const { orgId, meetingId } = useParams();
  const all = useStore((s)=> s.meetings || []);
  const meeting = useMemo(
    ()=> all.find(m => m.id === meetingId) || null,
    [all, meetingId]
  );

  const fileRef = useRef(null);

  if (!meeting) {
    return (
      <div className="card" style={{ margin: 16 }}>
        <div className="helper">Meeting not found.</div>
        <Link className="btn" to={`/org/${orgId}/meetings`}>Back to Meetings</Link>
      </div>
    );
  }

  async function onAddFiles(e) {
    const files = Array.from(fileRef.current?.files || []);
    if (!files.length) return;
    const newAtts = await Promise.all(
      files.map(async f => ({
        id: crypto.randomUUID(),
        name: f.name, type: f.type, size: f.size,
        dataUrl: await blobToDataURL(f),
      }))
    );
    updateMeeting(meeting.id, { attachments: [...(meeting.attachments||[]), ...newAtts] });
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeAttachment(id) {
    const next = (meeting.attachments || []).filter(a => a.id !== id);
    updateMeeting(meeting.id, { attachments: next });
  }

  return (
    <div className="card" style={{ margin: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link className="btn" to={`/org/${orgId}/meetings`}>← Back</Link>
        <h2 className="section-title" style={{ margin: 0 }}>
          {meeting.title || "(untitled)"} <span className="helper">· {fmtWhen(meeting.when)}</span>
        </h2>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn" onClick={()=>deleteMeeting(meeting.id)}>Delete</button>
        </div>
      </div>

      <div className="grid" style={{ gap: 12, marginTop: 12, gridTemplateColumns: "1fr 1fr" }}>
        {/* Agenda */}
        <section className="card" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Agenda</h3>
          <AutoSaveTextarea
            value={meeting.agenda || ""}
            placeholder="Agenda items…"
            onSave={(v)=>updateMeeting(meeting.id, { agenda: v })}
          />
        </section>

        {/* Minutes */}
        <section className="card" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Minutes</h3>
          <AutoSaveTextarea
            value={meeting.minutes || ""}
            placeholder="Meeting minutes…"
            onSave={(v)=>updateMeeting(meeting.id, { minutes: v })}
          />
        </section>
      </div>

      {/* Attachments */}
      <section className="card" style={{ padding: 12, marginTop: 12 }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Attachments</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(meeting.attachments || []).length ? (
            meeting.attachments.map(a => (
              <div key={a.id} className="card" style={{ padding: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <a href={a.dataUrl} download={a.name} className="btn" style={{ padding: "4px 10px" }}>
                  {a.name}
                </a>
                <button className="btn" onClick={()=>removeAttachment(a.id)}>Remove</button>
              </div>
            ))
          ) : (
            <div className="helper">No files yet.</div>
          )}
        </div>
        <div style={{ marginTop: 10 }}>
          <label className="btn" style={{ cursor: "pointer" }}>
            <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={onAddFiles} />
            Upload file(s)
          </label>
        </div>
      </section>
    </div>
  );
}

function AutoSaveTextarea({ value, onSave, placeholder }) {
  const [val, setVal] = React.useState(value || "");
  React.useEffect(()=>{ setVal(value || ""); }, [value]);

  return (
    <textarea
      className="input"
      value={val}
      onChange={(e)=>setVal(e.target.value)}
      onBlur={()=>{ if (val !== value) onSave(val); }}
      placeholder={placeholder}
      style={{ minHeight: 220, width: "100%" }}
    />
  );
}

function blobToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(file);
  });
}
