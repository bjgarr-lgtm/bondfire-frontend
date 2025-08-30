import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useStore, updateMeeting } from "../utils/store.js";

export default function MeetingDetail() {
  const { orgId, meetingId } = useParams();
  const meetings = useStore((s) => s.meetings || []);

  const meeting = useMemo(() => meetings.find((m) => m.id === meetingId) || null, [meetings, meetingId]);

  if (!meeting) {
    return (
      <div className="card" style={{ margin: 16 }}>
        <div>Meeting not found.</div>
        <div style={{ marginTop: 8 }}>
          <Link className="btn" to={`/org/${orgId}/meetings`}>Back to Meetings</Link>
        </div>
      </div>
    );
  }

  // helpers
  const setField = (patch) => updateMeeting(meeting.id, patch);

  return (
    <div style={{ padding: 16 }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <h2 className="section-title" style={{ marginBottom: 8 }}>Meeting</h2>

        <div className="grid cols-2" style={{ gap: 8 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="helper">Title</span>
            <input
              className="input"
              defaultValue={meeting.title || ""}
              onBlur={(e) => setField({ title: e.target.value })}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="helper">When</span>
            <input
              className="input"
              defaultValue={meeting.when || ""}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                const d = new Date(raw);
                setField({ when: isNaN(d) ? raw : d.toISOString() });
              }}
            />
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 className="section-title" style={{ marginBottom: 8 }}>Agenda & Minutes</h3>
        <textarea
          className="input"
          style={{ minHeight: 260 }}
          defaultValue={meeting.notes || ""}
          onBlur={(e) => setField({ notes: e.target.value })}
          placeholder="Type agenda and minutes here..."
        />
      </div>

      <div className="card">
        <h3 className="section-title" style={{ marginBottom: 8 }}>Files</h3>
        <input
          type="file"
          multiple
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;

            // light-weight: store small files as data URLs
            const toDataUrl = (file) =>
              new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(r.result);
                r.onerror = rej;
                r.readAsDataURL(file);
              });

            const existing = Array.isArray(meeting.files) ? meeting.files : [];
            const newOnes = await Promise.all(files.map(async (f) => ({
              id: crypto.randomUUID(),
              name: f.name,
              size: f.size,
              mime: f.type,
              dataUrl: await toDataUrl(f),
            })));
            setField({ files: [...existing, ...newOnes] });
            e.target.value = "";
          }}
        />

        <div className="list" style={{ marginTop: 10 }}>
          {Array.isArray(meeting.files) && meeting.files.length ? (
            meeting.files.map((f) => (
              <div key={f.id} className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  {f.name}{" "}
                  <span className="tag">
                    {Math.round((f.size || 0) / 1024)} KB
                  </span>
                </div>
                <a className="btn" href={f.dataUrl} download={f.name}>Download</a>
              </div>
            ))
          ) : (
            <div className="helper">No files yet.</div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <Link className="btn" to={`/org/${orgId}/meetings`}>Back to Meetings</Link>
        </div>
      </div>
    </div>
  );
}
