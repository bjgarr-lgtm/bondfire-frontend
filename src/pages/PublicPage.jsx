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

function normalizeUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function cleanLinks(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map((l) => {
      const text = String(l?.text || l?.url || "").trim();
      const url = normalizeUrl(l?.url || "");
      if (!text || !url) return null;
      return { text, url };
    })
    .filter(Boolean)
    .slice(0, 5); // keep header tight
}



function pad2(n) {
  return String(n).padStart(2, "0");
}

// format ms -> YYYYMMDDTHHMMSSZ
function toICSDateUTC(ms) {
  const d = new Date(Number(ms));
  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

function makeICS({ title, starts_at, ends_at, location, description }) {
  const uid = `${(crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`)}@bondfire`;
  const dtstamp = toICSDateUTC(Date.now());
  const dtstart = starts_at ? toICSDateUTC(starts_at) : null;
  const dtend = ends_at ? toICSDateUTC(ends_at) : dtstart;

  const safe = (s) =>
    String(s || "")
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");

  // If no time, bail out (no .ics)
  if (!dtstart) return null;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bondfire//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    dtend ? `DTEND:${dtend}` : "",
    `SUMMARY:${safe(title || "Public meeting")}`,
    location ? `LOCATION:${safe(location)}` : "",
    description ? `DESCRIPTION:${safe(description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function downloadICS(icsText, filename = "bondfire-meeting.ics") {
  const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
  // inventory request form (feeds into pledges intake so org sees it in Settings → Pledges)
  const [invReqItem, setInvReqItem] = useState(null);
  const [invReqName, setInvReqName] = useState("");
  const [invReqEmail, setInvReqEmail] = useState("");
  const [invReqMsg, setInvReqMsg] = useState("");
  const [invReqStatus, setInvReqStatus] = useState("");

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

  const headerLinks = useMemo(() => cleanLinks(pubCfg?.links), [pubCfg?.links]);

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

  async function submitInventoryRequest(item) {
    if (!slug || !item) return;
    setInvReqStatus("");

    const name = String(invReqName || "").trim();
    if (!name) {
      setInvReqStatus("Please enter your name.");
      return;
    }

    const email = String(invReqEmail || "").trim();
    const msg = String(invReqMsg || "").trim();

    const itemLine = [
      item?.name ? `item: ${item.name}` : "",
      item?.qty != null && item?.qty !== "" ? `qty: ${item.qty}` : "",
      item?.unit ? `unit: ${item.unit}` : "",
      item?.category ? `category: ${item.category}` : "",
      item?.location ? `location: ${item.location}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const note = `inventory request\n${itemLine}\n${msg ? `message: ${msg}` : ""}`.trim();

    try {
      await apiFetch(`/api/p/${encodeURIComponent(slug)}/pledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          need_id: null,
          pledger_name: name,
          pledger_email: email,
          type: "inventory request",
          amount: null,
          unit: null,
          note,
        }),
      });

      setInvReqStatus("Request sent. The org will see it in their pledges list.");
      setInvReqItem(null);
      setInvReqMsg("");
      setInvReqName("");
      setInvReqEmail("");
    } catch (e) {
      setInvReqStatus(e?.message || "Failed.");
    }
  }


  if (state.loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (state.error) return <div style={{ padding: 16, color: "crimson" }}>Error: {state.error}</div>;

  return (
    <div className="bf-public">
      <div className="bf-public-hero">
        <div className="bf-public-heroTop">
          <div className="bf-public-title">
            {orgInfo.logo ? (
              <img src={orgInfo.logo} alt="Org logo" className="bf-public-logo" />
            ) : null}

            <div className="bf-public-titleText">
              <h1 className="bf-public-h1">
                {pubCfg?.title || orgInfo.name || slug || "Public Page"}
              </h1>

              <div className="bf-public-subRow">
                {pubCfg?.about ? (
                  <p className="bf-public-sub">{pubCfg.about}</p>
                ) : (
                  <p className="bf-public-sub" style={{ opacity: 0.75 }}>
                    A public page for this org.
                  </p>
                )}

                {headerLinks.length > 0 ? (
                  <div className="bf-public-subLinks">
                    {headerLinks.map((l, i) => (
                      <a
                        key={`${l.url}-${i}`}
                        className="bf-btn bf-public-linkPill"
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        title={l.url}
                        style={{ textDecoration: "none" }}
                      >
                        {l.text} <span style={{ opacity: 0.8 }}>↗</span>
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="bf-public-heroRight">
            {pubCfg?.newsletter_enabled ? (
              <div className="bf-public-newsletterInline">
                <div className="bf-public-newsletterLabel">newsletter signup</div>

                <div className="bf-public-newsletterRow">
                  <div className="bf-public-newsletterFields">
                    <input
                      className="bf-input bf-public-newsletterInput"
                      value={nlName}
                      onChange={(e) => setNlName(e.target.value)}
                      placeholder="name"
                    />

                    <input
                      className="bf-input bf-public-newsletterInput"
                      value={nlEmail}
                      onChange={(e) => setNlEmail(e.target.value)}
                      placeholder="email"
                    />
                  </div>

                  <button className="bf-btn bf-btn-red bf-public-newsletterBtn" type="button" onClick={subscribe}>
                    subscribe
                  </button>
                </div>

                {nlMsg ? <div className="bf-public-newsletterMsg">{nlMsg}</div> : null}
              </div>
            ) : null}
          </div>

                  </div>



        {Array.isArray(pubCfg?.features) && pubCfg.features.length > 0 ? (

          <div className="card" style={{ marginTop: 16, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
              <h3 className="section-title" style={{ margin: 0, letterSpacing: 0.8 }}>What we do</h3>
            </div>

            {/* links moved to header */}


            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
                marginTop: 12,
              }}
            >
              {pubCfg.features.map((f, i) => (
                <div key={i} className="bf-public-featurePill">
                  {f}
                </div>

              ))}
            </div>

          </div>
        ) : null}

      </div>


      {/* subtle divider between hero and content */}
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)",
          margin: "20px 0 8px",
        }}
      />


      <div className="bf-public-grid">
        {/* Needs */}
        <section className="bf-card">
          <div className="bf-card-header">
            <h3 className="bf-card-title">Open needs</h3>
            <p className="bf-card-hint">What we need right now</p>
          </div>

          <ul className="bf-list">
            {openNeeds.map((n) => (
              <li key={n.id || n.title} className="bf-li">
                <div className="bf-li-top">
                  <div className="bf-li-name">{n.title || "Untitled"}</div>
                  <div className="bf-badges">
                    {n.urgency ? <span className="bf-badge">{n.urgency}</span> : null}
                    {n.category ? <span className="bf-badge">{n.category}</span> : null}
                  </div>
                </div>

                {pubCfg?.pledges_enabled ? (
                  <div className="bf-public-actions">
                    <button
                      className="bf-btn bf-btn-red"
                      type="button"
                      onClick={() => submitPledge(n.id)}
                    >
                      Pledge to this
                    </button>
                  </div>
                ) : null}
              </li>
            ))}

            {openNeeds.length === 0 ? (
              <li className="bf-empty">No open needs right now.</li>
            ) : null}
          </ul>

          {pubCfg?.pledges_enabled ? (
            <>
              <div className="bf-divider" />
              <div className="bf-card" style={{ padding: 12 }}>
                <div className="bf-card-header">
                  <h3 className="bf-card-title">Pledge form</h3>
                  <p className="bf-card-hint">Quick and optional</p>
                </div>

                <div className="bf-form-grid">
                  <input
                    className="bf-input"
                    value={pledgeName}
                    onChange={(e) => setPledgeName(e.target.value)}
                    placeholder="Your name"
                  />
                  <input
                    className="bf-input"
                    value={pledgeEmail}
                    onChange={(e) => setPledgeEmail(e.target.value)}
                    placeholder="Your email or phone number (optional)"
                  />

                  <div className="bf-form-row3">
                    <input
                      className="bf-input"
                      value={pledgeType}
                      onChange={(e) => setPledgeType(e.target.value)}
                      placeholder="Type (money, food, labor)"
                    />
                    <input
                      className="bf-input"
                      value={pledgeAmount}
                      onChange={(e) => setPledgeAmount(e.target.value)}
                      placeholder="Amount"
                    />
                    <input
                      className="bf-input"
                      value={pledgeUnit}
                      onChange={(e) => setPledgeUnit(e.target.value)}
                      placeholder="Unit (USD, hours, boxes)"
                    />
                  </div>

                  <textarea
                    className="bf-textarea"
                    rows={2}
                    value={pledgeNote}
                    onChange={(e) => setPledgeNote(e.target.value)}
                    placeholder="Note (optional)"
                  />

                  {pledgeMsg ? <div className="bf-note">{pledgeMsg}</div> : null}
                </div>
              </div>
            </>
          ) : null}
        </section>

        {publicMeetings.length > 0 ? (
          <section className="bf-card">
            <div className="bf-card-header">
              <h3 className="bf-card-title">Public meetings</h3>
              <p className="bf-card-hint">Events shared publicly</p>
            </div>

            <ul className="bf-list">
              {publicMeetings.map((m) => {
                const when = m.starts_at ? new Date(m.starts_at).toLocaleString() : null;
                return (
                  <li key={m.id || m.title} className="bf-li">
                    <div className="bf-li-top">
                      <div className="bf-li-name">{m.title || "Untitled"}</div>
                      <div className="bf-badges">
                        {when ? <span className="bf-badge">{when}</span> : null}
                        {m.location ? <span className="bf-badge">{m.location}</span> : null}
                      </div>
                    </div>

                    {m.agenda ? <div className="bf-note">{m.agenda}</div> : null}

                    <div className="bf-public-actions">
                      <button
                        className="bf-btn"
                        type="button"
                        onClick={() => {
                          const ics = makeICS({
                            title: m.title,
                            starts_at: m.starts_at,
                            ends_at: m.ends_at,
                            location: m.location,
                            description: m.agenda || "",
                          });
                          if (!ics) return;
                          const safeTitle = (m.title || "meeting")
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/(^-|-$)/g, "");
                          downloadICS(ics, `bondfire-${safeTitle || "meeting"}.ics`);
                        }}
                      >
                        Add to calendar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <section className="bf-card">
            <div className="bf-card-header">
              <h3 className="bf-card-title">Public meetings</h3>
              <p className="bf-card-hint">None shared right now</p>
            </div>
            <div className="bf-empty">No public meetings.</div>
          </section>
        )}


        {/* Inventory */}
        {publicInventory.length > 0 ? (
          <section className="bf-card">
            <div className="bf-card-header">
              <h3 className="bf-card-title">Public inventory</h3>
              <p className="bf-card-hint">Supplies available</p>
            </div>

            <ul className="bf-list">
              {publicInventory.map((it) => (
                <li key={it.id || it.name} className="bf-li">
                  <div className="bf-li-top">
                    <div className="bf-li-name">{it.name || "Untitled"}</div>
                    <div className="bf-badges">
                      {it.qty != null && it.qty !== "" ? (
                        <span className="bf-badge">
                          {it.qty}{it.unit ? ` ${it.unit}` : ""}
                        </span>
                      ) : null}
                      {it.category ? <span className="bf-badge">{it.category}</span> : null}
                      {it.location ? <span className="bf-badge">{it.location}</span> : null}
                    </div>
                  </div>

                  {it.notes ? <div className="bf-note">{it.notes}</div> : null}
                  <div className="bf-public-actions">
                    <button
                      className="bf-btn bf-btn-red"
                      type="button"
                      onClick={() => {
                        setInvReqItem(it);
                        setInvReqStatus("");
                      }}
                    >
                      I need this
                    </button>
                  </div>

                </li>
                
              ))}
            </ul>
            {invReqItem ? (
              <>
                <div className="bf-divider" />
                <div className="bf-card" style={{ padding: 12 }}>
                  <div className="bf-card-header">
                    <h3 className="bf-card-title">Request an item</h3>
                    <p className="bf-card-hint">{invReqItem?.name || "Item"}</p>
                  </div>

                  <div className="bf-form-grid">
                    <input
                      className="bf-input"
                      value={invReqName}
                      onChange={(e) => setInvReqName(e.target.value)}
                      placeholder="Your name"
                    />
                    <input
                      className="bf-input"
                      value={invReqEmail}
                      onChange={(e) => setInvReqEmail(e.target.value)}
                      placeholder="Your email or phone number (optional)"
                    />
                    <textarea
                      className="bf-textarea"
                      rows={2}
                      value={invReqMsg}
                      onChange={(e) => setInvReqMsg(e.target.value)}
                      placeholder="Message (optional). Include urgency, pickup needs, etc."
                    />

                    <div className="bf-public-actions">
                      <button
                        className="bf-btn bf-btn-red"
                        type="button"
                        onClick={() => submitInventoryRequest(invReqItem)}
                      >
                        Send request
                      </button>
                      <button
                        className="bf-btn"
                        type="button"
                        onClick={() => {
                          setInvReqItem(null);
                          setInvReqStatus("");
                          setInvReqMsg("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>

                    {invReqStatus ? <div className="bf-note">{invReqStatus}</div> : null}
                  </div>
                </div>
              </>
            ) : null}

          </section>
        ) : null}

        {/* newsletter moved to header */}


      </div>
    </div>
  );

}
