// src/pages/PublicPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

function readJSON(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function readOrgInfo(orgId) {
  try {
    const s = JSON.parse(localStorage.getItem(`bf_org_settings_${orgId}`) || "{}");
    const orgs = JSON.parse(localStorage.getItem("bf_orgs") || "[]");
    const o = orgs.find((x) => x?.id === orgId) || {};
    return {
      name: s.name || o.name || "Org",
      logo: s.logoDataUrl || s.logoUrl || o.logoDataUrl || o.logoUrl || null,
    };
  } catch {
    return { name: "Org", logo: null };
  }
}

function parseOrgIdFromHash() {
  const m = (window.location.hash || "").match(/#\/org\/([^/]+)\/public/i);
  return m ? decodeURIComponent(m[1]) : null;
}

function getPreviewConfig(orgId) {
  const orgSettings = readJSON(`bf_org_settings_${orgId}`, {});
  const publicCfg =
    readJSON(`bf_public_cfg_${orgId}`, null) ||
    readJSON(`bf_public_${orgId}`, null) ||
    null;

  const title = publicCfg?.title || orgSettings?.name || "Your Organization";
  const about = publicCfg?.about || "";
  const features = Array.isArray(publicCfg?.features) ? publicCfg.features : [];
  const links = Array.isArray(publicCfg?.links) ? publicCfg.links : [];
  const logo =
    publicCfg?.logoDataUrl ||
    publicCfg?.logoUrl ||
    orgSettings?.logoDataUrl ||
    orgSettings?.logoUrl ||
    null;

  return {
    title,
    about,
    features,
    links,
    logo,
    enabled: true,
    newsletter_enabled: !!publicCfg?.newsletter_enabled,
    pledges_enabled: !!publicCfg?.pledges_enabled,
  };
}

async function apiFetch(path, opts = {}) {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, opts);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) throw new Error(j.error || j.message || `HTTP ${res.status}`);
  return j;
}

