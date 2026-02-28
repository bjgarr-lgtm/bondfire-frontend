// src/pages/Overview.jsx
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
    return new Date(n).toLocaleString(undefined, {
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

function isEncryptedNameLike(v) {
  const s = String(v || "").trim().toLowerCase();
  return s === "__encrypted__" || s === "_encrypted_" || s === "(encrypted)" || s === "encrypted";
}

// NOTE: some endpoints return encrypted_blob (snake) while others return encryptedBlob (camel).
// This helper accepts either without forcing page-specific hacks.
async function tryDecryptList(orgId, rows, blobField = "encrypted_blob") {
  const arr = Array.isArray(rows) ? rows : [];
  const orgKey = getCachedOrgKey(orgId);
  if (!orgKey) return arr;

  const out = [];
  for (const r of arr) {
    const blob =
      (r && r[blobField]) ||
      (r && r.encrypted_blob) ||
      (r && r.encryptedBlob) ||
      (r && r.encrypted_description) ||
      (r && r.encryptedDescription);

    if (r && blob) {
      try {
        const decStr = await decryptWithOrgKey(orgKey, blob);
        const dec = JSON.parse(decStr);
        out.push({ ...r, ...dec });
        continue;
      } catch {
        // fall through
      }
    }
    out.push(r);
  }
  return out;
}

function readSessionDeltas(orgId) {
  try {
    return JSON.parse(sessionStorage.getItem(`bf_dash_deltas_${orgId}`) || "{}") || {};
  } catch {
    return {};
  }
}

function writeSessionDeltas(orgId, deltas) {
  try {
    sessionStorage.setItem(`bf_dash_deltas_${orgId}`, JSON.stringify(deltas || {}));
  } catch {}
}
function readPrevCounts(orgId) {
  try {
    return JSON.parse(localStorage.getItem(`bf_dash_counts_${orgId}`) || "{}") || {};
  } catch {
    return {};
  }
}

function writePrevCounts(orgId, counts) {
  try {
    localStorage.setItem(`bf_dash_counts_${orgId}`, JSON.stringify(counts || {}));
  } catch {}
}

function deltaBadge(delta) {
  if (!Number.isFinite(delta) || delta === 0) return null;
  const up = delta > 0;
  const txt = up ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`;
  const bg = up ? "rgba(0, 200, 120, 0.18)" : "rgba(255, 80, 80, 0.18)";
  const bd = up ? "rgba(0, 200, 120, 0.35)" : "rgba(255, 80, 80, 0.35)";
  const fg = up ? "#b8ffe4" : "#ffd0d0";
  return { txt, style: { padding: "3px 8px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: bg, border: `1px solid ${bd}`, color: fg } };
}

function pill(text, tone) {
  const tones = {
    accepted: { bg: "rgba(0, 200, 120, 0.18)", bd: "rgba(0, 200, 120, 0.35)", fg: "#b8ffe4" },
    offered: { bg: "rgba(255, 200, 0, 0.14)", bd: "rgba(255, 200, 0, 0.35)", fg: "#ffe9a8" },
    urgent: { bg: "rgba(255, 80, 80, 0.18)", bd: "rgba(255, 80, 80, 0.38)", fg: "#ffd0d0" },
    high: { bg: "rgba(255, 140, 0, 0.16)", bd: "rgba(255, 140, 0, 0.34)", fg: "#ffd6a8" },
    medium: { bg: "rgba(120, 180, 255, 0.14)", bd: "rgba(120, 180, 255, 0.32)", fg: "#cfe3ff" },
    low: { bg: "rgba(255, 255, 255, 0.08)", bd: "rgba(255, 255, 255, 0.18)", fg: "#e9e9e9" },
  };
  const t = tones[tone] || tones.low;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: t.bg, border: `1px solid ${t.bd}`, color: t.fg, letterSpacing: ".2px" }}>
      {text}
    </span>
  );
}

function readInvPar(orgId) {
  try {
    return JSON.parse(localStorage.getItem(`bf_inv_par_${orgId}`) || "{}") || {};
  } catch {
    return {};
  }
}

function writeInvPar(orgId, obj) {
  try {
    localStorage.setItem(`bf_inv_par_${orgId}`, JSON.stringify(obj || {}));
  } catch {}
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

  const [counts, setCounts] = useState({});
  const [people, setPeople] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [subs, setSubs] = useState([]);
  const [pledges, setPledges] = useState([]);

  const [rsvpMsg, setRsvpMsg] = useState("");

  const prevCounts = useMemo(() => readPrevCounts(orgId), [orgId]);
  const [tickerDeltas, setTickerDeltas] = useState(() => (orgId ? readSessionDeltas(orgId) : {}));
  useEffect(() => {
    if (orgId) setTickerDeltas(readSessionDeltas(orgId));
  }, [orgId]);

  function countsNormalizedRef(c) {
    const cc = c || {};
    return {
      people: Number(cc.people || 0),
      inventory: Number(cc.inventory || 0),
      needsOpen: Number(cc.needsOpen || cc.needs || 0),
      meetingsUpcoming: Number(cc.meetingsUpcoming || 0),
      pledgesActive: Number(cc.pledgesActive || cc.pledges || 0),
      subsTotal: Number(cc.subscribers || cc.subs || 0),
    };
  }

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    setRsvpMsg("");
    try {
      // Dashboard endpoint (counts + some previews)
      const d = await api(`/api/orgs/${encodeURIComponent(orgId)}/dashboard`);

      const rawCounts = d?.counts || {};
      setCounts(rawCounts);

      // Pull previews if present, otherwise fetch lists
      const pplRaw = Array.isArray(d?.people) ? d.people : (await api(`/api/orgs/${encodeURIComponent(orgId)}/people`))?.people;
      const invRaw = Array.isArray(d?.inventory) ? d.inventory : (await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`))?.items;

      // Some dashboard previews are scrubbed (no encrypted_blob), which breaks categories/decrypt.
      let invRawFinal = invRaw;
      const invLooksScrubbed = Array.isArray(invRaw) && invRaw.length > 0 && invRaw.some((it) => {
        const cat = (it && (it.category || it.cat)) || "";
        const blob = it && (it.encrypted_blob || it.encryptedBlob);
        const nm = String(it && (it.name || it.title || "")).toLowerCase();
        return !blob && (!cat || cat === "" || cat === "__encrypted__" || cat === "_encrypted_") && (nm.includes("encrypted") || nm === "");
      });
      if (invLooksScrubbed) {
        try {
          const invFull = await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`);
          invRawFinal = Array.isArray(invFull?.items) ? invFull.items : invRaw;
        } catch {
          invRawFinal = invRaw;
        }
      }

      const needsRaw = Array.isArray(d?.needs) ? d.needs : (await api(`/api/orgs/${encodeURIComponent(orgId)}/needs`))?.needs;

      // Some dashboard previews are scrubbed (missing priority/urgency/encrypted_blob). If so, fetch full needs list.
      let needsRawFinal = needsRaw;
      const needsLooksScrubbed = Array.isArray(needsRaw) && needsRaw.length > 0 && needsRaw.some((n) => {
        const hasPriority = n && Object.prototype.hasOwnProperty.call(n, "priority");
        const blob = n && (n.encrypted_blob || n.encryptedBlob);
        const title = String(n && (n.title || "")).toLowerCase();
        return !hasPriority || (!blob && (title.includes("encrypted") || title === "__encrypted__" || title === "_encrypted_"));
      });
      if (needsLooksScrubbed) {
        try {
          const needsFull = await api(`/api/orgs/${encodeURIComponent(orgId)}/needs`);
          needsRawFinal = Array.isArray(needsFull?.needs) ? needsFull.needs : needsRaw;
        } catch {
          needsRawFinal = needsRaw;
        }
      }

      const meetsRaw = Array.isArray(d?.meetings) ? d.meetings : (await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings`))?.meetings;

      // These live under Settings pages, so fetch directly.
      const subsResp = await api(`/api/orgs/${encodeURIComponent(orgId)}/newsletter/subscribers`);
      const pledgesResp = await api(`/api/orgs/${encodeURIComponent(orgId)}/pledges`);

      const pplDec = await tryDecryptList(orgId, pplRaw, "encrypted_blob");
      const invDec = await tryDecryptList(orgId, invRawFinal, "encrypted_blob");
      const needsDec = await tryDecryptList(orgId, needsRawFinal, "encrypted_blob");
      const meetsDec = await tryDecryptList(orgId, meetsRaw, "encrypted_blob");
      const subsDec = await tryDecryptList(orgId, subsResp?.subscribers || [], "encrypted_blob");
      const pledgesDec = await tryDecryptList(orgId, pledgesResp?.pledges || [], "encrypted_blob");

      setPeople(Array.isArray(pplDec) ? pplDec : []);
      setInventory(Array.isArray(invDec) ? invDec : []);
      setNeeds(Array.isArray(needsDec) ? needsDec : []);
      setMeetings(Array.isArray(meetsDec) ? meetsDec : []);
      setSubs(Array.isArray(subsDec) ? subsDec : []);
      setPledges(Array.isArray(pledgesDec) ? pledgesDec : []);

      // Persist ticker deltas for this session so they don't disappear after refresh.
      try {
        const existing = readSessionDeltas(orgId);
        if (!existing || Object.keys(existing).length === 0) {
          const pc = prevCounts || {};
          const cn = countsNormalizedRef(rawCounts);
          const nextDeltas = {
            people: cn.people - Number(pc.people || 0),
            inventory: cn.inventory - Number(pc.inventory || 0),
            needsOpen: cn.needsOpen - Number(pc.needsOpen || 0),
            meetingsUpcoming: cn.meetingsUpcoming - Number(pc.meetingsUpcoming || 0),
            pledgesActive: cn.pledgesActive - Number(pc.pledgesActive || 0),
            subsTotal: cn.subsTotal - Number(pc.subsTotal || 0),
          };
          writeSessionDeltas(orgId, nextDeltas);
          setTickerDeltas(nextDeltas);
        }
      } catch {}

      // Save latest counts for the *next login* baseline.
      writePrevCounts(orgId, rawCounts);
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

  if (!orgId) return <div style={{ padding: 16 }}>No org selected.</div>;

  const go = (tab) => nav(`/org/${encodeURIComponent(orgId)}/${tab}`);

  const countsNormalized = useMemo(() => {
    const c = counts || {};
    return {
      people: Number(c.people || 0),
      inventory: Number(c.inventory || 0),
      needsOpen: Number(c.needsOpen || 0),
      meetingsUpcoming: Number(c.meetingsUpcoming || 0),
      pledgesActive: Number(c.pledgesActive || c.pledges || 0),
      subsTotal: Number(c.subscribers || c.subs || 0),
    };
  }, [counts]);

  const deltas = useMemo(() => {
    const sd = tickerDeltas && Object.keys(tickerDeltas).length ? tickerDeltas : null;
    if (sd) return sd;
    const pc = prevCounts || {};
    return {
      people: countsNormalized.people - Number(pc.people || 0),
      inventory: countsNormalized.inventory - Number(pc.inventory || 0),
      needsOpen: countsNormalized.needsOpen - Number(pc.needsOpen || 0),
      meetingsUpcoming: countsNormalized.meetingsUpcoming - Number(pc.meetingsUpcoming || 0),
      pledgesActive: countsNormalized.pledgesActive - Number(pc.pledgesActive || 0),
      subsTotal: countsNormalized.subsTotal - Number(pc.subsTotal || 0),
    };
  }, [countsNormalized, prevCounts, tickerDeltas]);

  const topCards = useMemo(() => {
    const mk = (key, title, icon, value, sub, to) => {
      const db = deltaBadge(deltas[key]);
      return {
        key,
        title,
        icon,
        value,
        sub,
        to,
        badge: db,
      };
    };
    return [
      mk("people", "People", "👥", countsNormalized.people, "members", "people"),
      mk("inventory", "Inventory", "📦", countsNormalized.inventory, "items", "inventory"),
      mk("needsOpen", "Needs", "🧾", countsNormalized.needsOpen, "open", "needs"),
      mk("meetingsUpcoming", "Meetings", "📅", countsNormalized.meetingsUpcoming, "upcoming", "meetings"),
      mk("pledgesActive", "Pledges", "🤝", countsNormalized.pledgesActive, "active", "settings?tab=pledges"),
      mk("subsTotal", "New Subs", "📰", countsNormalized.subsTotal, "total", "settings?tab=newsletter"),
    ];
  }, [countsNormalized, deltas]);

  const meetingsSorted = useMemo(() => {
    const arr = Array.isArray(meetings) ? meetings : [];
    return arr
      .filter((m) => Number(m?.starts_at) > 0)
      .sort((a, b) => Number(a.starts_at) - Number(b.starts_at))
      .slice(0, 3);
  }, [meetings]);

  const needsOpen = useMemo(() => {
    const arr = Array.isArray(needs) ? needs : [];
    return arr
      .filter((n) => String(n?.status || "").toLowerCase() === "open")
      .sort((a, b) => Number(b?.priority || 0) - Number(a?.priority || 0))
      .slice(0, 6);
  }, [needs]);

  const subsSorted = useMemo(() => {
    const arr = Array.isArray(subs) ? subs : [];
    return arr
      .slice()
      .sort((a, b) => Number(b?.joined || b?.created_at || 0) - Number(a?.joined || a?.created_at || 0))
      .slice(0, 6);
  }, [subs]);

  const pledgesSorted = useMemo(() => {
    const arr = Array.isArray(pledges) ? pledges : [];
    return arr
      .slice()
      .sort((a, b) => Number(b?.created_at || 0) - Number(a?.created_at || 0))
      .slice(0, 6);
  }, [pledges]);

  const invPar = useMemo(() => readInvPar(orgId), [orgId]);

  // Category stats (Option C): show up to 6 categories with qty/par bars.
  const invCatStats = useMemo(() => {
    const arr = Array.isArray(inventory) ? inventory : [];
    const parMap = invPar || {};
    const map = new Map();

    for (const it of arr) {
      const qtyV = Number(it?.qty);
      const qty = Number.isFinite(qtyV) ? qtyV : 0;

      const catRaw = (it && (it.category ?? it.cat ?? it.Category ?? it.CATEGORY)) ?? "";
      let cat = safeStr(catRaw).trim();
      if (!cat) {
        try {
          for (const k of Object.keys(it || {})) {
            if (String(k).toLowerCase() === "category") {
              cat = safeStr(it[k]).trim();
              break;
            }
          }
        } catch {}
      }
      cat = (cat || "uncategorized").toLowerCase();

      const id = it?.id != null ? String(it.id) : "";
      const parV = Number(parMap?.[id]);
      const par = Number.isFinite(parV) && parV > 0 ? parV : 0;

      const cur = map.get(cat) || { category: cat, qty: 0, par: 0, items: 0 };
      cur.qty += qty;
      cur.par += par;
      cur.items += 1;
      map.set(cat, cur);
    }

    const out = Array.from(map.values()).map((x) => {
      const pct = x.par > 0 ? x.qty / x.par : null;
      return {
        ...x,
        pct,
        pctClamped: x.par > 0 ? Math.max(0, Math.min(1, pct)) : 0,
      };
    });

    // Prefer categories with a par set, ordered by how low they are.
    out.sort((a, b) => {
      const ap = a.pct == null ? 999 : a.pct;
      const bp = b.pct == null ? 999 : b.pct;
      if (ap !== bp) return ap - bp;
      return (b.qty || 0) - (a.qty || 0);
    });

    return out.slice(0, 6);
  }, [inventory, invPar]);

  // Low items list: up to 4 items that are below par (qty/par < 1).
  const invLowItems = useMemo(() => {
    const arr = Array.isArray(inventory) ? inventory : [];
    const parMap = invPar || {};
    const lows = [];

    for (const it of arr) {
      const id = it?.id != null ? String(it.id) : "";
      const raw = parMap?.[id];
      // treat "" as unset
      if (raw === "" || raw == null) continue;
      const parV = Number(raw);
      const par = Number.isFinite(parV) && parV > 0 ? parV : 0;
      if (!par) continue;

      const qtyV = Number(it?.qty);
      const qty = Number.isFinite(qtyV) ? qtyV : 0;
      const pct = qty / par;
      if (pct < 1) {
        lows.push({
          id,
          name: it?.name,
          category: it?.category,
          qty,
          par,
          pct,
        });
      }
    }

    lows.sort((a, b) => a.pct - b.pct);
    return lows.slice(0, 4);
  }, [inventory, invPar]);

  async function rsvp(meeting) {
    if (!orgId || !meeting?.id) return;
    setRsvpMsg("");
    try {
      // If your backend doesn't support this yet, you'll get a 404 and we fall back.
      await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_id: meeting.id }),
      });
      setRsvpMsg("RSVP saved.");
    } catch (e) {
      // fallback: still useful navigation
      setRsvpMsg("RSVP endpoint not available yet. Opening meetings.");
      go("meetings");
    }
  }

  const cardBtnStyle = {
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer",
  };

  return (
    <div style={{ padding: 16 }}>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, flex: 1, minWidth: 180 }}>{orgInfo?.name || "Dashboard"}</h1>
          <button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>
        {err ? <div className="helper" style={{ color: "tomato", marginTop: 10 }}>{err}</div> : null}
        {rsvpMsg ? <div className="helper" style={{ marginTop: 10 }}>{rsvpMsg}</div> : null}
      </div>

      {/* Top metrics row: ONE row on desktop, wraps on small screens */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        {topCards.map((c) => (
          <button key={c.key} type="button" style={cardBtnStyle} onClick={() => go(c.to)}>
            <div className="card" style={{ padding: 14, position: "relative", minHeight: 98 }}>
              {c.badge ? (
                <div style={{ position: "absolute", top: 12, right: 12 }}>
                  <span style={c.badge.style}>{c.badge.txt}</span>
                </div>
              ) : null}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 18 }}>{c.icon}</div>
                <div style={{ fontWeight: 900 }}>{c.title}</div>
              </div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{c.value}</div>
              <div className="helper" style={{ marginTop: 6 }}>{c.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* Next meetings */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, flex: 1 }}>Next Meetings</h2>
            <button className="btn" type="button" onClick={() => go("meetings")}>
              View all
            </button>
          </div>
          {meetingsSorted.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {meetingsSorted.map((m) => (
                <div key={m.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 900, flex: 1, minWidth: 0 }}>
                      {isEncryptedNameLike(m?.title) ? "(encrypted)" : safeStr(m?.title || "meeting")}
                    </div>
                    <button className="btn-red" type="button" onClick={() => rsvp(m)}>
                      RSVP
                    </button>
                  </div>
                  <div className="helper" style={{ marginTop: 6 }}>
                    {fmtDT(m?.starts_at)}{m?.location ? ` · ${safeStr(m.location)}` : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>No upcoming meetings.</div>
          )}
        </div>

        {/* Inventory glance */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, flex: 1 }}>Inventory at a Glance</h2>
            <button className="btn" type="button" onClick={() => go("inventory")}>
              Manage
            </button>
          </div>

          {invCatStats.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {invCatStats.map((x) => {
                const pct = x.par > 0 ? x.pctClamped : 0;
                const label = x.category;
                return (
                  <div key={label} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontWeight: 800, flex: 1, minWidth: 0 }}>{label}</div>
                      <div className="helper" style={{ whiteSpace: "nowrap" }}>
                        {Math.round(x.qty)}{x.par ? ` / ${Math.round(x.par)}` : ""}
                      </div>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct * 100}%`, background: "rgba(255,0,0,0.55)" }} />
                    </div>
                  </div>
                );
              })}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: 10, flexWrap: "wrap" }}>
                <div className="helper">
                  {invLowItems.length ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div className="helper" style={{ fontWeight: 800 }}>Low items</div>
                      {invLowItems.map((it) => {
                        const pct = Math.max(0, Math.min(1, it.pct));
                        const nm = isEncryptedNameLike(it?.name) ? "(encrypted)" : safeStr(it?.name || "item");
                        const cat = safeStr(it?.category || "uncategorized").toLowerCase();
                        return (
                          <div key={it.id} style={{ display: "grid", gap: 4 }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                              <div style={{ fontWeight: 800, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nm}</div>
                              <div className="helper" style={{ whiteSpace: "nowrap" }}>{Math.round(it.qty)} / {Math.round(it.par)}</div>
                            </div>
                            <div className="helper" style={{ marginTop: -2 }}>{cat}</div>
                            <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct * 100}%`, background: "rgba(255,0,0,0.55)" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span>No low items below par.</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>No inventory yet.</div>
          )}
        </div>

        {/* Open needs */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, flex: 1 }}>Open Needs</h2>
            <button className="btn" type="button" onClick={() => go("needs")}>
              View all
            </button>
          </div>

          {needsOpen.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {needsOpen.map((n) => {
                const pr = Number(n?.priority || 0);
                const urgency = String(n?.urgency || "").toLowerCase();
                const tone = urgency === "urgent" ? "urgent" : pr >= 8 ? "high" : pr >= 4 ? "medium" : "low";
                const title = isEncryptedNameLike(n?.title) ? "(encrypted)" : safeStr(n?.title || "need");
                return (
                  <button key={n.id} type="button" className="card" style={{ padding: 12, textAlign: "left", border: "none", cursor: "pointer" }} onClick={() => go("needs")}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      {pill(tone.toUpperCase(), tone)}
                      <div style={{ fontWeight: 900, flex: 1, minWidth: 0 }}>{title}</div>
                    </div>
                    <div className="helper" style={{ marginTop: 6 }}>
                      {urgency ? `${urgency}` : "open"} · priority {pr}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>No open needs.</div>
          )}
        </div>

        {/* Newsletter */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, flex: 1 }}>Newsletter</h2>
            <button className="btn" type="button" onClick={() => go("settings")}>
              View all
            </button>
          </div>

          <div className="helper" style={{ marginTop: 10 }}>
            {subs.length} subscriber{subs.length === 1 ? "" : "s"}
          </div>

          {subsSorted.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {subsSorted.map((s) => {
                const name = isEncryptedNameLike(s?.name) ? "(encrypted)" : safeStr(s?.name || "subscriber");
                const joined = Number(s?.joined || s?.created_at || 0);
                return (
                  <div key={s.id || `${name}-${joined}`} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 800 }}>{name}</div>
                    <div className="helper" style={{ whiteSpace: "nowrap" }}>{fmtDT(joined)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>No subscribers yet.</div>
          )}
        </div>

        {/* Recent pledges */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, flex: 1 }}>Recent Pledges</h2>
            <button className="btn" type="button" onClick={() => go("settings?tab=pledges")}>
              View all
            </button>
          </div>

          {pledgesSorted.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {pledgesSorted.map((p) => {
                const status = String(p?.status || "").toLowerCase();
                const tone = status === "accepted" ? "accepted" : status === "offered" ? "offered" : "low";
                const who = isEncryptedNameLike(p?.pledger_name) ? "someone" : safeStr(p?.pledger_name || "someone");
                const type = safeStr(p?.type || "").trim();
                const amt = p?.amount != null && p?.amount !== "" ? `${p.amount}` : "";
                const unit = safeStr(p?.unit || "").trim();
                const when = fmtDT(p?.created_at);
                return (
                  <div key={p.id} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      {pill(status || "pledge", tone)}
                      <div style={{ fontWeight: 900, flex: 1, minWidth: 0 }}>
                        {who}{type ? ` · ${type}` : ""}
                      </div>
                    </div>
                    <div className="helper">
                      {amt ? `${amt}${unit ? ` ${unit}` : ""} · ` : ""}{when}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 12 }}>No pledges yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
