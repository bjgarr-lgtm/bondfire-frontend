import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../utils/api.js";
import { decryptWithOrgKey, getCachedOrgKey } from "../lib/zk.js";

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
    "inventory.deleted": "Inventory deleted",
    "inventory.delete": "Inventory deleted",
    "inventory.created": "Inventory added",
    "inventory.create": "Inventory added",
    "inventory.updated": "Inventory updated",
    "inventory.update": "Inventory updated",

    "need.deleted": "Need deleted",
    "need.delete": "Need deleted",
    "need.created": "Need created",
    "need.create": "Need created",
    "need.updated": "Need updated",
    "need.update": "Need updated",

    "person.deleted": "Person removed",
    "person.delete": "Person removed",
    "person.created": "Person added",
    "person.create": "Person added",
    "person.updated": "Person updated",
    "person.update": "Person updated",

    "meeting.deleted": "Meeting deleted",
    "meeting.delete": "Meeting deleted",
    "meeting.created": "Meeting created",
    "meeting.create": "Meeting created",
    "meeting.updated": "Meeting updated",
    "meeting.update": "Meeting updated",

    "invite.created": "Invite created",
    "invite.redeemed": "Invite redeemed",
  };
  if (map[k]) return map[k];
  const last = k.split(".").filter(Boolean).slice(-1)[0] || k;
  return last ? last.charAt(0).toUpperCase() + last.slice(1) : "Activity";
}

function prettyMessage(a) {
  const title = String(a?.entity_title || a?.entity_name || a?.title || a?.name || "").trim();
  const entId = String(a?.entity_id || "").trim();
  if (title) return entId ? `${title} (${shortId(entId)})` : title;

  const raw = String(a?.message || "").trim();
  if (!raw) return "";

  const uuidRe = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
  return raw.replace(uuidRe, (m) => shortId(m));
}

function groupActivity(activity) {
  const arr = Array.isArray(activity) ? activity : [];
  const grouped = [];

  for (const a of arr) {
    const label = normalizeKind(a?.kind);
    const msg = prettyMessage(a);
    const key = `${label}::${msg}`;

    const last = grouped[grouped.length - 1];
    if (last && last.key === key) {
      last.count += 1;
      continue;
    }

    grouped.push({ key, label, msg, count: 1, raw: a });
  }

  return grouped.slice(0, 10);
}

