import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../utils/api.js";
import { decryptWithOrgKey, getCachedOrgKey } from "../lib/zk.js";

/**
 * Dashboard (Overview)
 *
 * What this DOES:
 * - Keeps current Bondfire styling tokens (card/btn/helper/grid).
 * - Adds the “mockup” level UI inside the content area: bars, sparklines, pills, ring gauge.
 * - Fixes scrolling: whole page scrolls (no inner scroll box).
 * - ZK-safe: decrypts encrypted_blob client-side when org key is cached.
 *
 * What this does NOT do (needs layout shell edits):
 * - Sidebar redesign, global search, notifications, profile photo UI.
 *   Those belong to the app shell/layout component, not Overview.jsx.
 */

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

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function deltaBadge(now, prev) {
  const a = Number(now || 0);
  const b = Number(prev || 0);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return { txt: "• 0", tone: "flat" };
  const diff = a - b;
  const arrow = diff > 0 ? "▲" : "▼";
  return { txt: `${arrow} ${Math.abs(diff)}`, tone: diff > 0 ? "up" : "down" };
}

function statusPill(status) {
  const s = safeStr(status).trim().toLowerCase();
  if (!s) return { label: "", bg: "rgba(255,255,255,0.08)", fg: "rgba(255,255,255,0.75)" };
  if (s === "accepted") return { label: "accepted", bg: "rgba(124,252,152,0.18)", fg: "#7CFC98" };
  if (s === "offered") return { label: "offered", bg: "rgba(255,214,102,0.18)", fg: "#FFD666" };
  if (s === "declined") return { label: "declined", bg: "rgba(255,138,138,0.18)", fg: "#FF8A8A" };
  if (s === "fulfilled") return { label: "done", bg: "rgba(128,200,255,0.18)", fg: "#80C8FF" };
  return { label: s, bg: "rgba(255,255,255,0.08)", fg: "rgba(255,255,255,0.8)" };
}

function urgencyPill(urgency) {
  const u = safeStr(urgency).trim().toLowerCase();
  if (!u) return null;
  if (u === "urgent") return { label: "urgent", bg: "rgba(255,80,80,0.18)", fg: "#FF8A8A" };
  if (u === "high") return { label: "high", bg: "rgba(255,214,102,0.18)", fg: "#FFD666" };
  if (u === "medium") return { label: "medium", bg: "rgba(128,200,255,0.18)", fg: "#80C8FF" };
  return { label: u, bg: "rgba(255,255,255,0.08)", fg: "rgba(255,255,255,0.8)" };
}

function pillEl(p) {
  if (!p?.label) return null;
  return (
    <span
      className="helper"
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        background: p.bg,
        color: p.fg,
        fontWeight: 800,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {p.label}
    </span>
  );
}

function Sparkline({ points = [], height = 34 }) {
  const w = 180;
  const h = height;
  const pts = (points || []).map((n) => Number(n)).filter((n) => Number.isFinite(n));
  if (pts.length < 2) return <div style={{ height: h }} />;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(1e-6, max - min);
  const step = w / (pts.length - 1);
  const d = pts
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / span) * (h - 6) - 3;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2" />
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

function Ring({ value, max, label }) {
  const v = clamp(Number(value || 0), 0, Number(max || 1));
  const m = Math.max(1, Number(max || 1));
  const pct = v / m;
  const r = 18;
  const c = 2 * Math.PI * r;
  const dash = pct * c;
  const gap = c - dash;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="44" height="44" viewBox="0 0 44 44" style={{ display: "block" }}>
        <circle cx="22" cy="22" r={r} stroke="rgba(255,255,255,0.10)" strokeWidth="6" fill="none" />
        <circle
          cx="22"
          cy="22"
          r={r}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <div>
        <div style={{ fontWeight: 900 }}>{value}</div>
        <div className="helper">{label}</div>
      </div>
    </div>
  );
}