export default function PublicPage(props) {
  const injected = props?.data || null;
  const { slug } = useParams();

  const [state, setState] = useState(() =>
    injected
      ? { loading: false, error: "", data: injected }
      : slug
      ? { loading: true, error: "", data: null }
      : { loading: false, error: "", data: null }
  );

  const [publicNeeds, setPublicNeeds] = useState([]);
  const [publicInventory, setPublicInventory] = useState([]);
  const [publicMeetings, setPublicMeetings] = useState([]);

  // newsletter form state
  const [nlName, setNlName] = useState("");
  const [nlEmail, setNlEmail] = useState("");
  const [nlMsg, setNlMsg] = useState("");

  // pledge form state (simple, one form reused)
  const [pledgeName, setPledgeName] = useState("");
  const [pledgeEmail, setPledgeEmail] = useState("");
  const [pledgeType, setPledgeType] = useState("");
  const [pledgeAmount, setPledgeAmount] = useState("");
  const [pledgeUnit, setPledgeUnit] = useState("");
  const [pledgeNote, setPledgeNote] = useState("");
  const [pledgeMsg, setPledgeMsg] = useState("");

  useEffect(() => {
    if (!slug || injected) return;

    let mounted = true;

    (async () => {
      try {
        const j = await apiFetch(`/api/public/${encodeURIComponent(slug)}`);
        if (!mounted) return;

        setState({ loading: false, error: "", data: j });

        const nData = await apiFetch(`/api/public/${encodeURIComponent(slug)}/needs`);
        if (!mounted) return;
        setPublicNeeds(Array.isArray(nData.needs) ? nData.needs : []);

        const iData = await apiFetch(`/api/public/${encodeURIComponent(slug)}/inventory`);
        if (!mounted) return;
        // tolerate older responses if they return "inventory" instead of "items"
        const inv = Array.isArray(iData.items) ? iData.items : Array.isArray(iData.inventory) ? iData.inventory : [];
        setPublicInventory(inv);

        const mData = await apiFetch(`/api/public/${encodeURIComponent(slug)}/meetings`);
        if (!mounted) return;
        setPublicMeetings(Array.isArray(mData.meetings) ? mData.meetings : []);
      } catch (e) {
        if (mounted) setState({ loading: false, error: e?.message || "Load failed", data: null });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [slug, injected]);

  const { pubCfg, orgId } = useMemo(() => {
    // live public page
    if (slug && state.data?.public) {
      const pub = state.data.public;
      const orgIdFromAPI = state.data.orgId || null;
      return {
        pubCfg: {
          title: pub.title || slug,
          about: pub.about || "",
          features: Array.isArray(pub.features) ? pub.features : [],
          links: Array.isArray(pub.links) ? pub.links : [],
          logo: pub.logoDataUrl || pub.logoUrl || null,
          enabled: true,
          newsletter_enabled: !!pub.newsletter_enabled,
          pledges_enabled: !!pub.pledges_enabled,
        },
        orgId: orgIdFromAPI,
      };
    }

    // preview inside Settings tab
    const oid = parseOrgIdFromHash();
    const cfg = injected?.public
      ? {
          title: injected.public.title || "Your Organization",
          about: injected.public.about || "",
          features: Array.isArray(injected.public.features) ? injected.public.features : [],
          links: Array.isArray(injected.public.links) ? injected.public.links : [],
          logo: injected.public.logoDataUrl || injected.public.logoUrl || null,
          enabled: true,
          newsletter_enabled: !!injected.public.newsletter_enabled,
          pledges_enabled: !!injected.public.pledges_enabled,
        }
      : getPreviewConfig(oid);

    return { pubCfg: cfg, orgId: oid };
  }, [slug, state.data, injected]);

  const orgInfo = useMemo(
    () => (orgId ? readOrgInfo(orgId) : { name: "Org", logo: null }),
    [orgId]
  );

  const openNeeds = useMemo(() => {
    return publicNeeds.filter((n) => (n?.status ?? "open") === "open");
  }, [publicNeeds]);

  async function subscribe() {
    if (!slug) return;
    setNlMsg("");
    try {
      await apiFetch(`/api/p/${encodeURIComponent(slug)}/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nlName, email: nlEmail }),
      });
      setNlMsg("Subscribed.");
      setNlName("");
      setNlEmail("");
    } catch (e) {
      setNlMsg(e?.message || "Failed.");
    }
  }

  async function submitPledge(needId) {
    if (!slug) return;
    setPledgeMsg("");
    try {
      await apiFetch(`/api/p/${encodeURIComponent(slug)}/pledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          need_id: needId || null,
          pledger_name: pledgeName,
          pledger_email: pledgeEmail,
          type: pledgeType,
          amount: pledgeAmount,
          unit: pledgeUnit,
          note: pledgeNote,
        }),
      });
      setPledgeMsg("Pledge sent. Thank you.");
      setPledgeName("");
      setPledgeEmail("");
      setPledgeType("");
      setPledgeAmount("");
      setPledgeUnit("");
      setPledgeNote("");
    } catch (e) {
      setPledgeMsg(e?.message || "Failed.");
    }
  }

  if (state.loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (state.error) return <div style={{ padding: 16, color: "crimson" }}>Error: {state.error}</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 0,
          borderBottom: "1px solid #eee",
          paddingBottom: 12,
        }}
      >
        {orgInfo.logo && (
          <img
            src={orgInfo.logo}
            alt="Org logo"
            style={{ height: 48, width: 48, borderRadius: 8, objectFit: "cover" }}
          />
        )}
        <h1 style={{ margin: 0, fontSize: 24 }}>
          {pubCfg?.title || orgInfo.name || slug || "Public Page"}
        </h1>
      </header>

      {pubCfg?.about ? <p style={{ lineHeight: 1.6, marginTop: 12 }}>{pubCfg.about}</p> : null}

      {Array.isArray(pubCfg?.features) && pubCfg.features.length > 0 ? (
        <div className="card" style={{ marginTop: 16, padding: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>What we do</h3>
          <ul style={{ paddingLeft: 18, marginTop: 8 }}>
            {pubCfg.features.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          marginTop: 12,
        }}
      >
        <section className="card" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Open needs</h3>
          <ul style={{ paddingLeft: 18, marginTop: 8 }}>
            {openNeeds.map((n) => (
              <li key={n.id || n.title}>
                <strong>{n.title || "Untitled"}</strong>
                {n.urgency ? ` · ${n.urgency}` : ""}
                {pubCfg?.pledges_enabled ? (
                  <div style={{ marginTop: 8 }}>
                    <button className="btn-red" type="button" onClick={() => submitPledge(n.id)}>
                      Pledge to this
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
            {openNeeds.length === 0 ? <li className="helper">No open needs right now.</li> : null}
          </ul>

          {pubCfg?.pledges_enabled ? (
            <div className="card" style={{ padding: 12, border: "1px solid #222", marginTop: 12 }}>
              <div className="helper" style={{ marginBottom: 8 }}>Pledge form</div>
              <div className="grid" style={{ gap: 10 }}>
                <input className="input" value={pledgeName} onChange={(e) => setPledgeName(e.target.value)} placeholder="Your name" />
                <input className="input" value={pledgeEmail} onChange={(e) => setPledgeEmail(e.target.value)} placeholder="Your email (optional)" />
                <div className="grid cols-3" style={{ gap: 10 }}>
                  <input className="input" value={pledgeType} onChange={(e) => setPledgeType(e.target.value)} placeholder="Type (money, food, labor)" />
                  <input className="input" value={pledgeAmount} onChange={(e) => setPledgeAmount(e.target.value)} placeholder="Amount" />
                  <input className="input" value={pledgeUnit} onChange={(e) => setPledgeUnit(e.target.value)} placeholder="Unit (USD, hours, boxes)" />
                </div>
                <textarea className="textarea" rows={2} value={pledgeNote} onChange={(e) => setPledgeNote(e.target.value)} placeholder="Note (optional)" />
                {pledgeMsg ? <div className="helper">{pledgeMsg}</div> : null}
              </div>
            </div>
          ) : null}
        </section>

        <section className="card" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Stay in touch</h3>

          {pubCfg?.newsletter_enabled ? (
            <div style={{ marginTop: 12 }} className="grid">
              <div className="helper">Newsletter signup</div>
              <input className="input" value={nlName} onChange={(e) => setNlName(e.target.value)} placeholder="Name (optional)" />
              <input className="input" value={nlEmail} onChange={(e) => setNlEmail(e.target.value)} placeholder="Email" />
              <button className="btn-red" type="button" onClick={subscribe}>Subscribe</button>
              {nlMsg ? <div className="helper">{nlMsg}</div> : null}
            </div>
          ) : (
            <div className="helper" style={{ marginTop: 8 }}>
              Newsletter signup is not enabled.
            </div>
          )}
        </section>

        {publicInventory.length > 0 ? (
          <section className="card" style={{ padding: 12 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Public inventory</h3>
            <div className="helper" style={{ marginTop: 4 }}>
              Supplies this org has available.
            </div>
            <ul style={{ paddingLeft: 18, marginTop: 8 }}>
              {publicInventory.map((it) => (
                <li key={it.id || it.name}>
                  <strong>{it.name || "Untitled"}</strong>
                  {it.qty != null && it.qty !== "" ? ` · ${it.qty}` : ""}
                  {it.unit ? ` ${it.unit}` : ""}
                  {it.category ? ` · ${it.category}` : ""}
                  {it.location ? ` · ${it.location}` : ""}
                  {it.notes ? <div className="helper" style={{ marginTop: 4 }}>{it.notes}</div> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {publicMeetings.length > 0 ? (
          <section className="card" style={{ padding: 12 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Public meetings</h3>
            <div className="helper" style={{ marginTop: 4 }}>
              Meetings the org chose to share publicly.
            </div>
            <ul style={{ paddingLeft: 18, marginTop: 8 }}>
              {publicMeetings.map((m) => (
                <li key={m.id || m.title}>
                  <strong>{m.title || "Untitled"}</strong>
                  {m.starts_at ? ` · ${new Date(m.starts_at).toLocaleString()}` : ""}
                  {m.location ? ` · ${m.location}` : ""}
                  {m.agenda ? <div className="helper" style={{ marginTop: 4 }}>{m.agenda}</div> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
