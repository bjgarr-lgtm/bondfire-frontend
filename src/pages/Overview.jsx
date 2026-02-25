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

function safeStr(v) {
  return String(v ?? "");
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

async function tryDecryptJSON(orgKey, encryptedBlob) {
  if (!orgKey || !encryptedBlob) return null;
  try {
    const raw = await decryptWithOrgKey(orgKey, encryptedBlob);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function tryDecryptString(orgKey, encryptedBlob) {
  if (!orgKey || !encryptedBlob) return null;
  try {
    return await decryptWithOrgKey(orgKey, encryptedBlob);
  } catch {
    return null;
  }
}

async function decryptPeopleList(orgId, orgKey, raw) {
  const arr = Array.isArray(raw) ? raw : [];
  if (!orgKey) return arr;
  const out = [];
  for (const p of arr) {
    if (p?.encrypted_blob) {
      const dec = await tryDecryptJSON(orgKey, p.encrypted_blob);
      if (dec) out.push({ ...p, ...dec });
      else out.push({ ...p, name: "(encrypted)" });
    } else {
      out.push(p);
    }
  }
  return out;
}

async function decryptInventoryList(orgId, orgKey, raw) {
  const arr = Array.isArray(raw) ? raw : [];
  if (!orgKey) return arr;
  const out = [];
  for (const it of arr) {
    if (it?.encrypted_blob) {
      const dec = await tryDecryptJSON(orgKey, it.encrypted_blob);
      if (dec) out.push({ ...it, ...dec });
      else out.push({ ...it, name: "(encrypted)" });
      continue;
    }
    if (it?.encrypted_notes && !it?.notes) {
      const notes = await tryDecryptString(orgKey, it.encrypted_notes);
      out.push({ ...it, notes: notes ?? it.notes });
      continue;
    }
    out.push(it);
  }
  return out;
}

async function decryptNeedsList(orgId, orgKey, raw) {
  const arr = Array.isArray(raw) ? raw : [];
  if (!orgKey) return arr;
  const out = [];
  for (const n of arr) {
    if (n?.encrypted_blob) {
      const dec = await tryDecryptJSON(orgKey, n.encrypted_blob);
      if (dec) out.push({ ...n, ...dec });
      else out.push({ ...n, title: "(encrypted)" });
      continue;
    }
    if (n?.encrypted_description && !n?.description) {
      const desc = await tryDecryptString(orgKey, n.encrypted_description);
      out.push({ ...n, description: desc ?? n.description });
      continue;
    }
    out.push(n);
  }
  return out;
}

async function decryptMeetingsList(orgId, orgKey, raw) {
  const arr = Array.isArray(raw) ? raw : [];
  if (!orgKey) return arr;
  const out = [];
  for (const m of arr) {
    if (m?.encrypted_blob) {
      const dec = await tryDecryptJSON(orgKey, m.encrypted_blob);
      if (dec) out.push({ ...m, ...dec });
      else out.push({ ...m, title: "(encrypted)" });
      continue;
    }
    if (m?.encrypted_notes && !m?.notes) {
      const notes = await tryDecryptString(orgKey, m.encrypted_notes);
      out.push({ ...m, notes: notes ?? m.notes });
      continue;
    }
    out.push(m);
  }
  return out;
}

function clamp(n, a, b) {
  const x = Number(n);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

function Sparkline({ points = [], height = 32 }) {
  const w = 120;
  const h = height;
  const arr = Array.isArray(points) ? points : [];
  if (arr.length < 2) {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <path d={`M0 ${h - 2} L${w} ${h - 2}`} stroke="rgba(255,255,255,0.25)" strokeWidth="2" fill="none" />
      </svg>
    );
  }

  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const denom = max === min ? 1 : (max - min);

  const pts = arr.map((v, i) => {
    const x = (i / (arr.length - 1)) * (w - 4) + 2;
    const y = h - 2 - ((v - min) / denom) * (h - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
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
  const [counts, setCounts] = useState({
    people: 0,
    inventory: 0,
    needsOpen: 0,
    needsAll: 0,
    meetingsUpcoming: 0,
  });

  const [people, setPeople] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [pledges, setPledges] = useState([]);
  const [subs, setSubs] = useState([]);

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      const orgKey = getCachedOrgKey(orgId);

      const d = await api(`/api/orgs/${encodeURIComponent(orgId)}/dashboard`);
      if (!d?.ok) throw new Error(d?.detail || d?.error || "Failed to load dashboard");

      setCounts({
        people: Number(d?.counts?.people || 0),
        inventory: Number(d?.counts?.inventory || 0),
        needsOpen: Number(d?.counts?.needsOpen || 0),
        needsAll: Number(d?.counts?.needsAll || 0),
        meetingsUpcoming: Number(d?.counts?.meetingsUpcoming || 0),
      });

      // Pull full lists so we can decrypt in the UI (dashboard endpoint doesn't include encrypted_blob).
      const [p1, i1, n1, m1, pl1, s1] = await Promise.all([
        api(`/api/orgs/${encodeURIComponent(orgId)}/people`).catch(() => ({ people: [] })),
        api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`).catch(() => ({ inventory: [] })),
        api(`/api/orgs/${encodeURIComponent(orgId)}/needs`).catch(() => ({ needs: [] })),
        api(`/api/orgs/${encodeURIComponent(orgId)}/meetings`).catch(() => ({ meetings: [] })),
        api(`/api/orgs/${encodeURIComponent(orgId)}/pledges`).catch(() => ({ pledges: [] })),
        api(`/api/orgs/${encodeURIComponent(orgId)}/newsletter/subscribers`).catch(() => ({ subscribers: [] })),
      ]);

      const peopleDec = await decryptPeopleList(orgId, orgKey, p1?.people);
      const invDec = await decryptInventoryList(orgId, orgKey, i1?.inventory);
      const needsDec = await decryptNeedsList(orgId, orgKey, n1?.needs);
      const meetingsDec = await decryptMeetingsList(orgId, orgKey, m1?.meetings);

      setPeople(peopleDec);
      setInventory(invDec);
      setNeeds(needsDec);
      setMeetings(meetingsDec);

      setPledges(Array.isArray(pl1?.pledges) ? pl1.pledges : []);
      setSubs(Array.isArray(s1?.subscribers) ? s1.subscribers : []);
    } catch (e) {
      setErr(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, [orgId]);

  if (!orgId) return <div style={{ padding: 16 }}>No org selected.</div>;

  const go = (tab) => nav(`/org/${encodeURIComponent(orgId)}/${tab}`);

  // Upcoming meetings: next 3 by starts_at
  const upcomingMeetings = useMemo(() => {
    const arr = Array.isArray(meetings) ? meetings : [];
    const nowMs = Date.now();
    return arr
      .filter((m) => Number(m?.starts_at) >= nowMs - 60_000)
      .sort((a, b) => Number(a?.starts_at || 0) - Number(b?.starts_at || 0))
      .slice(0, 3);
  }, [meetings]);

  const nextMeetingLabel = useMemo(() => {
    const m = upcomingMeetings[0];
    if (!m) return "not scheduled";
    const pretty = fmtDT(m?.starts_at);
    return `${pretty || "scheduled"}${m?.title ? ` · ${m.title}` : ""}`;
  }, [upcomingMeetings]);

  // Inventory: group by category and compute bars
  const invByCat = useMemo(() => {
    const arr = Array.isArray(inventory) ? inventory : [];
    const map = new Map();
    for (const it of arr) {
      const cat = safeStr(it?.category).trim() || "uncategorized";
      const qty = Number(it?.qty || 0);
      map.set(cat, (map.get(cat) || 0) + (Number.isFinite(qty) ? qty : 0));
    }
    const rows = Array.from(map.entries()).map(([category, totalQty]) => ({
      category,
      totalQty,
    }));
    rows.sort((a, b) => b.totalQty - a.totalQty);
    const top = rows.slice(0, 4);
    const max = top.length ? Math.max(...top.map((r) => r.totalQty)) : 1;
    return { top, max: max || 1 };
  }, [inventory]);

  const invLowCount = useMemo(() => {
    const arr = Array.isArray(inventory) ? inventory : [];
    return arr.filter((it) => Number(it?.qty) > 0 && Number(it?.qty) <= 5).length;
  }, [inventory]);

  const openNeeds = useMemo(() => {
    const arr = Array.isArray(needs) ? needs : [];
    return arr
      .filter((n) => safeStr(n?.status).toLowerCase() === "open" || !n?.status)
      .sort((a, b) => Number(b?.priority || 0) - Number(a?.priority || 0))
      .slice(0, 5);
  }, [needs]);

  const recentSubs = useMemo(() => {
    const arr = Array.isArray(subs) ? subs : [];
    return arr.slice(0, 5);
  }, [subs]);

  const subsWeekSeries = useMemo(() => {
    // last 7 days counts for sparkline
    const arr = Array.isArray(subs) ? subs : [];
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const buckets = Array.from({ length: 7 }, () => 0);
    for (const s of arr) {
      const t = Number(s?.created_at);
      if (!Number.isFinite(t)) continue;
      const d = Math.floor((now - t) / dayMs);
      if (d >= 0 && d < 7) buckets[6 - d] += 1;
    }
    return buckets;
  }, [subs]);

  const newSubsThisWeek = subsWeekSeries.reduce((a, b) => a + b, 0);

  const recentPledges = useMemo(() => {
    const arr = Array.isArray(pledges) ? pledges : [];
    return arr.slice(0, 5);
  }, [pledges]);

  const pledgesThisWeek = useMemo(() => {
    const arr = Array.isArray(pledges) ? pledges : [];
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return arr.filter((p) => Number(p?.created_at) >= cutoff).length;
  }, [pledges]);

  const pillStyle = (status) => {
    const s = safeStr(status).toLowerCase();
    const base = {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.06)",
    };
    if (s === "accepted") return { ...base, border: "1px solid rgba(0,255,150,0.25)", background: "rgba(0,255,150,0.10)" };
    if (s === "offered") return { ...base, border: "1px solid rgba(255,200,0,0.25)", background: "rgba(255,200,0,0.10)" };
    if (s === "declined") return { ...base, border: "1px solid rgba(255,80,80,0.25)", background: "rgba(255,80,80,0.10)" };
    return base;
  };

  const CountCard = ({ title, value, sub, onView }) => (
    <div className="card" style={{ padding: 14, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 900, flex: 1, minWidth: 0 }}>{title}</div>
        <button className="btn" type="button" onClick={onView} style={{ padding: "6px 10px" }}>
          View
        </button>
      </div>
      <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.05, marginTop: 8 }}>{value}</div>
      <div className="helper" style={{ marginTop: 4 }}>{sub}</div>
    </div>
  );

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

      {/* Top count row: 6 cards, one row on desktop */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <CountCard title="People" value={counts.people || 0} sub="members" onView={() => go("people")} />
        <CountCard title="Inventory" value={counts.inventory || 0} sub={`${invLowCount} low`} onView={() => go("inventory")} />
        <CountCard title="Needs" value={counts.needsOpen || 0} sub="open" onView={() => go("needs")} />
        <CountCard title="Meetings" value={counts.meetingsUpcoming || 0} sub="upcoming" onView={() => go("meetings")} />
        <CountCard title="Pledges" value={pledgesThisWeek} sub="this week" onView={() => go("settings?tab=pledges")} />
        <CountCard title="New Subs" value={newSubsThisWeek} sub="this week" onView={() => go("settings?tab=newsletter")} />
      </div>

      {/* Main grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 12,
        }}
      >
        {/* Next Meetings */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Next Meetings</h2>
            <button className="btn" onClick={() => go("meetings")}>View all</button>
          </div>

          <div className="helper" style={{ marginTop: 10 }}>
            Next: <strong>{nextMeetingLabel}</strong>
          </div>

          {upcomingMeetings.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {upcomingMeetings.map((m) => (
                <div key={m.id} className="card" style={{ padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 900, flex: 1, minWidth: 0 }}>{safeStr(m.title) || "(untitled)"}</div>
                    <button className="btn-red" type="button" onClick={() => go("meetings")} style={{ padding: "6px 10px" }}>
                      RSVP
                    </button>
                  </div>
                  <div className="helper" style={{ marginTop: 6 }}>
                    {fmtDT(m.starts_at)}{m.location ? ` · ${m.location}` : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>No upcoming meetings.</div>
          )}
        </div>

        {/* Inventory at a glance */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Inventory at a Glance</h2>
            <button className="btn" onClick={() => go("inventory")}>Manage</button>
          </div>

          {invByCat.top.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {invByCat.top.map((r) => {
                const pct = invByCat.max ? (r.totalQty / invByCat.max) : 0;
                return (
                  <div key={r.category} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <div style={{ fontWeight: 900, flex: 1, minWidth: 0 }}>{r.category}</div>
                      <div className="helper">{r.totalQty}</div>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${clamp(pct * 100, 0, 100)}%`, background: "rgba(255,0,0,0.35)" }} />
                    </div>
                  </div>
                );
              })}
              <div className="helper" style={{ marginTop: 6 }}>
                {invLowCount ? <span><strong>{invLowCount}</strong> items are low (qty ≤ 5).</span> : <span>No low items flagged.</span>}
              </div>
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>No inventory yet.</div>
          )}
        </div>

        {/* Open Needs */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Open Needs</h2>
            <button className="btn" onClick={() => go("needs")}>View all</button>
          </div>

          {openNeeds.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {openNeeds.map((n) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900 }}>{safeStr(n.title) || "(untitled)"}</div>
                    <div className="helper" style={{ marginTop: 2 }}>
                      {n.urgency ? `${safeStr(n.urgency)} · ` : ""}priority {Number(n.priority || 0)}
                    </div>
                  </div>
                  <button className="btn" type="button" onClick={() => go("needs")} style={{ padding: "6px 10px" }}>Open</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>No open needs.</div>
          )}
        </div>

        {/* Newsletter */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Newsletter</h2>
            <button className="btn" onClick={() => go("settings?tab=newsletter")}>View all</button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{Number(subs?.length || 0)}</div>
            <div className="helper">subscribers</div>
            <div style={{ marginLeft: "auto" }}><Sparkline points={subsWeekSeries} /></div>
          </div>

          {recentSubs.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {recentSubs.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 900, flex: 1, minWidth: 0 }}>{safeStr(s.name) || "(unnamed)"}</div>
                  <div className="helper">{fmtDT(s.created_at)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>No subscribers yet.</div>
          )}
        </div>

        {/* Recent Pledges */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Recent Pledges</h2>
            <button className="btn" onClick={() => go("settings?tab=pledges")}>View all</button>
          </div>

          {recentPledges.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {recentPledges.map((p) => (
                <div key={p.id} style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={pillStyle(p.status)}>{safeStr(p.status) || "offered"}</span>
                    <div style={{ fontWeight: 900, flex: 1, minWidth: 0 }}>
                      {safeStr(p.pledger_name) || "someone"}{p.type ? ` · ${p.type}` : ""}
                    </div>
                  </div>
                  <div className="helper" style={{ marginLeft: 2 }}>
                    {p.amount ? `${p.amount}${p.unit ? ` ${p.unit}` : ""} · ` : ""}
                    {fmtDT(p.created_at)}
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <button className="btn" type="button" onClick={() => go("settings?tab=pledges")}>View Pledge Board</button>
              </div>
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>No pledges yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
