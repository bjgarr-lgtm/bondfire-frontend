// src/pages/Overview.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../utils/api.js";
import { decryptJsonWithOrgKey, getCachedOrgKey } from "../lib/zk.js";

function safeStr(v) {
  return String(v ?? "");
}

function fmtDT(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return "";
  try {
    return new Date(n).toLocaleString(undefined, {
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

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function Sparkline({ points = [], height = 38 }) {
  const w = 100;
  const h = 30;
  const arr = Array.isArray(points) ? points : [];
  const min = arr.length ? Math.min(...arr) : 0;
  const max = arr.length ? Math.max(...arr) : 0;
  const span = max - min || 1;

  const d = arr
    .map((v, i) => {
      const x = (i / Math.max(1, arr.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <path d={d || ""} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.95" />
    </svg>
  );
}

async function tryDecryptList(orgKey, rows, blobField = "encrypted_blob") {
  if (!orgKey) return rows;
  const out = [];
  for (const r of rows) {
    const blob = r?.[blobField];
    if (!blob) {
      out.push(r);
      continue;
    }
    try {
      const dec = await decryptJsonWithOrgKey(orgKey, blob);
      out.push({ ...r, ...dec });
    } catch {
      // Keep record, but avoid screaming __encrypted__ everywhere.
      out.push({ ...r, _bf_decrypt_failed: true });
    }
  }
  return out;
}

function StatusPill({ status }) {
  const s = safeStr(status).toLowerCase();
  const isGood = s === "accepted" || s === "fulfilled" || s === "completed";
  const isMid = s === "offered" || s === "open";
  const style = {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.12)",
    background: isGood
      ? "rgba(80, 200, 120, 0.18)"
      : isMid
        ? "rgba(255, 200, 80, 0.18)"
        : "rgba(255,255,255,0.06)",
  };
  return <span style={style}>{s || "status"}</span>;
}

export default function Overview() {
  const nav = useNavigate();
  const { orgId } = useParams();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [people, setPeople] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [pledges, setPledges] = useState([]);
  const [subs, setSubs] = useState([]);

  const orgKey = useMemo(() => (orgId ? getCachedOrgKey(orgId) : null), [orgId]);

  const go = (tab) => nav(`/org/${encodeURIComponent(orgId)}/${tab}`);

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      // Pull enough to render the "home" view properly.
      const [p, inv, n, m, pl, ns] = await Promise.all([
        api(`/api/orgs/${encodeURIComponent(orgId)}/people`),
        api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`),
        api(`/api/orgs/${encodeURIComponent(orgId)}/needs`),
        api(`/api/orgs/${encodeURIComponent(orgId)}/meetings`),
        api(`/api/orgs/${encodeURIComponent(orgId)}/pledges`),
        api(`/api/orgs/${encodeURIComponent(orgId)}/newsletter/subscribers`),
      ]);

      const ppl = Array.isArray(p?.people) ? p.people : [];
      const invRows = Array.isArray(inv?.inventory) ? inv.inventory : [];
      const needRows = Array.isArray(n?.needs) ? n.needs : [];
      const meetRows = Array.isArray(m?.meetings) ? m.meetings : [];
      const pledgeRows = Array.isArray(pl?.pledges) ? pl.pledges : [];
      const subRows = Array.isArray(ns?.subscribers) ? ns.subscribers : [];

      // Decrypt what we can.
      const [pplD, invD, needD, meetD] = await Promise.all([
        tryDecryptList(orgKey, ppl, "encrypted_blob"),
        tryDecryptList(orgKey, invRows, "encrypted_blob"),
        tryDecryptList(orgKey, needRows, "encrypted_blob"),
        tryDecryptList(orgKey, meetRows, "encrypted_blob"),
      ]);

      setPeople(pplD);
      setInventory(invD);
      setNeeds(needD);
      setMeetings(meetD);
      setPledges(pledgeRows);
      setSubs(subRows);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const counts = useMemo(() => {
    const needsOpen = needs.filter((x) => safeStr(x.status).toLowerCase() === "open").length;
    const meetingsUpcoming = meetings.filter((x) => Number(x.starts_at) > Date.now()).length;
    const pledgeActive = pledges.filter((x) => {
      const s = safeStr(x.status).toLowerCase();
      return s === "offered" || s === "accepted";
    }).length;
    return {
      people: people.length,
      inventory: inventory.length,
      needsOpen,
      needsAll: needs.length,
      meetingsUpcoming,
      pledgesActive: pledgeActive,
    };
  }, [people, inventory, needs, meetings, pledges]);

  const nextMeetings = useMemo(() => {
    const arr = meetings
      .map((x) => ({ ...x, starts_at_n: Number(x.starts_at) }))
      .filter((x) => Number.isFinite(x.starts_at_n))
      .sort((a, b) => a.starts_at_n - b.starts_at_n);
    const now = Date.now();
    const upcoming = arr.filter((x) => x.starts_at_n >= now);
    return upcoming.slice(0, 3);
  }, [meetings]);

  const invByCat = useMemo(() => {
    const m = new Map();
    for (const it of inventory) {
      const cat = safeStr(it.category || it.kind || it.type || "uncategorized").trim() || "uncategorized";
      const qty = Number(it.qty);
      const prev = m.get(cat) || { cat, qty: 0, low: 0 };
      prev.qty += Number.isFinite(qty) ? qty : 0;
      // crude "low" counter: items with qty <= 10
      if (Number.isFinite(qty) && qty <= 10) prev.low += 1;
      m.set(cat, prev);
    }
    const arr = Array.from(m.values()).sort((a, b) => b.qty - a.qty);
    const top = arr.slice(0, 4);
    const maxQty = Math.max(1, ...top.map((x) => x.qty));
    return { top, maxQty, more: Math.max(0, arr.length - top.length) };
  }, [inventory]);

  const openNeeds = useMemo(() => {
    const arr = needs
      .filter((x) => safeStr(x.status).toLowerCase() === "open")
      .map((x) => ({
        ...x,
        pr: Number(x.priority) || 0,
        urg: safeStr(x.urgency || "").toLowerCase(),
      }))
      .sort((a, b) => {
        // urgency first
        const w = (u) => (u === "high" ? 3 : u === "medium" ? 2 : u === "low" ? 1 : 0);
        const du = w(b.urg) - w(a.urg);
        if (du) return du;
        return b.pr - a.pr;
      });
    return arr.slice(0, 4);
  }, [needs]);

  const subsSorted = useMemo(() => {
    const arr = subs
      .map((x) => ({ ...x, created_at_n: Number(x.created_at) }))
      .sort((a, b) => (b.created_at_n || 0) - (a.created_at_n || 0));
    return arr;
  }, [subs]);

  const subsThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return subsSorted.filter((s) => (Number(s.created_at) || 0) >= weekAgo);
  }, [subsSorted]);

  const subsSpark = useMemo(() => {
    // 14-day bucketed counts.
    const days = 14;
    const now = new Date();
    const buckets = Array.from({ length: days }, () => 0);
    for (const s of subsSorted) {
      const t = Number(s.created_at);
      if (!Number.isFinite(t)) continue;
      const d = new Date(t);
      const diffDays = Math.floor((now - d) / (24 * 60 * 60 * 1000));
      const idx = days - 1 - diffDays;
      if (idx >= 0 && idx < days) buckets[idx] += 1;
    }
    // cumulative so it looks like growth.
    let run = 0;
    return buckets.map((x) => (run += x));
  }, [subsSorted]);

  const recentPledges = useMemo(() => {
    const arr = pledges
      .map((x) => ({ ...x, created_at_n: Number(x.created_at) }))
      .sort((a, b) => (b.created_at_n || 0) - (a.created_at_n || 0));
    return arr.slice(0, 4);
  }, [pledges]);

  if (!orgId) return <div style={{ padding: 16 }}>No org selected.</div>;

  const pageStyle = {
    padding: 16,
    // Let the whole page scroll, not some miserable inner div.
    overflow: "visible",
  };

  const statsRowStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 12,
    alignItems: "stretch",
  };

  const statsRowWrapStyle = {
    overflowX: "auto",
    paddingBottom: 4,
  };

  const statCardStyle = {
    padding: 14,
    minWidth: 180,
  };

  const statTopStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };
  const statNumStyle = { fontSize: 34, fontWeight: 900, lineHeight: 1.05, marginTop: 6 };

  return (
    <div style={pageStyle}>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, flex: 1 }}>Dashboard</h1>
          <button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>
        {err ? (
          <div className="helper" style={{ color: "tomato", marginTop: 10 }}>
            {err}
          </div>
        ) : null}
      </div>

      {/* Top counts row (one row; scroll horizontally on narrow screens) */}
      <div style={statsRowWrapStyle}>
        <div style={statsRowStyle}>
          <div className="card" style={statCardStyle}>
            <div style={statTopStyle}>
              <div style={{ fontWeight: 800 }}>People</div>
              <button className="btn" onClick={() => go("people")} style={{ padding: "6px 10px" }}>
                View
              </button>
            </div>
            <div style={statNumStyle}>{counts.people}</div>
            <div className="helper">members</div>
          </div>

          <div className="card" style={statCardStyle}>
            <div style={statTopStyle}>
              <div style={{ fontWeight: 800 }}>Inventory</div>
              <button className="btn" onClick={() => go("inventory")} style={{ padding: "6px 10px" }}>
                View
              </button>
            </div>
            <div style={statNumStyle}>{counts.inventory}</div>
            <div className="helper">items</div>
          </div>

          <div className="card" style={statCardStyle}>
            <div style={statTopStyle}>
              <div style={{ fontWeight: 800 }}>Needs</div>
              <button className="btn" onClick={() => go("needs")} style={{ padding: "6px 10px" }}>
                View
              </button>
            </div>
            <div style={statNumStyle}>{counts.needsOpen}</div>
            <div className="helper">open</div>
          </div>

          <div className="card" style={statCardStyle}>
            <div style={statTopStyle}>
              <div style={{ fontWeight: 800 }}>Meetings</div>
              <button className="btn" onClick={() => go("meetings")} style={{ padding: "6px 10px" }}>
                View
              </button>
            </div>
            <div style={statNumStyle}>{counts.meetingsUpcoming}</div>
            <div className="helper">upcoming</div>
          </div>

          <div className="card" style={statCardStyle}>
            <div style={statTopStyle}>
              <div style={{ fontWeight: 800 }}>Pledges</div>
              <button className="btn" onClick={() => go("settings")} style={{ padding: "6px 10px" }}>
                View
              </button>
            </div>
            <div style={statNumStyle}>{counts.pledgesActive}</div>
            <div className="helper">active</div>
          </div>

          <div className="card" style={statCardStyle}>
            <div style={statTopStyle}>
              <div style={{ fontWeight: 800 }}>New Subs</div>
              <button className="btn" onClick={() => go("settings")} style={{ padding: "6px 10px" }}>
                View
              </button>
            </div>
            <div style={statNumStyle}>{subsThisWeek.length}</div>
            <div className="helper">this week</div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div
        className="grid"
        style={{
          marginTop: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* Next Meetings */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Next Meetings</h2>
            <button className="btn" onClick={() => go("meetings")}>
              View all
            </button>
          </div>
          {nextMeetings.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {nextMeetings.map((m) => (
                <div
                  key={m.id}
                  className="card"
                  style={{ padding: 12, border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900 }}>
                        {safeStr(m.title || m.name || "(meeting)") === "__encrypted__" || m._bf_decrypt_failed
                          ? "(encrypted)"
                          : safeStr(m.title || m.name || "(meeting)")}
                      </div>
                      <div className="helper" style={{ marginTop: 4 }}>
                        {fmtDT(m.starts_at)}
                        {m.ends_at ? ` to ${fmtDT(m.ends_at)}` : ""}
                      </div>
                    </div>
                    <button
                      className="btn-red"
                      type="button"
                      onClick={() => go("meetings")}
                      style={{ whiteSpace: "nowrap" }}
                      title="Go to meetings"
                    >
                      RSVP
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>
              Next: <strong>not scheduled</strong>
            </div>
          )}
        </div>

        {/* Inventory at a glance */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Inventory at a Glance</h2>
            <button className="btn" onClick={() => go("inventory")}>
              Manage
            </button>
          </div>

          {invByCat.top.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {invByCat.top.map((c) => {
                const pct = clamp01(c.qty / invByCat.maxQty);
                return (
                  <div key={c.cat} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <div style={{ fontWeight: 900, flex: 1, minWidth: 0 }}>{c.cat}</div>
                      <div className="helper">{Math.round(c.qty)}</div>
                      {c.low ? <div className="helper" style={{ color: "#f5c16c" }}>{`Low: ${c.low}`}</div> : null}
                    </div>
                    <div
                      style={{
                        height: 10,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.08)",
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.10)",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(2, pct * 100)}%`,
                          height: "100%",
                          background: "rgba(255,0,0,0.55)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              {invByCat.more ? <div className="helper">+ {invByCat.more} more categories</div> : null}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>
              No inventory yet.
            </div>
          )}
        </div>

        {/* New this week: subs + pledge summary */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>New This Week</h2>
            <button className="btn" onClick={() => go("settings")}>
              View
            </button>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 18, flex: 1 }}>{`+ ${subsThisWeek.length} subscribers`}</div>
              <div style={{ width: 160, color: "rgba(255,255,255,0.72)" }}>
                <Sparkline points={subsSpark} />
              </div>
            </div>

            {subsThisWeek.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {subsThisWeek.slice(0, 3).map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <div style={{ fontWeight: 900, flex: 1, minWidth: 0 }}>{safeStr(s.name || "subscriber")}</div>
                    <div className="helper" style={{ whiteSpace: "nowrap" }}>{fmtDT(s.created_at)}</div>
                  </div>
                ))}
                {subsThisWeek.length > 3 ? <div className="helper">+ {subsThisWeek.length - 3} more</div> : null}
              </div>
            ) : (
              <div className="helper">No new subscribers yet.</div>
            )}

            <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "2px 0" }} />

            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{`+ ${counts.pledgesActive} active pledges`}</div>
              <div className="helper" style={{ flex: 1 }}>offered or accepted</div>
            </div>

            <button className="btn" type="button" onClick={() => go("settings")} style={{ width: "fit-content" }}>
              View Pledge Board
            </button>
          </div>
        </div>

        {/* Open needs */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Open Needs</h2>
            <button className="btn" onClick={() => go("needs")}>
              View all
            </button>
          </div>
          {openNeeds.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {openNeeds.map((n) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900 }}>
                      {safeStr(n.title) === "__encrypted__" || n._bf_decrypt_failed ? "(encrypted)" : safeStr(n.title || "(need)")}
                    </div>
                    <div className="helper" style={{ marginTop: 2 }}>
                      {n.urg ? `${n.urg} urgency` : ""}
                      {Number.isFinite(Number(n.priority)) ? ` · priority ${Number(n.priority)}` : ""}
                    </div>
                  </div>
                  <StatusPill status={n.urg || "open"} />
                </div>
              ))}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>
              No open needs.
            </div>
          )}
        </div>

        {/* Recent pledges */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Recent Pledges</h2>
            <button className="btn" onClick={() => go("settings")}>
              View all
            </button>
          </div>

          {recentPledges.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {recentPledges.map((p) => {
                const who = safeStr(p.pledger_name || "someone").trim() || "someone";
                const type = safeStr(p.type || "pledge").trim() || "pledge";
                const amount = safeStr(p.amount).trim();
                const unit = safeStr(p.unit).trim();
                const qty = amount ? `${amount}${unit ? ` ${unit}` : ""}` : "";
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {who}
                      </div>
                      <div className="helper" style={{ marginTop: 2 }}>
                        {type}
                        {qty ? ` · ${qty}` : ""}
                      </div>
                      <div className="helper">{fmtDT(p.created_at)}</div>
                    </div>
                    <StatusPill status={p.status} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>
              No pledges yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
