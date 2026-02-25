// src/pages/MeetingDetail.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../utils/api.js";

function getOrgId() {
  try {
    const m = (window.location.hash || "").match(/#\/org\/([^/]+)/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function toLocalDateTimeInput(valueMs) {
  if (!valueMs) return "";
  const d = new Date(Number(valueMs));
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  // datetime-local wants local time without seconds
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeInput(s) {
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

export default function MeetingDetail() {
  const nav = useNavigate();
  const params = useParams();
  const meetingId = params?.meetingId;
  const orgId = params?.orgId || getOrgId();

  const [m, setM] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!orgId || !meetingId) return;
    const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings/${encodeURIComponent(meetingId)}`);
    setM(data.meeting || null);
  }

  useEffect(() => {
    refresh().catch((e) => setErr(e?.message || String(e)));
  }, [orgId, meetingId]);

  async function save(patch) {
    if (!orgId || !meetingId) return;
    setBusy(true);
    setErr("");
    try {
      await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings/${encodeURIComponent(meetingId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await refresh();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!orgId || !meetingId) return;
    if (!confirm("Delete this meeting?")) return;
    setBusy(true);
    setErr("");
    try {
      await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings/${encodeURIComponent(meetingId)}`, {
        method: "DELETE",
      });
      nav(`/org/${encodeURIComponent(orgId)}/meetings`, { replace: true });
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!orgId) return <div style={{ padding: 16 }}>No org selected.</div>;
  if (!m) return <div style={{ padding: 16 }}>{err ? `Error: ${err}` : "Loading..."}</div>;

  return (
    <div className="card" style={{ margin: 16, padding: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
          Meeting
        </h2>
        <button className="btn" onClick={() => nav(-1)} disabled={busy}>
          Back
        </button>
        <button className="btn" onClick={del} disabled={busy}>
          Delete
        </button>
      </div>

      {err && (
        <div className="helper" style={{ color: "tomato", marginTop: 8 }}>
          {err}
        </div>
      )}

      <div className="grid" style={{ gap: 10, marginTop: 12 }}>
        <input
          className="input"
          defaultValue={m.title || ""}
          placeholder="Title"
          onBlur={(e) => {
            const v = e.target.value || "";
            if (v !== (m.title || "")) save({ title: v }).catch(console.error);
          }}
        />

        <div className="grid cols-2" style={{ gap: 10 }}>
          <div>
            <div className="helper">Start</div>
            <input
              className="input"
              type="datetime-local"
              defaultValue={toLocalDateTimeInput(m.starts_at)}
              onBlur={(e) => {
                const ms = fromLocalDateTimeInput(e.target.value);
                if (ms !== (m.starts_at ?? null)) save({ starts_at: ms }).catch(console.error);
              }}
            />
          </div>
          <div>
            <div className="helper">End</div>
            <input
              className="input"
              type="datetime-local"
              defaultValue={toLocalDateTimeInput(m.ends_at)}
              onBlur={(e) => {
                const ms = fromLocalDateTimeInput(e.target.value);
                if (ms !== (m.ends_at ?? null)) save({ ends_at: ms }).catch(console.error);
              }}
            />
          </div>
        </div>

        <input
          className="input"
          defaultValue={m.location || ""}
          placeholder="Location"
          onBlur={(e) => {
            const v = e.target.value || "";
            if (v !== (m.location || "")) save({ location: v }).catch(console.error);
          }}
        />

        <label className="row" style={{ gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            defaultChecked={!!m.is_public}
            onChange={(e) => save({ is_public: e.target.checked }).catch(console.error)}
          />
          <span>Public (show on public page)</span>
        </label>

        <textarea
          className="textarea"
          defaultValue={m.agenda || ""}
          placeholder="Agenda"
          rows={4}
          onBlur={(e) => {
            const v = e.target.value || "";
            if (v !== (m.agenda || "")) save({ agenda: v }).catch(console.error);
          }}
        />

        <textarea
          className="textarea"
          defaultValue={m.notes || ""}
          placeholder="Notes"
          rows={6}
          onBlur={(e) => {
            const v = e.target.value || "";
            if (v !== (m.notes || "")) save({ notes: v }).catch(console.error);
          }}
        />
      </div>
    </div>
  );
}
