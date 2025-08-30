// src/pages/Meetings.jsx
import React, { useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useStore, addMeeting, updateMeeting } from "../utils/store.js";

function fmtWhen(w) {
  try {
    return new Date(w).toLocaleString();
  } catch {
    return "";
  }
}

export default function Meetings() {
  const { orgId } = useParams();
  const meetingsAll = useStore((s) => s.meetings || []);

  const meetings = useMemo(() => {
    if (!orgId) return meetingsAll;
    return meetingsAll.some((m) => m && Object.prototype.hasOwnProperty.call(m, "org"))
      ? meetingsAll.filter((m) => m?.org === orgId)
      : meetingsAll;
  }, [meetingsAll, orgId]);

  const titleRef = useRef();
  const [when, setWhen] = useState("");

  function onAdd(e) {
    e.preventDefault();
    const t = titleRef.current?.value.trim();
    if (!t) return;
    addMeeting({
      id: crypto.randomUUID(),
      title: t,
      when: when || new Date().toISOString(),
      notes: "",
      files: [],
      org: orgId || undefined,
    });
    e.target.reset();
    setWhen("");
  }

  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <h2 className="section-title">Meetings</h2>

        <table className="table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Title</th>
              <th>When</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {meetings.map((m) => (
              <tr key={m.id}>
                <td>
                  <input
                    className="input"
                    defaultValue={m.title}
                    onBlur={(e) => updateMeeting(m.id, { title: e.target.value })}
                  />
                </td>
                <td>{fmtWhen(m.when)}</td>
                <td>
                  <Link className="btn" to={`/org/${orgId}/meetings/${m.id}`}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {meetings.length === 0 && (
              <tr>
                <td colSpan={3} className="helper">
                  No meetings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form onSubmit={onAdd} className="grid cols-3" style={{ marginTop: 12 }}>
          <input
            className="input"
            placeholder="Meeting title"
            name="title"
            ref={titleRef}
            required
          />
          <input
            className="input"
            type="datetime-local"
            name="when"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
          <button className="btn">Add Meeting</button>
        </form>
      </div>
    </div>
  );
}
