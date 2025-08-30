import React, { useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useStore, addMeeting, updateMeeting, removeMeeting } from "../utils/store.js";

// simple date display
function fmtWhen(w) {
  if (!w) return "";
  const d = new Date(w);
  return isNaN(d) ? String(w) : d.toLocaleString();
}

// derive orgId from route param (HashRouter-safe)
function useOrgId() {
  const { orgId } = useParams();
  return orgId || null;
}

export default function Meetings() {
  const orgId = useOrgId();
  const meetingsAll = useStore((s) => s.meetings || []);
  const titleRef = useRef(null);
  const whenRef = useRef(null);

  // scope to org when objects carry an org field
  const meetings = useMemo(() => {
    if (!orgId) return meetingsAll;
    return meetingsAll.some(m => Object.prototype.hasOwnProperty.call(m, "org"))
      ? meetingsAll.filter(m => m?.org === orgId)
      : meetingsAll;
  }, [meetingsAll, orgId]);

  function onAdd(e) {
    e.preventDefault();
    const title = titleRef.current?.value?.trim();
    const whenRaw = whenRef.current?.value?.trim();
    if (!title) return;

    // try to parse "when" as date; fall back to raw string
    let when = whenRaw;
    const maybe = new Date(whenRaw);
    if (!isNaN(maybe)) when = maybe.toISOString();

    addMeeting({
      id: crypto.randomUUID(),
      title,
      when,
      notes: "",
      files: [],
      org: orgId || undefined,
      created: Date.now(),
    });

    titleRef.current.value = "";
    whenRef.current.value = "";
  }

  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <h2 className="section-title">Meetings</h2>

        {/* Add bar */}
        <form onSubmit={onAdd} className="grid cols-3" style={{ gap: 8, marginBottom: 12 }}>
          <input ref={titleRef} className="input" placeholder="Title" />
          <input ref={whenRef} className="input" placeholder="When (e.g. 2025-09-18 6pm)" />
          <button className="btn">Add Meeting</button>
        </form>

        {/* Table */}
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Title</th>
              <th style={{ width: "40%" }}>When</th>
              <th style={{ width: "20%" }} />
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
                <td>
                  <input
                    className="input"
                    defaultValue={fmtWhen(m.when)}
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const d = new Date(raw);
                      updateMeeting(m.id, { when: isNaN(d) ? raw : d.toISOString() });
                    }}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link className="btn" to={`/org/${orgId}/meetings/${m.id}`}>Open</Link>
                  <button className="btn" style={{ marginLeft: 8 }} onClick={() => removeMeeting(m.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {meetings.length === 0 && (
              <tr><td colSpan={3} className="helper">No meetings yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
