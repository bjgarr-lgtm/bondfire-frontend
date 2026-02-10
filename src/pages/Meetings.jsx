// src/pages/Meetings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../utils/api.js";

function getOrgId() {
  try {
    const m = (window.location.hash || "").match(/#\/org\/([^/]+)/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function fromInputDT(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function formatDT(ms) {
  if (!ms) return "";
  const d = new Date(Number(ms));
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function DateTimeField({ name, value, onChange }) {
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
        value={value}
        onChange={onChange}
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

  // Controlled add form so it clears reliably
  const [form, setForm] = useState({
    title: "",
    starts_at: "",
    ends_at: "",
    location: "",
    agenda: "",
    is_public: false,
  });

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
  }, [orgId]);

  const filtered = useMemo(() => {
    const needle = String(q || "").toLowerCase();

    return (items || []).map((m) => {
      const starts = m?.starts_at ? Number(m.starts_at) : null;

      return {
        ...m,
        // What your table renders
        date: starts ? new Date(starts).toLocaleDateString() : "",
        time: (() => {
          const s = m?.starts_at ? Number(m.starts_at) : null;
          const e = m?.ends_at ? Number(m.ends_at) : null;

          const fmt = (ms) =>
            new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

          if (s && e) return `${fmt(s)}–${fmt(e)}`;
          if (s) return fmt(s);
          return "";
        })(),

        notes: m?.agenda || "",
      };
    }).filter((m) =>
      `${m.title || ""} ${m.location || ""} ${m.agenda || ""}`
        .toLowerCase()
        .includes(needle)
    );
  }, [items, q]);


  async function delMeeting(id) {
    if (!orgId || !id) return;
    await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    refresh().catch(console.error);
  }

  async function togglePublic(meetingId, checked) {
    if (!orgId || !meetingId) return;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, is_public: checked ? 1 : 0 } : m))
    );

    try {
      await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: meetingId, is_public: checked }),
      });
    } catch (e) {
      console.error(e);
      refresh().catch(console.error);
    }
  }

  async function onAdd(e) {
    e.preventDefault();
    if (!orgId) return;

    setErr("");

    const title = String(form.title || "").trim();
    if (!title) return;

    const starts_at = fromInputDT(form.starts_at);
    const ends_at = fromInputDT(form.ends_at);
    const location = String(form.location || "").trim();
    const agenda = String(form.agenda || "").trim();
    const is_public = !!form.is_public;

    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, starts_at, ends_at, location, agenda, is_public }),
    });

    if (res?.id) {
      setItems((prev) => [
        { id: res.id, title, starts_at, ends_at, location, agenda, is_public: is_public ? 1 : 0 },
        ...prev,
      ]);
    }

    // Clear add form immediately
    setForm({ title: "", starts_at: "", ends_at: "", location: "", agenda: "", is_public: false });

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
          <button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>
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

        
{/* Read only list */}
<div className="bf-table-desktop" style={{ marginTop: 12, overflowX: "auto", paddingRight: 16 }}>
  <table className="table" style={{ minWidth: 940, tableLayout: "fixed" }}>
    <thead>
      <tr>
        <th style={{ width: 220 }}>Title</th>
        <th style={{ width: 140 }}>Date</th>
        <th style={{ width: 120 }}>Time</th>
        <th>Notes</th>
        <th style={{ width: 90 }} />
      </tr>
    </thead>
    <tbody>
      {filtered.map((m) => (
        <tr key={m.id}>
          <td>{m.title || ""}</td>
          <td>{m.date || ""}</td>
          <td>{m.time || ""}</td>
          <td style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>{m.notes || ""}</td>
          <td>
            <button className="btn" onClick={() => delMeeting(m.id)} style={{ padding: "6px 10px" }}>
              Delete
            </button>
          </td>
        </tr>
      ))}
      {filtered.length === 0 && (
        <tr>
          <td colSpan={5} style={{ opacity: 0.7 }}>
            No meetings yet.
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>

{/* Mobile cards */}
<div className="bf-cards-mobile" style={{ marginTop: 12 }}>
  {filtered.map((m) => (
    <div key={m.id} className="bf-rowcard">
      <div className="bf-rowcard-top">
        <div className="bf-rowcard-title">{m.title || "Untitled meeting"}</div>
        <button className="btn" onClick={() => delMeeting(m.id)} style={{ padding: "8px 10px" }}>
          Delete
        </button>
      </div>

      <div className="bf-two">
        <div className="bf-field">
          <div className="bf-field-label">date</div>
          <div>{m.date || " "}</div>
        </div>
        <div className="bf-field">
          <div className="bf-field-label">time</div>
          <div>{m.time || " "}</div>
        </div>
      </div>

      {m.notes ? (
        <div className="bf-field">
          <div className="bf-field-label">notes</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{m.notes}</div>
        </div>
      ) : null}
    </div>
  ))}

  {filtered.length === 0 ? (
    <div style={{ opacity: 0.7 }}>No meetings yet.</div>
  ) : null}
</div>

      <form onSubmit={onAdd} className="grid" style={{ gap: 10, marginTop: 12 }}>
          <input
            className="input"
            name="title"
            placeholder="Title"
            required
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />

          <DateTimeField
            name="starts_at"
            value={form.starts_at}
            onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))}
          />

          <DateTimeField
            name="ends_at"
            value={form.ends_at}
            onChange={(e) => setForm((p) => ({ ...p, ends_at: e.target.value }))}
          />

          <input
            className="input"
            name="location"
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
          />

          <input
            className="input"
            name="agenda"
            placeholder="Agenda (short)"
            value={form.agenda}
            onChange={(e) => setForm((p) => ({ ...p, agenda: e.target.value }))}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={!!form.is_public}
              onChange={(e) => setForm((p) => ({ ...p, is_public: e.target.checked }))}
            />
            Public
          </label>

          <button className="btn">Add Meeting</button>
        </form>
      </div>
    </div>
  );
}
