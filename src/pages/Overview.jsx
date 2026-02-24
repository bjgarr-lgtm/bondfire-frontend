import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../utils/api.js";
import { decryptWithOrgKey, getCachedOrgKey } from "../lib/zk.js";

/**
 * Overview (Dashboard)
 * Goal: keep Bondfire's existing styling (card/btn/helper/table/etc) but upgrade layout.
 * - Top row: compact stat cards (People, Inventory, Needs, Meetings, Pledges, Subscribers) with delta vs last load.
 * - Below: detailed cards with previews + simple visuals (inventory bars), scrollable.
 * - ZK: decrypt on client if encrypted_blob present and org key cached.
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

function fmtDT(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return "";
  try {
    const d = new Date(n);
    return d.toLocaleString(undefined, {
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

function safeStr(v) {
  return String(v ?? "");
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

function deltaBadge(now, prev) {
  const a = Number(now || 0);
  const b = Number(prev || 0);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return { txt: "• 0", tone: "helper" };
  const diff = a - b;
  const arrow = diff > 0 ? "▲" : "▼";
  return { txt: `${arrow} ${Math.abs(diff)}`, tone: diff > 0 ? "up" : "down" };
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

  // previous counts snapshot for deltas
  const prevCountsRef = useRef(null);

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      const d0 = await api(`/api/orgs/${encodeURIComponent(orgId)}/dashboard`);
      const d = { ...d0 };

      // Decrypt dashboard previews if ZK is on and we have an org key cached.
      d.people = await decryptRows(orgId, d0?.people);
      d.inventory = await decryptRows(orgId, d0?.inventory);
      d.needs = await decryptRows(orgId, d0?.needs);
      d.pledges = await decryptRows(orgId, d0?.pledges);
      d.newsletter = await decryptRows(orgId, d0?.newsletter);
      if (d0?.nextMeeting) d.nextMeeting = await tryDecryptRow(orgId, d0.nextMeeting);

      // Load previous counts for deltas.
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

      // Store current counts for next time.
      try {
        localStorage.setItem(prevKey, JSON.stringify(d?.counts || {}));
      } catch {
        // ignore quota issues
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

  const nextMeetingLabel = useMemo(() => {
    const pretty = fmtDT(nextMeeting?.starts_at);
    if (!pretty) return "not scheduled";
    return `${pretty}${nextMeeting?.title ? ` · ${nextMeeting.title}` : ""}`;
  }, [nextMeeting]);

  const recentSubs = useMemo(() => {
    const arr = newsletter.slice();
    arr.sort((a, b) => Number(b?.created_at || b?.joined_at || 0) - Number(a?.created_at || a?.joined_at || 0));
    return arr.slice(0, 5);
  }, [newsletter]);

  const recentPledges = useMemo(() => {
    const arr = pledges.slice();
    arr.sort((a, b) => Number(b?.created_at || 0) - Number(a?.created_at || 0));
    return arr.slice(0, 6);
  }, [pledges]);

  // Inventory “growth bars”: use qty as magnitude when present.
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

  const go = (tab) => nav(`/org/${encodeURIComponent(orgId)}/${tab}`);

  const StatCard = ({ title, value, prevValue, onClick }) => {
    const d = deltaBadge(value, prevValue);
    return (
      <button
        type="button"
        className="card"
        onClick={onClick}
        style={{
          padding: 12,
          textAlign: "left",
          cursor: "pointer",
          display: "grid",
          gap: 6,
          minHeight: 84,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 14 }}>{title}</div>
          <div
            className="helper"
            style={{
              marginLeft: "auto",
              opacity: 0.9,
              color: d.tone === "up" ? "#7CFC98" : d.tone === "down" ? "#FF8A8A" : undefined,
              fontWeight: 700,
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
            title="Change since last refresh"
          >
            {d.txt}
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>{Number(value || 0)}</div>
        <div className="helper" style={{ opacity: 0.85 }}>View</div>
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

      {/* TOP: compact stat row */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <StatCard title="People" value={counts.people || 0} prevValue={prevCounts.people || 0} onClick={() => go("people")} />
        <StatCard title="Inventory" value={counts.inventory || 0} prevValue={prevCounts.inventory || 0} onClick={() => go("inventory")} />
        <StatCard title="Needs (open)" value={counts.needsOpen || 0} prevValue={prevCounts.needsOpen || 0} onClick={() => go("needs")} />
        <StatCard title="Meetings (upcoming)" value={counts.meetingsUpcoming || 0} prevValue={prevCounts.meetingsUpcoming || 0} onClick={() => go("meetings")} />
        <StatCard title="Pledges" value={pledges.length} prevValue={prevCounts.pledges || 0} onClick={() => go("settings")} />
        <StatCard title="Subscribers" value={newsletter.length} prevValue={prevCounts.newsletter || 0} onClick={() => go("settings")} />
      </div>

      {/* BELOW: detailed cards (scrollable “tight” section) */}
      <div
        style={{
          display: "grid",
          gap: 12,
          maxHeight: "calc(100vh - 320px)",
          overflow: "auto",
          paddingRight: 4,
        }}
      >
        {/* Inventory detail with bars */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Inventory</h2>
            <button className="btn" onClick={() => go("inventory")}>View all</button>
          </div>

          <div className="helper" style={{ marginTop: 10 }}>
            {counts.inventory || 0} item{(counts.inventory || 0) === 1 ? "" : "s"}
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {invBars.length ? invBars.map((it) => (
              <div key={it.id} style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <div style={{ fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {it.name}
                  </div>
                  <div className="helper" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
                    {it.qty == null ? "" : `${it.qty}${it.unit ? ` ${it.unit}` : ""}`}
                  </div>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${it.pct}%`, background: "rgba(255,255,255,0.22)" }} />
                </div>
              </div>
            )) : (
              <div className="helper" style={{ marginTop: 10 }}>No inventory yet.</div>
            )}
          </div>
        </div>

        {/* Needs detail */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Needs</h2>
            <button className="btn" onClick={() => go("needs")}>View all</button>
          </div>

          <div className="helper" style={{ marginTop: 10 }}>
            {counts.needsAll || 0} total, {counts.needsOpen || 0} open
          </div>

          {needs.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {needs.slice(0, 6).map((n) => (
                <div key={n.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 900, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {safeStr(n.title || "").trim() || "(untitled need)"}
                    </div>
                    <div className="helper" style={{ whiteSpace: "nowrap" }}>
                      {safeStr(n.status || "").trim() || ""}
                    </div>
                  </div>
                  <div className="helper" style={{ marginTop: 6, opacity: 0.9 }}>
                    {Number.isFinite(Number(n.priority)) ? `priority ${Number(n.priority)}` : ""}
                    {safeStr(n.urgency).trim() ? ` · ${safeStr(n.urgency).trim()}` : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 10 }}>No needs yet.</div>
          )}
        </div>

        {/* Meetings detail */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Meetings</h2>
            <button className="btn" onClick={() => go("meetings")}>View all</button>
          </div>

          <div className="helper" style={{ marginTop: 10 }}>
            {counts.meetingsUpcoming || 0} upcoming
          </div>

          <div style={{ marginTop: 12 }} className="card">
            <div style={{ padding: 12 }}>
              <div className="helper">Next</div>
              <div style={{ marginTop: 6, fontWeight: 900 }}>
                {nextMeeting?.title && safeStr(nextMeeting.title) !== "__encrypted__" ? safeStr(nextMeeting.title) : "not scheduled"}
              </div>
              <div className="helper" style={{ marginTop: 6 }}>
                {nextMeetingLabel}
              </div>
            </div>
          </div>
        </div>

        {/* People detail */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, flex: 1 }}>People</h2>
            <button className="btn" onClick={() => go("people")}>View all</button>
          </div>

          <div className="helper" style={{ marginTop: 10 }}>
            {counts.people || 0} member{(counts.people || 0) === 1 ? "" : "s"}
          </div>

          {people.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {people.slice(0, 6).map((p) => (
                <div key={p.id} className="card" style={{ padding: 12, display: "flex", gap: 12, alignItems: "baseline" }}>
                  <div style={{ fontWeight: 900, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {safeStr(p.name || "").trim() || "(unnamed)"}
                  </div>
                  <div className="helper" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
                    {safeStr(p.role || "").trim() || ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 10 }}>No people yet.</div>
          )}
        </div>

        {/* Pulse: recent subs + pledges */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Pulse</h2>
            <button className="btn" onClick={() => go("settings")}>View</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontWeight: 900 }}>New subscribers</div>
                <div className="helper" style={{ marginLeft: "auto" }}>{recentSubs.length} shown</div>
              </div>
              {recentSubs.length ? (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {recentSubs.map((s) => (
                    <div key={s.id} style={{ display: "flex", gap: 10 }}>
                      <div style={{ fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {safeStr(s?.name || "").trim() || "(no name)"}
                      </div>
                      <div className="helper" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
                        {fmtDT(s?.created_at || s?.joined_at)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="helper" style={{ marginTop: 10 }}>none yet</div>
              )}
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontWeight: 900 }}>Recent pledges</div>
                <div className="helper" style={{ marginLeft: "auto" }}>{recentPledges.length} shown</div>
              </div>

              {recentPledges.length ? (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {recentPledges.map((p) => {
                    const who = safeStr(p?.pledger_name).trim() || "someone";
                    const target = pickPledgeTarget(p, needTitleById);
                    const st = safeStr(pill(p?.status));
                    return (
                      <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                        <div style={{ fontWeight: 900, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {who}
                        </div>
                        <div className="helper">→</div>
                        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {target}
                        </div>
                        <div className="helper" style={{ whiteSpace: "nowrap" }}>
                          {st}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="helper" style={{ marginTop: 10 }}>none yet</div>
              )}
            </div>
          </div>

          <div className="helper" style={{ marginTop: 12, opacity: 0.85 }}>
            Dashboard note: emails are intentionally not shown here.
          </div>
        </div>
      </div>
    </div>
  );
}