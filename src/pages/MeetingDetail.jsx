// src/pages/Meetings.jsx
import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useStore, addMeeting, updateMeeting } from "../utils/store.js";

// format timestamp helper
function fmtWhen(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

// derive orgId from hash
function getOrgId() {
  try {
    const m = (window.location.hash || "").match(/#\/org\/([^/]+)/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export default function Meetings() {
  const orgId = getOrgId();
  const meetingsAll = useStore((s) => s.meetings || []);

  const meetings = useMemo(() => {
    if (!orgId) return meetingsAll;
    return meetingsAll.some(m => m && Object.prototype.hasOwnProperty.call(m, "org"))
      ? meetingsAll.filter(m => m?.org === orgId)
      : meetingsAll;
  }, [meetingsAll, orgId]);

  function onAdd(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    addMeeting({
      id: crypto.randomUUID(),
      title: f.get("title") || "Untitled Meeting",
      when: Date.parse(f.get("when")) || Date.now(),
      notes: "",
      files: [],
      org: orgId || undefined,
    });
    e.currentTarget.reset();
  }

  return (
    <div className="card" style={{ margin: 16 }}>
      <h2 className="section-title">Meetings</h2>

      <table className="table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Date / Time</th>
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
                <Link className="btn" to={`/org/${orgId}/meeting/${m.id}`}>
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
-A
      <form onSubmit={onAdd} className="grid cols-2" style={{ marginTop: 12 }}>
        <input className="input" name="title" placeholder="Meeting title" required />
        <input className="input" name="when" type="datetime-local" />
        <button className="btn">Add Meeting</button>
      </form>
    </div>
  );
}
