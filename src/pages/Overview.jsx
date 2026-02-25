// src/pages/Overview.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../utils/api.js";
import { decryptJsonWithOrgKey, decryptWithOrgKey, getCachedOrgKey } from "../lib/zk.js";

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


async function tryDecryptNeedsList(orgKey, rows) {
  if (!orgKey) return rows;
  const out = [];
  for (const r of rows) {
    try {
      if (r?.encrypted_blob) {
        const dec = await decryptJsonWithOrgKey(orgKey, r.encrypted_blob);
        out.push({ ...r, ...dec });
        continue;
      }
      if (r?.encrypted_description) {
        const decStr = await decryptWithOrgKey(orgKey, r.encrypted_description);
        const t = String(decStr || "");
        // Some rows store JSON, some store just a description string.
        if (t.trim().startsWith("{") && t.trim().endsWith("}")) {
          try {
            const obj = JSON.parse(t);
            out.push({ ...r, ...obj });
          } catch {
            out.push({ ...r, description: t });
          }
        } else {
          out.push({ ...r, description: t });
        }
        continue;
      }
      out.push(r);
    } catch {
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


  const go = (tab) => nav(`/org/${encodeURIComponent(orgId)}/${tab}`);

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      const orgKeyNow = getCachedOrgKey(orgId);
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
        tryDecryptList(orgKeyNow, ppl, "encrypted_blob"),
        tryDecryptList(orgKeyNow, invRows, "encrypted_blob"),
        tryDecryptNeedsList(orgKeyNow, needRows),
        tryDecryptList(orgKeyNow, meetRows, "encrypted_blob"),
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

