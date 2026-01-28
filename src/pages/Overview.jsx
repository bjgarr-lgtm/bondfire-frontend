import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api.js";

function getOrgId() {
  try {
    const m = (window.location.hash || "").match(/#\/org\/([^/]+)/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function readOrgInfo(orgId) {
  try {
    const s = JSON.parse(localStorage.getItem(`bf_org_settings_${orgId}`) || "{}");
    const orgs = JSON.parse(localStorage.getItem("bf_orgs") || "[]");
    const o = orgs.find((x) => x?.id === orgId) || {};
    return { name: (s.name || o.name || orgId || "Dashboard").trim() };
  } catch {
    return { name: orgId || "Dashboard" };
  }
}

function shortId(s) {
  const t = String(s || "");
  if (!t) return "";
  if (t.length <= 10) return t;
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

function normalizeKind(kind) {
  const k = String(kind || "").trim().toLowerCase();
  const map = {
    "need.created": "Need created",
    "need.create": "Need created",
    "need.updated": "Need updated",
    "need.update": "Need updated",
    "need.deleted": "Need deleted",
    "need.delete": "Need deleted",

    "person.created": "Person added",
    "person.create": "Person added",
    "person.updated": "Person updated",
    "person.update": "Person updated",
    "person.deleted": "Person removed",
    "person.delete": "Person removed",

    "inventory.created": "Inventory added",
    "inventory.create": "Inventory added",
    "inventory.updated": "Inventory updated",
    "inventory.update": "Inventory updated",
    "inventory.deleted": "Inventory removed",
    "inventory.delete": "Inventory removed",

    "meeting.created": "Meeting created",
    "meeting.create": "Meeting created",
    "meeting.updated": "Meeting updated",
    "meeting.update": "Meeting updated",
    "meeting.deleted": "Meeting deleted",
    "meeting.delete": "Meeting deleted",

    "invite.created": "Invite created",
    "invite.redeemed": "Invite redeemed",
  };

  if (map[k]) return map[k];

  const last = k.split(".").filter(Boolean).slice(-1)[0] || k;
  return last ? last.charAt(0).toUpperCase() + last.slice(1) : "Activity";
}

function cleanMessage(msg = "") {
  let s = String(msg || "").trim();
  if (!s) return "";

  // If message contains "x: y", keep y.
  const i = s.indexOf(":");
  if (i !== -1) s = s.slice(i + 1).trim();

  // Reduce UUID noise
  const uuidRe =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
  s = s.replace(uuidRe, (m) => shortId(m));

  return s || String(msg || "");
}

function groupActivity(activity) {
  const arr = Array.isArray(activity) ? activity : [];
  const grouped = [];

  for (const a of arr) {
    const label = normalizeKind(a?.kind);
    const msg = cleanMessage(a?.message);
    const key = `${label}::${msg}`;

    const last = grouped[grouped.length - 1];
    if (last && last.key === key) {
      last.count += 1;
      continue;
    }

    grouped.push({
      key,
      label,
      msg,
      count: 1,
      raw: a,
    });
  }

  return grouped.slice(0, 10);
}

function fmtWhen(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "";
  try {
    return new Date(n).toLocaleString();
  } catch {
    return "";
  }
}

export default function Overview() {
  const nav = useNavigate();
  const orgId = getOrgId();

  const [orgInfo, setOrgInfo] = useState(() => readOrgInfo(orgId));

  useEffect(() => {
    setOrgInfo(readOrgInfo(orgId));
    const onChange = (e) => {
      const changedId = e?.detail?.orgId;
      if (!changedId || changedId === orgId) setOrgInfo(readOrgInfo(orgId));
    };
    window.addEventListener("bf:org_settings_changed", onChange);
    return () => window.removeEventListener("bf:org_settings_changed", onChange);
  }, [orgId]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      const d = await api(`/api/orgs/${encodeURIComponent(orgId)}/dashboard`);
      setData(d);
    } catch (e) {
      setErr(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, [orgId]);

  const counts = data?.counts || {};
  const people = Array.isArray(data?.people) ? data.people : [];
  const inventory = Array.isArray(data?.inventory) ? data.inventory : [];
  const needs = Array.isArray(data?.needs) ? data.needs : [];
  const meetings = Array.isArray(data?.meetings) ? data.meetings : [];
  const activity = Array.isArray(data?.activity) ? data.activity : [];

  const activityGrouped = useMemo(() => groupActivity(activity), [activity]);

  if (!orgId) return <div style={{ padding: 16 }}>No org selected.</div>;

  return (
    <div style={{ padding: 16 }}>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, flex: 1 }}>{orgInfo?.name || "Dashboard"}</h1>
          <button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>
        {err ? <div className="helper" style={{ color: "tomato", marginTop: 10 }}>{err}</div> : null}
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}
      >
        {/* People */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>People</h2>
            <button className="btn" onClick={() => nav("people")}>View all</button>
          </div>

          <div className="helper" style={{ marginTop: 10 }}>
            {counts.people || 0} member{(counts.people || 0) === 1 ? "" : "s"}
          </div>

          <ul style={{ marginTop: 10, paddingLeft: 18 }}>
            {people.map((p) => (
              <li key={p.id}>
                {String(p.name || "").trim() || String(p.email || "").trim() || shortId(p.id)}
              </li>
            ))}
            {people.length === 0 ? (
              <li className="helper">
                {(counts.people || 0) > 0 ? "Members exist, but no preview loaded." : "No people yet."}
              </li>
            ) : null}
          </ul>
        </div>

        {/* Inventory */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Inventory</h2>
            <button className="btn" onClick={() => nav("inventory")}>View all</button>
          </div>

          <div className="helper" style={{ marginTop: 10 }}>
            {counts.inventory || 0} item{(counts.inventory || 0) === 1 ? "" : "s"}
          </div>

          <ul style={{ marginTop: 10, paddingLeft: 18 }}>
            {inventory.map((it) => (
              <li key={it.id}>
                {String(it.name || "").trim() || shortId(it.id)}
                {typeof it.qty !== "undefined" && it.qty !== null && String(it.qty) !== ""
                  ? ` · ${it.qty}${it.unit ? ` ${it.unit}` : ""}`
                  : ""}
              </li>
            ))}
            {inventory.length === 0 ? (
              <li className="helper">
                {(counts.inventory || 0) > 0 ? "Items exist, but no preview loaded." : "No inventory yet."}
              </li>
            ) : null}
          </ul>
        </div>

        {/* Needs */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Needs</h2>
            <button className="btn" onClick={() => nav("needs")}>View all</button>
          </div>

          <div className="helper" style={{ marginTop: 10 }}>
            {counts.needsAll || 0} total, {counts.needsOpen || 0} open
          </div>

          <ul style={{ marginTop: 10, paddingLeft: 18 }}>
            {needs.map((n) => (
              <li key={n.id}>
                {String(n.title || "").trim() || shortId(n.id)}
                {n.status ? ` · ${n.status}` : ""}
              </li>
            ))}
            {needs.length === 0 ? (
              <li className="helper">
                {(counts.needsAll || 0) > 0 ? "Needs exist, but no preview loaded." : "No needs yet."}
              </li>
            ) : null}
          </ul>
        </div>

        {/* Meetings */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Meetings</h2>
            <button className="btn" onClick={() => nav("meetings")}>View all</button>
          </div>

          <div className="helper" style={{ marginTop: 10 }}>
            {counts.meetingsUpcoming || 0} upcoming
          </div>

          <ul style={{ marginTop: 10, paddingLeft: 18 }}>
            {meetings.map((m) => (
              <li key={m.id}>
                {String(m.title || "").trim() || shortId(m.id)}
                {m.starts_at ? ` · ${fmtWhen(m.starts_at)}` : ""}
                {m.location ? ` · ${m.location}` : ""}
              </li>
            ))}
            {meetings.length === 0 ? (
              <li className="helper">
                {(counts.meetingsUpcoming || 0) > 0 ? "Meetings exist, but no preview loaded." : "No upcoming meetings."}
              </li>
            ) : null}
          </ul>
        </div>

        {/* Recent Activity */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Recent Activity</h2>
            <button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>
              Refresh
            </button>
          </div>

          <ul style={{ marginTop: 10, paddingLeft: 18 }}>
            {activityGrouped.map((g) => {
              const a = g.raw || {};
              const who =
                String(a.actor_name || "").trim() ||
                String(a.actor_email || "").trim() ||
                (a.actor_user_id ? shortId(a.actor_user_id) : "");

              return (
                <li key={a.id || g.key}>
                  <strong>{g.label}</strong>
                  {g.count > 1 ? ` x${g.count}` : ""}
                  {g.msg ? `: ${g.msg}` : ""}
                  {who ? <span className="helper"> · {who}</span> : null}
                </li>
              );
            })}
            {activityGrouped.length === 0 ? <li className="helper">No activity yet.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
