// src/pages/Meetings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../utils/api.js";

function getOrgId() {
  try {
    const m = (window.location.hash || "").match(/#\/org\/([^/]+)/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function toInputDT(ms) {
  if (!ms) return "";
  const d = new Date(Number(ms));
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromInputDT(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function CalendarIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function DateTimeField({ name, defaultValue, onBlur }) {
  const ref = React.useRef(null);

  const openPicker = () => {
    const el = ref.current;
    if (!el) return;

    if (typeof el.showPicker === "function") {
      el.showPicker();
      return;
    }

    el.focus();
    el.click();
  };

  return (
    <div className="dt-wrap">
      <input
        ref={ref}
        className="input dt-input"
        type="datetime-local"
        name={name}
        defaultValue={defaultValue}
        onBlur={onBlur}
      />
      <button
        type="button"
        className="dt-btn"
        onClick={openPicker}
        aria-label="Pick date and time"
        title="Pick date and time"
      >
        <CalendarIcon />
      </button>
    </div>
  );
}

export default function Meetings() {
  const orgId = getOrgId();

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings`);
      setItems(Array.isArray(data.meetings) ? data.meetings : []);
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return items.filter((m) =>
      `${m.title || ""} ${m.location || ""} ${m.agenda || ""}`
        .toLowerCase()
        .includes(needle)
    );
  }, [items, q]);

  async function putMeeting(id, patch) {
    if (!orgId || !id) return;
    await api(
      `/api/orgs/${encodeURIComponent(orgId)}/meetings/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      }
    );
    refresh().catch(console.error);
  }

  async function delMeeting(id) {
    if (!orgId || !id) return;
    await api(
      `/api/orgs/${encodeURIComponent(orgId)}/meetings/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    refresh().catch(console.error);
  }

  async function onAdd(e) {
    e.preventDefault();
    if (!orgId) return;

    const f = new FormData(e.currentTarget);

    const title = String(f.get("title") || "").trim();
    if (!title) return;

    const starts_at = fromInputDT(String(f.get("starts_at") || ""));
    const ends_at = fromInputDT(String(f.get("ends_at") || ""));
    const location = String(f.get("location") || "").trim();
    const agenda = String(f.get("agenda") || "").trim();

    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, starts_at, ends_at, location, agenda }),
    });

    if (res?.id) {
      setItems((prev) => [
        { id: res.id, title, starts_at, ends_at, location, agenda },
        ...prev,
      ]);
    }

    e.currentTarget.reset();

    setTimeout(() => {
      refresh().catch(console.error);
    }, 500);
  }

  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
            Meetings
          </h2>
          <button
            className="btn"
            onClick={() => refresh().catch(console.error)}
            disabled={loading}
          >
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>

        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search meetings"
          style={{ marginTop: 12 }}
        />

        {err && (
          <div className="helper" style={{ color: "tomato", marginTop: 10 }}>
            {err}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <table className="table" style={{ width: "100%", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: "28%" }}>Title</th>
                <th style={{ width: "18%" }}>Starts</th>
                <th style={{ width: "18%" }}>Ends</th>
                <th style={{ width: "24%" }}>Location</th>
                <th style={{ width: "12%" }} />
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id}>
                  <td>
                    <input
                      className="input"
                      defaultValue={m.title || ""}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (m.title || "")) {
                          putMeeting(m.id, { title: v }).catch(console.error);
                        }
                      }}
                    />
                    <div className="helper" style={{ marginTop: 6 }}>
                      <Link
                        to={`/org/${encodeURIComponent(orgId)}/meetings/${encodeURIComponent(
                          m.id
                        )}`}
                      >
                        Open
                      </Link>
                    </div>
                  </td>

                  <td>
                    <DateTimeField
                      defaultValue={toInputDT(m.starts_at)}
                      onBlur={(e) => {
                        const ms = fromInputDT(e.target.value);
                        if ((ms ?? null) !== (m.starts_at ?? null)) {
                          putMeeting(m.id, { starts_at: ms }).catch(console.error);
                        }
                      }}
                    />
                  </td>

                  <td>
                    <DateTimeField
                      defaultValue={toInputDT(m.ends_at)}
                      onBlur={(e) => {
                        const ms = fromInputDT(e.target.value);
                        if ((ms ?? null) !== (m.ends_at ?? null)) {
                          putMeeting(m.id, { ends_at: ms }).catch(console.error);
                        }
                      }}
                    />
                  </td>

                  <td>
                    <input
                      className="input"
                      defaultValue={m.location || ""}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (m.location || "")) {
                          putMeeting(m.id, { location: v }).catch(console.error);
                        }
                      }}
                    />
                  </td>

                  <td>
                    <button
                      className="btn"
                      onClick={() => delMeeting(m.id).catch(console.error)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="helper">
                    No meetings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={onAdd} className="grid" style={{ gap: 10, marginTop: 12 }}>
          <input className="input" name="title" placeholder="Title" required />

          <DateTimeField name="starts_at" defaultValue="" />
          <DateTimeField name="ends_at" defaultValue="" />

          <input className="input" name="location" placeholder="Location" />
          <input className="input" name="agenda" placeholder="Agenda (short)" />
          <button className="btn">Add Meeting</button>
        </form>
      </div>
    </div>
  );
}