function pickPledgeTarget(p, needTitleById) {
  const nid = safeStr(p?.need_id).trim();
  if (nid && needTitleById[nid]) return needTitleById[nid];

  const note = safeStr(p?.note);
  const m = note.match(/item:\s*([^\n|]+)(?:\s*\||\n|$)/i);
  if (m && m[1]) return m[1].trim();

  const t = safeStr(p?.type).trim();
  return t || "pledge";
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

  const prevCountsRef = useRef(null);

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
      d.pledges = await decryptRows(orgId, d0?.pledges);
      d.newsletter = await decryptRows(orgId, d0?.newsletter);
      if (d0?.nextMeeting) d.nextMeeting = await tryDecryptRow(orgId, d0.nextMeeting);

      const prevKey = `bf_dash_counts_${orgId}`;
      const prev =
        prevCountsRef.current ||
        (() => {
          try {
            return JSON.parse(localStorage.getItem(prevKey) || "null");
          } catch {
            return null;
          }
        })();
      prevCountsRef.current = prev;
      try {
        localStorage.setItem(prevKey, JSON.stringify(d?.counts || {}));
      } catch {
        // ignore
      }

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

  if (!orgId) return <div style={{ padding: 16 }}>No org selected.</div>;

  const counts = data?.counts || {};
  const prevCounts = prevCountsRef.current || {};

  const people = Array.isArray(data?.people) ? data.people : [];
  const inventory = Array.isArray(data?.inventory) ? data.inventory : [];
  const needs = Array.isArray(data?.needs) ? data.needs : [];
  const pledges = Array.isArray(data?.pledges) ? data.pledges : [];
  const newsletter = Array.isArray(data?.newsletter) ? data.newsletter : [];
  const nextMeeting = data?.nextMeeting || null;

  const needTitleById = useMemo(() => {
    const m = {};
    for (const n of needs) {
      if (n?.id && n?.title && safeStr(n.title) !== "__encrypted__") m[safeStr(n.id)] = safeStr(n.title);
    }
    return m;
  }, [needs]);

  const recentSubs = useMemo(() => {
    const arr = newsletter.slice();
    arr.sort((a, b) => Number(b?.created_at || b?.joined_at || 0) - Number(a?.created_at || a?.joined_at || 0));
    return arr.slice(0, 5);
  }, [newsletter]);

  const subsSpark = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const bins = new Array(8).fill(0);
    for (const s of newsletter) {
      const t = Number(s?.created_at || s?.joined_at || 0);
      if (!Number.isFinite(t) || t <= 0) continue;
      const ageWeeks = Math.floor((now - t) / weekMs);
      if (ageWeeks >= 0 && ageWeeks < 8) bins[7 - ageWeeks] += 1;
    }
    let cum = 0;
    return bins.map((x) => (cum += x));
  }, [newsletter]);

  const recentPledges = useMemo(() => {
    const arr = pledges.slice();
    arr.sort((a, b) => Number(b?.created_at || 0) - Number(a?.created_at || 0));
    return arr.slice(0, 6);
  }, [pledges]);

  const openNeeds = useMemo(() => {
    const arr = needs.filter((n) => safeStr(n?.status).toLowerCase() !== "closed");
    const rankU = (u) => {
      const s = safeStr(u).toLowerCase();
      if (s === "urgent") return 3;
      if (s === "high") return 2;
      if (s === "medium") return 1;
      return 0;
    };
    arr.sort((a, b) => {
      const du = rankU(b?.urgency) - rankU(a?.urgency);
      if (du !== 0) return du;
      return Number(b?.priority || 0) - Number(a?.priority || 0);
    });
    return arr.slice(0, 6);
  }, [needs]);

  const invBars = useMemo(() => {
    const items = inventory.slice(0, 8).map((it) => ({
      id: it?.id,
      name: safeStr(it?.name || "").trim() || "(unnamed)",
      qty: Number.isFinite(Number(it?.qty)) ? Number(it?.qty) : null,
      unit: safeStr(it?.unit || "").trim(),
    }));
    const max = Math.max(1, ...items.map((x) => (x.qty == null ? 0 : x.qty)));
    return items.map((x) => ({ ...x, pct: x.qty == null ? 0 : Math.round((x.qty / max) * 100) }));
  }, [inventory]);

  const nextMeetingLabel = useMemo(() => {
    const pretty = fmtDT(nextMeeting?.starts_at);
    if (!pretty) return "not scheduled";
    return `${pretty}${nextMeeting?.title ? ` · ${nextMeeting.title}` : ""}`;
  }, [nextMeeting]);

  const go = (tab) => nav(`/org/${encodeURIComponent(orgId)}/${tab}`);

  const StatCard = ({ icon, title, value, prevValue, hint, onClick }) => {
    const d = deltaBadge(value, prevValue);
    const toneColor = d.tone === "up" ? "#7CFC98" : d.tone === "down" ? "#FF8A8A" : "rgba(255,255,255,0.7)";
    return (
      <button type="button" className="card" onClick={onClick} style={{ padding: 12, textAlign: "left", cursor: "pointer", display: "grid", gap: 6, minHeight: 88 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 16 }}>{icon}</div>
          <div style={{ fontWeight: 900, fontSize: 14 }}>{title}</div>
          <div className="helper" style={{ marginLeft: "auto", color: toneColor, fontWeight: 800 }} title="Change since last refresh">
            {d.txt}
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>{Number(value || 0)}</div>
        <div className="helper" style={{ opacity: 0.9 }}>{hint || ""}</div>
      </button>
    );
  };

  return (
    <div style={{ padding: 16 }}>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, flex: 1, minWidth: 200 }}>{orgInfo?.name || "Dashboard"}</h1>
          <button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>
        {err ? <div className="helper" style={{ color: "tomato", marginTop: 10 }}>{err}</div> : null}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 12 }}>
        <StatCard icon="👥" title="People" value={counts.people || 0} prevValue={prevCounts.people || 0} hint="members" onClick={() => go("people")} />
        <StatCard icon="📦" title="Inventory" value={counts.inventory || 0} prevValue={prevCounts.inventory || 0} hint="items" onClick={() => go("inventory")} />
        <StatCard icon="🧯" title="Needs" value={counts.needsOpen || 0} prevValue={prevCounts.needsOpen || 0} hint="open" onClick={() => go("needs")} />
        <StatCard icon="🗓️" title="Meetings" value={counts.meetingsUpcoming || 0} prevValue={prevCounts.meetingsUpcoming || 0} hint="upcoming" onClick={() => go("meetings")} />
        <StatCard icon="🤝" title="Pledges" value={pledges.length} prevValue={prevCounts.pledges || 0} hint="recent" onClick={() => go("settings")} />
        <StatCard icon="📮" title="New Subs" value={recentSubs.length} prevValue={prevCounts.newsletterNew || 0} hint="recent" onClick={() => go("settings")} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
        <div className="card" style={{ gridColumn: "span 5", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, flex: 1 }}>Next Meetings</h2>
            <button className="btn" onClick={() => go("meetings")}>View all</button>
          </div>
          <div className="card" style={{ padding: 12, marginTop: 12 }}>
            <div className="helper">Next</div>
            <div style={{ marginTop: 6, fontWeight: 900, fontSize: 16 }}>
              {nextMeeting?.title && safeStr(nextMeeting.title) !== "__encrypted__" ? safeStr(nextMeeting.title) : "not scheduled"}
            </div>
            <div className="helper" style={{ marginTop: 6 }}>{nextMeetingLabel}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => go("meetings")}>RSVP</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 4", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, flex: 1 }}>Inventory at a Glance</h2>
            <button className="btn" onClick={() => go("inventory")}>Manage</button>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {invBars.length ? invBars.map((it) => {
              const low = it.qty != null && it.qty <= 5;
              return (
                <div key={it.id} style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                    <div className="helper" style={{ marginLeft: "auto", whiteSpace: "nowrap", color: low ? "#FFD666" : undefined }}>
                      {it.qty == null ? "" : `${it.qty}${it.unit ? ` ${it.unit}` : ""}`}{low ? "  low" : ""}
                    </div>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${it.pct}%`, background: low ? "rgba(255,214,102,0.35)" : "rgba(255,255,255,0.22)" }} />
                  </div>
                </div>
              );
            }) : <div className="helper">No inventory yet.</div>}
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 3", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, flex: 1 }}>New This Week</h2>
            <button className="btn" onClick={() => go("settings")}>View</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>+ {recentSubs.length} subscribers</div>
              <div style={{ marginLeft: "auto" }}><Sparkline points={subsSpark} /></div>
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {recentSubs.length ? recentSubs.slice(0, 3).map((s) => (
                <div key={s.id} style={{ display: "flex", gap: 10 }}>
                  <div style={{ fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {safeStr(s?.name || "").trim() || "(no name)"}
                  </div>
                  <div className="helper" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{fmtDT(s?.created_at || s?.joined_at)}</div>
                </div>
              )) : <div className="helper">none yet</div>}
            </div>
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
            <div style={{ fontWeight: 900 }}>+ {recentPledges.length} pledges</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {recentPledges.length ? recentPledges.slice(0, 3).map((p) => {
                const who = safeStr(p?.pledger_name).trim() || "someone";
                const target = pickPledgeTarget(p, needTitleById);
                const pill = statusPill(p?.status);
                return (
                  <div key={p.id} className="card" style={{ padding: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                      {pillEl(pill)}
                      <div style={{ fontWeight: 900, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{who}</div>
                    </div>
                    <div className="helper" style={{ marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {target}
                    </div>
                  </div>
                );
              }) : <div className="helper">none yet</div>}
            </div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => go("settings")}>View Pledge Board</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 5", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, flex: 1 }}>Newsletter Growth</h2>
            <button className="btn" onClick={() => go("settings")}>View all</button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
            <Ring value={newsletter.length} max={Math.max(newsletter.length, 10)} label="subscribers" />
            <div style={{ flex: 1, minWidth: 220 }}>
              <Sparkline points={subsSpark} height={46} />
              <div className="helper" style={{ marginTop: 6, opacity: 0.85 }}>last ~8 weeks</div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {recentSubs.length ? recentSubs.slice(0, 3).map((s) => (
              <div key={s.id} className="card" style={{ padding: 12, display: "flex", gap: 12 }}>
                <div style={{ fontWeight: 900, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {safeStr(s?.name || "").trim() || "(no name)"}
                </div>
                <div className="helper" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{fmtDT(s?.created_at || s?.joined_at)}</div>
              </div>
            )) : <div className="helper">No subscribers yet.</div>}
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 4", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, flex: 1 }}>Open Needs</h2>
            <button className="btn" onClick={() => go("needs")}>View all</button>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {openNeeds.length ? openNeeds.map((n) => {
              const up = urgencyPill(n?.urgency);
              return (
                <div key={n.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    {pillEl(up)}
                    <div style={{ fontWeight: 900, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {safeStr(n.title || "").trim() || "(untitled need)"}
                    </div>
                    <div className="helper" style={{ whiteSpace: "nowrap" }}>{safeStr(n.status || "").trim()}</div>
                  </div>
                  <div className="helper" style={{ marginTop: 6, opacity: 0.9 }}>
                    {Number.isFinite(Number(n.priority)) ? `priority ${Number(n.priority)}` : ""}
                  </div>
                </div>
              );
            }) : <div className="helper">No needs yet.</div>}
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 3", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, flex: 1 }}>Recent Pledges</h2>
            <button className="btn" onClick={() => go("settings")}>View all</button>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {recentPledges.length ? recentPledges.slice(0, 5).map((p) => {
              const who = safeStr(p?.pledger_name).trim() || "someone";
              const target = pickPledgeTarget(p, needTitleById);
              const pill = statusPill(p?.status);
              return (
                <div key={p.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    {pillEl(pill)}
                    <div style={{ fontWeight: 900, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {who}
                    </div>
                  </div>
                  <div className="helper" style={{ marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {target}
                  </div>
                  <div className="helper" style={{ marginTop: 6, opacity: 0.85 }}>{fmtDT(p?.created_at)}</div>
                </div>
              );
            }) : <div className="helper">No pledges yet.</div>}
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 12", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, fontSize: 16, flex: 1 }}>Need help?</div>
            <button className="btn" onClick={() => go("settings")}>View guides</button>
          </div>
          <div className="helper" style={{ marginTop: 8, opacity: 0.9 }}>
            Sidebar, search, notifications, and profile photo are layout-shell work. This file focuses on the dashboard content panels.
          </div>
        </div>
      </div>
    </div>
  );
}