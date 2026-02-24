import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../utils/api.js";
import { decryptWithOrgKey, getCachedOrgKey } from "../lib/zk.js";

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

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

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

      if (d0?.nextMeeting) {
        d.nextMeeting = await tryDecryptRow(orgId, d0.nextMeeting);
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
  const people = data?.people || [];
  const inventory = data?.inventory || [];
  const needs = data?.needs || [];
  const newsletter = data?.newsletter || [];
  const pledges = data?.pledges || [];
  const nextMeeting = data?.nextMeeting || null;

  const go = (tab) => nav(`/org/${encodeURIComponent(orgId)}/${tab}`);

  return (
    <div style={{ padding: 16 }}>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, flex: 1 }}>Dashboard</h1>
          <button className="btn" onClick={() => refresh()} disabled={loading}>
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>
        {err && (
          <div className="helper" style={{ color: "tomato", marginTop: 10 }}>
            {err}
          </div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>

        <div className="card" style={{ padding: 16 }}>
          <h2>People</h2>
          <div className="helper">{counts.people || 0} members</div>
          <ul>{people.slice(0,5).map(p => <li key={p.id}>{p.name}</li>)}</ul>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h2>Inventory</h2>
          <div className="helper">{counts.inventory || 0} items</div>
          <ul>{inventory.slice(0,5).map(i => <li key={i.id}>{i.name}</li>)}</ul>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h2>Needs</h2>
          <div className="helper">{counts.needsOpen || 0} open</div>
          <ul>{needs.slice(0,5).map(n => <li key={n.id}>{n.title}</li>)}</ul>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h2>Meetings</h2>
          <div className="helper">
            Next: {nextMeeting?.title || "Not scheduled"}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h2>Newsletter</h2>
          <div className="helper">{newsletter.length} subscribers</div>
          <ul>{newsletter.slice(0,5).map(s => <li key={s.id}>{s.name} · {s.email}</li>)}</ul>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h2>Pledges</h2>
          <div className="helper">{pledges.length} active</div>
          <ul>{pledges.slice(0,5).map(p => <li key={p.id}>{p.name || p.title}</li>)}</ul>
        </div>

      </div>
    </div>
  );
}
