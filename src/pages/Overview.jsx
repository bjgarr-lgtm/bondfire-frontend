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
  const title =
    String(a?.entity_title || a?.entity_name || a?.title || a?.name || "").trim();
  const entId = String(a?.entity_id || "").trim();
  if (title) return entId ? `${title} (${shortId(entId)})` : title;

  const raw = String(a?.message || "").trim();
  if (!raw) return "";

  const uuidRe =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
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
  const [newsletterPreview, setNewsletterPreview] = useState([]);
  const [pledgesPreview, setPledgesPreview] = useState([]);

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      const d0 = await api(`/api/orgs/${encodeURIComponent(orgId)}/dashboard`);

      // Decrypt dashboard preview rows (if present). This keeps the dashboard readable under ZK.
      const d = { ...d0 };
      d.people = await decryptRows(orgId, d0?.people);
      d.needs = await decryptRows(orgId, d0?.needs);
      d.inventory = await decryptRows(orgId, d0?.inventory);
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

      const countSubs = Number(d?.counts?.newsletter || 0);
      const hasSubsPreview = Array.isArray(d?.newsletter) && d.newsletter.length > 0;
      if (hasSubsPreview) {
        setNewsletterPreview(d.newsletter);
      } else if (countSubs > 0) {
        const s0 = await api(`/api/orgs/${encodeURIComponent(orgId)}/newsletter/subscribers`);
        const sList = Array.isArray(s0?.subscribers) ? s0.subscribers.slice(0, 5) : [];
        setNewsletterPreview(await decryptRows(orgId, sList));
      } else {
        setNewsletterPreview([]);
      }

      const countPledges = Number(d?.counts?.pledges || 0);
      const hasPledgesPreview = Array.isArray(d?.pledges) && d.pledges.length > 0;
      if (hasPledgesPreview) {
        setPledgesPreview(d.pledges);
      } else if (countPledges > 0) {
        const pl0 = await api(`/api/orgs/${encodeURIComponent(orgId)}/pledges`);
        const plList = Array.isArray(pl0?.pledges) ? pl0.pledges.slice(0, 5) : [];
        setPledgesPreview(await decryptRows(orgId, plList));
      } else {
        setPledgesPreview([]);
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
  const newsletter = Array.isArray(data?.newsletter) && data.newsletter.length ? data.newsletter : newsletterPreview;
  const pledges = Array.isArray(data?.pledges) && data.pledges.length ? data.pledges : pledgesPreview;
  const nextMeeting = data?.nextMeeting || null;

  const nextMeetingLabel = useMemo(() => {
    const when = nextMeeting?.starts_at;
    const pretty = fmtDT(when);
    if (!pretty) return "not scheduled";
    return `${pretty}${nextMeeting?.title ? ` · ${nextMeeting.title}` : ""}`;
  }, [nextMeeting]);

  if (!orgId) return <div style={{ padding: 16 }}>No org selected.</div>;

  const go = (tab) => nav(`/org/${encodeURIComponent(orgId)}/${tab}`);
  const goSettingsTab = (tab) => nav(`/org/${encodeURIComponent(orgId)}/settings?tab=${encodeURIComponent(tab)}`);

  return (
    <div style={{ padding: 16 }}>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, flex: 1 }}>{orgInfo?.name || "Dashboard"}</h1>
          <button
            className="btn"
            onClick={() => refresh().catch(console.error)}
            disabled={loading}
          >
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>

        {err ? (
          <div className="helper" style={{ color: "tomato", marginTop: 10 }}>
            {err}
          </div>
        ) : null}
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {/* People */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>People</h2>
            <button className="btn" onClick={() => go("people")}>
              View all
            </button>
          </div>

          <div className="helper" style={{ marginTop: 10 }}>
            {counts.people || 0} member{(counts.people || 0) === 1 ? "" : "s"}
          </div>

          {/* Only show the empty-state if count is truly zero */}
          {(counts.people || 0) === 0 ? (
            <div className="helper" style={{ marginTop: 10 }}>
              No people yet.
            </div>
          ) : Array.isArray(people) && people.length > 0 ? (
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              {people.slice(0, 5).map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          ) : null}
        </div>


        {/* Inventory */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Inventory</h2>
            <button className="btn" onClick={() => go("inventory")}>
              View all
            </button>
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
            <div className="helper" style={{ marginTop: 10 }}>
              No inventory yet.
            </div>
          )}
        </div>

        {/* Needs */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Needs</h2>
            <button className="btn" onClick={() => go("needs")}>
              View all
            </button>
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
            <div className="helper" style={{ marginTop: 10 }}>
              No needs yet.
            </div>
          )}
        </div>

        {/* Meetings */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Meetings</h2>
            <button className="btn" onClick={() => go("meetings")}>
              View all
            </button>
          </div>
          <div className="helper" style={{ marginTop: 10 }}>
            {counts.meetingsUpcoming || 0} upcoming
          </div>
          <div className="helper" style={{ marginTop: 10 }}>
            Next: <strong>{nextMeetingLabel}</strong>
          </div>
        </div>

        {/* Newsletter */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Newsletter</h2>
            <button className="btn" onClick={() => goSettingsTab("newsletter")}>
              View all
            </button>
          </div>
          <div className="helper" style={{ marginTop: 10 }}>
            {counts.newsletter || 0} subscriber{(counts.newsletter || 0) === 1 ? "" : "s"}
          </div>
          {(counts.newsletter || 0) === 0 ? (
            <div className="helper" style={{ marginTop: 10 }}>
              No subscribers yet.
            </div>
          ) : Array.isArray(newsletter) && newsletter.length > 0 ? (
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              {newsletter.slice(0, 5).map((s) => (
                <li key={s.id}>
                  {s.name || "(no name)"}{s.email ? ` · ${s.email}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Pledges */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Pledges</h2>
            <button className="btn" onClick={() => goSettingsTab("pledges")}>
              View all
            </button>
          </div>
          <div className="helper" style={{ marginTop: 10 }}>
            {counts.pledges || 0} pledge{(counts.pledges || 0) === 1 ? "" : "s"}
          </div>
          {(counts.pledges || 0) === 0 ? (
            <div className="helper" style={{ marginTop: 10 }}>
              No pledges yet.
            </div>
          ) : Array.isArray(pledges) && pledges.length > 0 ? (
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              {pledges.slice(0, 5).map((p) => (
                <li key={p.id}>
                  {p.title || p.name || "Pledge"}
                  {typeof p.qty === "number" ? ` (${p.qty}${p.unit ? ` ${p.unit}` : ""})` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