function fmtDT(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return "";
  try {
    const d = new Date(n);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

async function tryDecryptRow(orgId, row) {
  const orgKey = getCachedOrgKey(orgId);
  if (!orgKey || !row?.encrypted_blob) return row;
  try {
    const dec = JSON.parse(await decryptWithOrgKey(orgKey, row.encrypted_blob));
    return { ...row, ...dec };
  } catch {
    return row;
  }
}

async function decryptRows(orgId, rows) {
  const arr = Array.isArray(rows) ? rows : [];
  const out = [];
  for (const r of arr) out.push(await tryDecryptRow(orgId, r));
  return out;
}

function pickPledgeTarget(p, needTitleById) {
  const nid = String(p?.need_id || "");
  if (nid && needTitleById[nid]) return needTitleById[nid];

  const note = String(p?.note || "");
  const m = note.match(/item:\s*([^\n|]+)(?:\s*\||\n|$)/i);
  if (m && m[1]) return m[1].trim();

  const t = String(p?.type || "").trim();
  return t || "pledge";
}

function pill(label) {
  const s = String(label || "").trim().toLowerCase();
  if (!s) return "";
  if (s === "accepted") return "accepted";
  if (s === "offered") return "offered";
  if (s === "declined") return "declined";
  if (s === "fulfilled") return "fulfilled";
  return s;
}

export default function Overview() {
  const nav = useNavigate();
  const { orgId } = useParams();

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
  const [peoplePreview, setPeoplePreview] = useState([]);

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      const d0 = await api(`/api/orgs/${encodeURIComponent(orgId)}/dashboard`);

      const d = { ...d0 };
      d.people = await decryptRows(orgId, d0?.people);
      d.inventory = await decryptRows(orgId, d0?.inventory);
      d.needs = await decryptRows(orgId, d0?.needs);
      d.newsletter = await decryptRows(orgId, d0?.newsletter);
      d.pledges = await decryptRows(orgId, d0?.pledges);

      if (d0?.nextMeeting) d.nextMeeting = await tryDecryptRow(orgId, d0.nextMeeting);

      setData(d);

      const countPeople = Number(d?.counts?.people || 0);
      const hasPeoplePreview = Array.isArray(d?.people) && d.people.length > 0;

      if (hasPeoplePreview) {
        setPeoplePreview(d.people);
      } else if (countPeople > 0) {
        const p0 = await api(`/api/orgs/${encodeURIComponent(orgId)}/people`);
        const pList = Array.isArray(p0?.people) ? p0.people.slice(0, 5) : [];
        setPeoplePreview(await decryptRows(orgId, pList));
      } else {
        setPeoplePreview([]);
      }
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
  const people = Array.isArray(data?.people) && data.people.length > 0 ? data.people : peoplePreview;
  const needs = Array.isArray(data?.needs) ? data.needs : [];
  const inventory = Array.isArray(data?.inventory) ? data.inventory : [];
  const activity = Array.isArray(data?.activity) ? data.activity : [];
  const nextMeeting = data?.nextMeeting || null;

  const newsletter = Array.isArray(data?.newsletter) ? data.newsletter : [];
  const pledges = Array.isArray(data?.pledges) ? data.pledges : [];

  const needTitleById = useMemo(() => {
    const m = {};
    for (const n of needs) {
      if (n?.id && n?.title && String(n.title) !== "__encrypted__") m[String(n.id)] = String(n.title);
    }
    return m;
  }, [needs]);

  const nextMeetingLabel = useMemo(() => {
    const pretty = fmtDT(nextMeeting?.starts_at);
    if (!pretty) return "not scheduled";
    return `${pretty}${nextMeeting?.title ? ` · ${nextMeeting.title}` : ""}`;
  }, [nextMeeting]);

  const recentSubs = useMemo(() => {
    const arr = newsletter.slice();
    arr.sort((a, b) => Number(b?.created_at || b?.joined_at || 0) - Number(a?.created_at || a?.joined_at || 0));
    return arr.slice(0, 3);
  }, [newsletter]);

  const recentPledges = useMemo(() => {
    const arr = pledges.slice();
    arr.sort((a, b) => Number(b?.created_at || 0) - Number(a?.created_at || 0));
    return arr.slice(0, 5);
  }, [pledges]);

  if (!orgId) return <div style={{ padding: 16 }}>No org selected.</div>;

  const go = (tab) => nav(`/org/${encodeURIComponent(orgId)}/${tab}`);

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

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>People</h2>
            <button className="btn" onClick={() => go("people")}>View all</button>
          </div>
          <div className="helper" style={{ marginTop: 10 }}>
            {counts.people || 0} member{(counts.people || 0) === 1 ? "" : "s"}
          </div>
          {(counts.people || 0) === 0 ? (
            <div className="helper" style={{ marginTop: 10 }}>No people yet.</div>
          ) : Array.isArray(people) && people.length > 0 ? (
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              {people.slice(0, 5).map((p) => <li key={p.id}>{p.name}</li>)}
            </ul>
          ) : null}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Inventory</h2>
            <button className="btn" onClick={() => go("inventory")}>View all</button>
          </div>
          <div className="helper" style={{ marginTop: 10 }}>
            {counts.inventory || 0} item{(counts.inventory || 0) === 1 ? "" : "s"}
          </div>
          {inventory.length ? (
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              {inventory.map((it) => (
                <li key={it.id}>
                  {it.name}
                  {typeof it.qty === "number" ? ` (${it.qty}${it.unit ? ` ${it.unit}` : ""})` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <div className="helper" style={{ marginTop: 10 }}>No inventory yet.</div>
          )}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Needs</h2>
            <button className="btn" onClick={() => go("needs")}>View all</button>
          </div>
          <div className="helper" style={{ marginTop: 10 }}>
            {counts.needsAll || 0} total, {counts.needsOpen || 0} open
          </div>
          {needs.length ? (
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              {needs.map((n) => (
                <li key={n.id}>
                  {n.title}
                  {n.status ? ` · ${n.status}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <div className="helper" style={{ marginTop: 10 }}>No needs yet.</div>
          )}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Meetings</h2>
            <button className="btn" onClick={() => go("meetings")}>View all</button>
          </div>
          <div className="helper" style={{ marginTop: 10 }}>{counts.meetingsUpcoming || 0} upcoming</div>
          <div className="helper" style={{ marginTop: 10 }}>Next: <strong>{nextMeetingLabel}</strong></div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, flex: 1 }}>Pulse</h2>
            <button className="btn" onClick={() => go("settings")} style={{ whiteSpace: "nowrap" }}>Settings</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div className="helper" style={{ fontWeight: 800 }}>new subscribers</div>
              {recentSubs.length ? (
                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                  {recentSubs.map((s) => {
                    const name = String(s?.name || "").trim() || "(no name)";
                    const t = fmtDT(s?.created_at || s?.joined_at);
                    return (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                        <span className="helper" style={{ whiteSpace: "nowrap" }}>
                          {t ? t.split(", ").slice(-2).join(", ") : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="helper" style={{ marginTop: 6 }}>none yet</div>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div className="helper" style={{ fontWeight: 800 }}>recent pledges</div>
              {recentPledges.length ? (
                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                  {recentPledges.map((p) => {
                    const who = String(p?.pledger_name || "").trim() || "someone";
                    const target = pickPledgeTarget(p, needTitleById);
                    const st = pill(p?.status);
                    return (
                      <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <span style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90 }}>
                          {who}
                        </span>
                        <span className="helper" style={{ whiteSpace: "nowrap" }}>→</span>
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {target}
                        </span>
                        {st ? <span className="helper" style={{ whiteSpace: "nowrap", opacity: 0.85 }}>{st}</span> : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="helper" style={{ marginTop: 6 }}>none yet</div>
              )}
            </div>
          </div>

          <div className="helper" style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span>{newsletter.length} total subs</span>
            <span>{pledges.length} total pledges</span>
          </div>
        </div>

        {/* Recent Activity intentionally removed because it was useless noise */}
        {activity && false ? (
          <div className="card" style={{ padding: 16 }}>
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              {groupActivity(activity).map((g) => (
                <li key={g.raw?.id || g.key}>
                  <strong>{g.label}</strong>
                  {g.count > 1 ? ` x${g.count}` : ""}
                  {g.msg ? `: ${g.msg}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}