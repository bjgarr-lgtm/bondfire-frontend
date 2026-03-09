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

function isSpecialAction(value) {
  const s = String(value || "").trim().toLowerCase();
  return s.startsWith("modal:") || s === "newsletter" || s.startsWith("#");
}

function normalizeUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (isSpecialAction(s)) return s;
  if (/^(https?:\/\/|mailto:|tel:|sms:|signal:)/i.test(s)) return s;
  if (s.startsWith("/")) return s;
  return `https://${s}`;
}

function cleanLinkObject(v) {
  if (!v) return null;
  const label = String(v?.label || v?.text || "").trim();
  const url = normalizeUrl(v?.url || "");
  if (!label || !url) return null;
  return { label, url };
}

function cleanLinkArray(arr, limit = 8) {
  return (Array.isArray(arr) ? arr : [])
    .map(cleanLinkObject)
    .filter(Boolean)
    .slice(0, limit);
}

function cleanStringArray(arr, limit = 8) {
  return (Array.isArray(arr) ? arr : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function getPreviewConfig(orgId) {
  const orgSettings = readJSON(`bf_org_settings_${orgId}`, {});
  const publicCfg = readJSON(`bf_public_cfg_${orgId}`, null) || readJSON(`bf_public_${orgId}`, null) || null;

  const title = publicCfg?.title || orgSettings?.name || "Your Organization";
  const about = publicCfg?.about || "";
  const location = publicCfg?.location || "";
  const logo =
    publicCfg?.logoDataUrl ||
    publicCfg?.logoUrl ||
    orgSettings?.logoDataUrl ||
    orgSettings?.logoUrl ||
    null;

  return {
    title,
    about,
    location,
    logo,
    enabled: true,
    newsletter_enabled: !!publicCfg?.newsletter_enabled,
    pledges_enabled: publicCfg?.pledges_enabled !== false,
    show_action_strip: publicCfg?.show_action_strip !== false,
    show_needs: publicCfg?.show_needs !== false,
    show_meetings: publicCfg?.show_meetings !== false,
    show_what_we_do: publicCfg?.show_what_we_do !== false,
    show_get_involved: !!publicCfg?.show_get_involved,
    show_newsletter_card: !!publicCfg?.show_newsletter_card,
    show_website_button: !!publicCfg?.show_website_button,
    show_available_supplies: publicCfg?.show_available_supplies !== false,
    theme_mode: publicCfg?.theme_mode || "light",
    accent_color: publicCfg?.accent_color || "#6d5efc",
    website_link: cleanLinkObject(publicCfg?.website_link),
    primary_actions: cleanLinkArray(publicCfg?.primary_actions, 3),
    get_involved_links: cleanLinkArray(publicCfg?.get_involved_links, 4),
    what_we_do: cleanStringArray(publicCfg?.what_we_do || publicCfg?.features, 8),
  };
}

async function apiFetch(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, opts);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) throw new Error(j.error || j.message || `HTTP ${res.status}`);
  return j;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

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
  const uid = `${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}@bondfire`;
  const dtstamp = toICSDateUTC(Date.now());
  const dtstart = starts_at ? toICSDateUTC(starts_at) : null;
  const dtend = ends_at ? toICSDateUTC(ends_at) : dtstart;
  const safe = (s) =>
    String(s || "")
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
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

function themeVars(mode, accent) {
  const a = accent || "#6d5efc";
  if (mode === "dark") {
    return {
      "--bfp-bg": "#0f1220",
      "--bfp-surface": "#171b2c",
      "--bfp-surface-2": "#1d2338",
      "--bfp-border": "rgba(255,255,255,0.08)",
      "--bfp-text": "#f5f7ff",
      "--bfp-text-soft": "rgba(245,247,255,0.72)",
      "--bfp-accent": a,
      "--bfp-accent-soft": "rgba(109,94,252,0.16)",
      "--bfp-shadow": "0 18px 48px rgba(0,0,0,0.28)",
    };
  }
  return {
    "--bfp-bg": "#f6f7fb",
    "--bfp-surface": "#ffffff",
    "--bfp-surface-2": "#f9faff",
    "--bfp-border": "rgba(22,27,45,0.08)",
    "--bfp-text": "#232947",
    "--bfp-text-soft": "rgba(35,41,71,0.72)",
    "--bfp-accent": a,
    "--bfp-accent-soft": "rgba(109,94,252,0.12)",
    "--bfp-shadow": "0 18px 48px rgba(32,39,68,0.08)",
  };
}

function actionSpec(raw) {
  const url = String(raw || "").trim();
  if (!url) return { kind: "none", url: "" };
  if (url.startsWith("#")) return { kind: "anchor", url };
  if (url.toLowerCase() === "newsletter") return { kind: "anchor", url: "#newsletter" };
  if (url.toLowerCase().startsWith("modal:")) {
    return { kind: "modal", modal: url.slice(6).trim().toLowerCase(), url };
  }
  return { kind: "external", url: normalizeUrl(url) };
}

function isNeedOpen(need) {
  const status = String(need?.status || "open").trim().toLowerCase();
  return !status || status === "open";
}

function normalizeSupplyQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export default function PublicPage(props) {
  const injected = props?.data || null;
  const { slug } = useParams();

  const [state, setState] = useState(() =>
    injected ? { loading: false, error: "", data: injected } : slug ? { loading: true, error: "", data: null } : { loading: false, error: "", data: null }
  );
  const [publicNeeds, setPublicNeeds] = useState([]);
  const [publicMeetings, setPublicMeetings] = useState([]);
  const [publicSupplies, setPublicSupplies] = useState([]);
  const [supplySelections, setSupplySelections] = useState({});
  const [supplyRequestName, setSupplyRequestName] = useState("");
  const [supplyRequestContact, setSupplyRequestContact] = useState("");
  const [supplyRequestNote, setSupplyRequestNote] = useState("");
  const [supplyMsg, setSupplyMsg] = useState("");
  const [nlEmail, setNlEmail] = useState("");
  const [nlName, setNlName] = useState("");
  const [nlMsg, setNlMsg] = useState("");
  const [selectedNeed, setSelectedNeed] = useState(null);
  const [pledgeName, setPledgeName] = useState("");
  const [pledgeEmail, setPledgeEmail] = useState("");
  const [pledgeType, setPledgeType] = useState("");
  const [pledgeAmount, setPledgeAmount] = useState("");
  const [pledgeUnit, setPledgeUnit] = useState("");
  const [pledgeNote, setPledgeNote] = useState("");
  const [pledgeMsg, setPledgeMsg] = useState("");
  const [activeModal, setActiveModal] = useState(null);
  const [intakeName, setIntakeName] = useState("");
  const [intakeContact, setIntakeContact] = useState("");
  const [intakeDetails, setIntakeDetails] = useState("");
  const [intakeExtra, setIntakeExtra] = useState("");
  const [intakeStatus, setIntakeStatus] = useState("yes");
  const [intakeMsg, setIntakeMsg] = useState("");

  useEffect(() => {
    if (!slug || injected) return;
    let mounted = true;
    (async () => {
      try {
        const j = await apiFetch(`/api/public/${encodeURIComponent(slug)}`);
        if (!mounted) return;
        setState({ loading: false, error: "", data: j });
        const [nData, mData, sData] = await Promise.all([
          apiFetch(`/api/public/${encodeURIComponent(slug)}/needs`).catch(() => ({ needs: [] })),
          apiFetch(`/api/public/${encodeURIComponent(slug)}/meetings`).catch(() => ({ meetings: [] })),
          apiFetch(`/api/public/${encodeURIComponent(slug)}/inventory`).catch(() => ({ items: [] })),
        ]);
        if (!mounted) return;
        setPublicNeeds(Array.isArray(nData.needs) ? nData.needs : []);
        setPublicMeetings(Array.isArray(mData.meetings) ? mData.meetings : []);
        setPublicSupplies(Array.isArray(sData.items) ? sData.items : []);
      } catch (e) {
        if (mounted) setState({ loading: false, error: e?.message || "Load failed", data: null });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug, injected]);

  const { pubCfg, orgId } = useMemo(() => {
    if (slug && state.data?.public) {
      const pub = state.data.public;
      return {
        pubCfg: {
          title: pub.title || slug,
          about: pub.about || "",
          location: pub.location || "",
          logo: pub.logoDataUrl || pub.logoUrl || null,
          enabled: true,
          newsletter_enabled: !!pub.newsletter_enabled,
          pledges_enabled: pub.pledges_enabled !== false,
          show_action_strip: pub.show_action_strip !== false,
          show_needs: pub.show_needs !== false,
          show_meetings: pub.show_meetings !== false,
          show_what_we_do: pub.show_what_we_do !== false,
          show_get_involved: !!pub.show_get_involved,
          show_newsletter_card: !!pub.show_newsletter_card,
          show_website_button: !!pub.show_website_button,
          show_available_supplies: pub.show_available_supplies !== false,
          theme_mode: pub.theme_mode || "light",
          accent_color: pub.accent_color || "#6d5efc",
          website_link: cleanLinkObject(pub.website_link),
          primary_actions: cleanLinkArray(pub.primary_actions, 3),
          get_involved_links: cleanLinkArray(pub.get_involved_links, 4),
          what_we_do: cleanStringArray(pub.what_we_do || pub.features, 8),
        },
        orgId: state.data.orgId || null,
      };
    }
    const oid = parseOrgIdFromHash();
    return { pubCfg: getPreviewConfig(oid), orgId: oid };
  }, [slug, state.data]);

  const orgInfo = useMemo(() => (orgId ? readOrgInfo(orgId) : { name: "Org", logo: null }), [orgId]);
  const openNeeds = useMemo(() => publicNeeds.filter(isNeedOpen), [publicNeeds]);
  const availableSupplies = useMemo(() => {
    return (Array.isArray(publicSupplies) ? publicSupplies : []).filter((item) => Number(item?.qty || 0) > 0);
  }, [publicSupplies]);
  const selectedSupplies = useMemo(() => {
    return availableSupplies
      .filter((item) => {
        const selected = supplySelections?.[String(item.id)];
        return selected && Number(selected.qty || 0) > 0;
      })
      .map((item) => ({
        ...item,
        selectedQty: normalizeSupplyQty(supplySelections?.[String(item.id)]?.qty),
      }));
  }, [availableSupplies, supplySelections]);
  const pageStyle = useMemo(() => themeVars(pubCfg?.theme_mode || "light", pubCfg?.accent_color || "#6d5efc"), [pubCfg]);
  const title = pubCfg?.title || orgInfo.name || slug || "Public Page";

  const heroActions = useMemo(() => {
    const configured = cleanLinkArray(pubCfg?.primary_actions, 3);
    if (configured.length > 0) return configured;
    return [
      { label: "Get Help", url: "modal:get_help" },
      { label: "Offer Help", url: "modal:offer_resources" },
      { label: "Stay Connected", url: "#newsletter" },
    ];
  }, [pubCfg]);

  const involvedActions = useMemo(() => cleanLinkArray(pubCfg?.get_involved_links, 6), [pubCfg]);

  async function subscribe() {
    if (!slug) {
      setNlMsg("Newsletter signup works on the live public page.");
      return;
    }
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
      setNlMsg(e.message || "Subscription failed.");
    }
  }

  async function submitPledge(needId) {
    if (!slug) {
      setPledgeMsg("Pledges work on the live public page.");
      return;
    }
    setPledgeMsg("");
    try {
      await apiFetch(`/api/p/${encodeURIComponent(slug)}/pledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          need_id: needId,
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
      setTimeout(() => setSelectedNeed(null), 800);
    } catch (e) {
      setPledgeMsg(e.message || "Failed to send pledge.");
    }
  }

  function toggleSupplySelection(item) {
    const id = String(item?.id || "");
    if (!id) return;
    setSupplySelections((prev) => {
      const next = { ...(prev || {}) };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = { qty: 1 };
      }
      return next;
    });
  }

  function setSupplySelectionQty(itemId, nextQty) {
    const id = String(itemId || "");
    if (!id) return;
    setSupplySelections((prev) => ({
      ...(prev || {}),
      [id]: { qty: normalizeSupplyQty(nextQty) },
    }));
  }

  async function submitSupplyRequest() {
    if (!slug) {
      setSupplyMsg("Supply requests work on the live public page.");
      return;
    }
    if (selectedSupplies.length === 0) {
      setSupplyMsg("Select at least one supply first.");
      return;
    }
    if (!String(supplyRequestName || "").trim() || !String(supplyRequestContact || "").trim()) {
      setSupplyMsg("Name and contact are required.");
      return;
    }

    setSupplyMsg("");
    try {
      await apiFetch(`/api/p/${encodeURIComponent(slug)}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "inventory_request",
          name: supplyRequestName,
          contact: supplyRequestContact,
          details: selectedSupplies.map((item) => `${item.name || "item"} x ${item.selectedQty}${item.unit ? ` ${item.unit}` : ""}`).join("\n"),
          extra: supplyRequestNote,
          items: selectedSupplies.map((item) => ({
            inventory_id: item.id,
            name: item.name || "",
            qty_requested: item.selectedQty,
            unit: item.unit || "",
            category: item.category || "",
          })),
        }),
      });
      setSupplyMsg("Request sent. The org can review it in their backend.");
      setSupplySelections({});
      setSupplyRequestName("");
      setSupplyRequestContact("");
      setSupplyRequestNote("");
    } catch (e) {
      setSupplyMsg(e.message || "Failed to send supply request.");
    }
  }

  function openModal(kind, payload = null) {
    setIntakeMsg("");
    setActiveModal({ kind, payload });
    setIntakeName("");
    setIntakeContact("");
    setIntakeDetails("");
    setIntakeExtra("");
    setIntakeStatus("yes");
  }

  function closeModal() {
    setActiveModal(null);
    setIntakeMsg("");
  }

  function triggerAction(item) {
    const spec = actionSpec(item?.url);
    if (spec.kind === "modal") {
      openModal(spec.modal);
      return;
    }
    if (spec.kind === "anchor") {
      const el = document.querySelector(spec.url);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (spec.kind === "external" && spec.url) {
      window.open(spec.url, "_blank", "noopener,noreferrer");
    }
  }

  async function submitIntake() {
    if (!activeModal?.kind) return;
    if (!slug) {
      setIntakeMsg("This form works on the live public page.");
      return;
    }

    try {
      if (activeModal.kind === "meeting_rsvp") {
        const meetingId = activeModal?.payload?.id;
        if (!meetingId) throw new Error("Missing meeting.");
        await apiFetch(`/api/p/${encodeURIComponent(slug)}/meetings/${encodeURIComponent(meetingId)}/rsvp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: intakeName,
            contact: intakeContact,
            status: intakeStatus,
            note: intakeExtra,
          }),
        });
        setIntakeMsg("RSVP saved.");
      } else {
        await apiFetch(`/api/p/${encodeURIComponent(slug)}/intake`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: activeModal.kind,
            name: intakeName,
            contact: intakeContact,
            details: intakeDetails,
            extra: intakeExtra,
          }),
        });
        setIntakeMsg("Sent. The org can review it in their backend.");
      }
      setTimeout(closeModal, 900);
    } catch (e) {
      setIntakeMsg(e.message || "Failed to submit.");
    }
  }

  function modalCopy() {
    switch (activeModal?.kind) {
      case "get_help":
        return {
          title: "Request Assistance",
          subtitle: "Share what you need and how to reach you.",
          detailsPlaceholder: "What do you need right now?",
          extraPlaceholder: "Urgency, timing, or anything else the org should know",
          submitLabel: "Send Request",
        };
      case "volunteer":
        return {
          title: "Volunteer",
          subtitle: "Tell the org how you want to help.",
          detailsPlaceholder: "Skills, interests, or what you want to help with",
          extraPlaceholder: "Availability or scheduling notes",
          submitLabel: "Send Volunteer Info",
        };
      case "offer_resources":
        return {
          title: "Offer Resources",
          subtitle: "Describe what you can offer and how to reach you.",
          detailsPlaceholder: "What resources can you offer?",
          extraPlaceholder: "Quantity, timing, pickup details, or extra notes",
          submitLabel: "Send Offer",
        };
      case "meeting_rsvp":
        return {
          title: "RSVP",
          subtitle: activeModal?.payload?.title || "Public meeting",
          submitLabel: "Save RSVP",
        };
      default:
        return { title: "Public Form", subtitle: "", submitLabel: "Send" };
    }
  }

  if (state.loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (state.error) return <div style={{ padding: 16, color: "crimson" }}>Error: {state.error}</div>;

  const copy = modalCopy();

  return (
    <div className="bf-public-v2" style={pageStyle}>
      <div className="bf-public-shell">
        <header className="bf-public-topbar">
          <div className="bf-public-branding">
            {orgInfo.logo ? <img src={orgInfo.logo} alt="Org logo" className="bf-public-logo" /> : null}
            <div>
              <div className="bf-public-titleLine">{title}</div>
              <div className="bf-public-metaLine">
                {[pubCfg?.location, pubCfg?.about].filter(Boolean).join(" · ") || "Mutual aid, coordination, and public needs"}
              </div>
            </div>
          </div>
          {pubCfg?.show_website_button && pubCfg?.website_link?.url ? (
            <a className="bf-public-websiteBtn" href={pubCfg.website_link.url} target="_blank" rel="noreferrer">
              {pubCfg.website_link.label}
            </a>
          ) : null}
        </header>

        {pubCfg?.show_action_strip && heroActions.length > 0 ? (
          <section className="bf-public-actionStrip">
            {heroActions.map((action, idx) => {
              const spec = actionSpec(action.url);
              if (spec.kind === "external") {
                return (
                  <a key={`${action.label}-${idx}`} className="bf-public-actionBtn" href={spec.url} target="_blank" rel="noreferrer">
                    {action.label}
                  </a>
                );
              }
              return (
                <button key={`${action.label}-${idx}`} className="bf-public-actionBtn" type="button" onClick={() => triggerAction(action)}>
                  {action.label}
                </button>
              );
            })}
          </section>
        ) : null}

        <section className="bf-public-mainGrid">
          <div className="bf-public-primaryColumn">
            {pubCfg?.show_available_supplies !== false ? (
              <section className="bf-public-panel">
                <div className="bf-public-sectionHead">
                  <h2>Available Supplies</h2>
                  <p>Select items you need and send one request to the org.</p>
                </div>
                <div className="bf-public-stack">
                  {availableSupplies.length === 0 ? (
                    <div className="bf-public-empty">No public supplies listed right now.</div>
                  ) : (
                    availableSupplies.map((item) => {
                      const id = String(item?.id || "");
                      const selected = !!supplySelections?.[id];
                      const qtyWanted = normalizeSupplyQty(supplySelections?.[id]?.qty || 1);
                      return (
                        <article key={id || item.name} className="bf-public-itemCard" style={{ alignItems: "stretch" }}>
                          <div className="bf-public-itemMain">
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 800 }}>
                                <input type="checkbox" checked={selected} onChange={() => toggleSupplySelection(item)} />
                                <span>{item.name || "Untitled item"}</span>
                              </label>
                              {item.category ? <span className="bf-public-helperText">{item.category}</span> : null}
                            </div>
                            <div className="bf-public-helperText" style={{ marginTop: 6 }}>
                              {Number(item?.qty || 0)}{item?.unit ? ` ${item.unit}` : ""} available
                            </div>
                            {item.notes ? <p style={{ marginTop: 8 }}>{item.notes}</p> : null}
                          </div>
                          <div className="bf-public-buttonRow" style={{ alignItems: "center" }}>
                            {selected ? (
                              <>
                                <span className="bf-public-helperText">Need</span>
                                <input
                                  className="bf-public-input"
                                  type="number"
                                  min="1"
                                  max={Math.max(1, Number(item?.qty || 1))}
                                  value={qtyWanted}
                                  onChange={(e) => setSupplySelectionQty(id, e.target.value)}
                                  style={{ width: 86, paddingInline: 12 }}
                                />
                              </>
                            ) : null}
                            <button className="bf-public-secondaryBtn" type="button" onClick={() => toggleSupplySelection(item)}>
                              {selected ? "Remove" : "Add"}
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
                {selectedSupplies.length > 0 ? (
                  <div className="bf-public-panel" style={{ marginTop: 14, background: "var(--bfp-surface-2)", boxShadow: "none" }}>
                    <div className="bf-public-sectionHead compact">
                      <h2>Request Selected Supplies</h2>
                      <p>{selectedSupplies.length} item{selectedSupplies.length === 1 ? "" : "s"} selected</p>
                    </div>
                    <div className="bf-public-stack" style={{ marginBottom: 12 }}>
                      {selectedSupplies.map((item) => (
                        <div key={`selected-${item.id}`} className="bf-public-itemCard" style={{ paddingBlock: 14 }}>
                          <div className="bf-public-itemMain">
                            <h3>{item.name || "Item"}</h3>
                            <div className="bf-public-helperText">
                              Requesting {item.selectedQty}{item.unit ? ` ${item.unit}` : ""}
                            </div>
                          </div>
                          <button className="bf-public-ghostBtn" type="button" onClick={() => toggleSupplySelection(item)}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="bf-public-formStack">
                      <input className="bf-public-input" value={supplyRequestName} onChange={(e) => setSupplyRequestName(e.target.value)} placeholder="Your name" />
                      <input className="bf-public-input" value={supplyRequestContact} onChange={(e) => setSupplyRequestContact(e.target.value)} placeholder="Email, phone, or other contact" />
                      <textarea className="bf-public-textarea" rows={3} value={supplyRequestNote} onChange={(e) => setSupplyRequestNote(e.target.value)} placeholder="Optional note about pickup, urgency, delivery, or anything else the org should know" />
                      <div className="bf-public-buttonRow">
                        <button className="bf-public-inlineBtn" type="button" onClick={submitSupplyRequest}>Request Selected Items</button>
                        <button className="bf-public-ghostBtn" type="button" onClick={() => { setSupplySelections({}); setSupplyMsg(""); }}>Clear Selection</button>
                      </div>
                      {supplyMsg ? <div className="bf-public-helperText">{supplyMsg}</div> : null}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {pubCfg?.show_needs ? (
              <section className="bf-public-panel">
                <div className="bf-public-sectionHead">
                  <h2>Current Needs</h2>
                  <p>Public needs this org is sharing right now.</p>
                </div>
                <div className="bf-public-stack">
                  {openNeeds.length === 0 ? (
                    <div className="bf-public-empty">No open needs right now.</div>
                  ) : (
                    openNeeds.map((need) => (
                      <article key={need.id || need.title} className="bf-public-itemCard">
                        <div className="bf-public-itemMain">
                          <h3>{need.title || "Untitled need"}</h3>
                          {need.description ? <p>{need.description}</p> : null}
                        </div>
                        {pubCfg?.pledges_enabled ? (
                          <button className="bf-public-inlineBtn" type="button" onClick={() => setSelectedNeed(need)}>
                            Pledge
                          </button>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </section>
            ) : null}

            {pubCfg?.show_meetings ? (
              <section className="bf-public-panel">
                <div className="bf-public-sectionHead">
                  <h2>Public Meetings</h2>
                  <p>Meetings and events shared on the public page.</p>
                </div>
                <div className="bf-public-stack">
                  {publicMeetings.length === 0 ? (
                    <div className="bf-public-empty">No public meetings right now.</div>
                  ) : (
                    publicMeetings.map((m) => {
                      const when = m.starts_at ? new Date(m.starts_at).toLocaleString() : "Time TBD";
                      return (
                        <article key={m.id || m.title} className="bf-public-meetingCard">
                          <div className="bf-public-itemMain">
                            <h3>{m.title || "Untitled meeting"}</h3>
                            <div className="bf-public-meetingMeta">{when}</div>
                            {m.agenda ? <p>{m.agenda}</p> : null}
                            {m.location ? <div className="bf-public-helperText">{m.location}</div> : null}
                          </div>
                          <div className="bf-public-buttonRow">
                            <button className="bf-public-secondaryBtn" type="button" onClick={() => openModal("meeting_rsvp", m)}>
                              RSVP
                            </button>
                            <button
                              className="bf-public-inlineBtn"
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
                                const safeTitle = (m.title || "meeting").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                                downloadICS(ics, `bondfire-${safeTitle || "meeting"}.ics`);
                              }}
                            >
                              Add to Calendar
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="bf-public-secondaryColumn">
            {pubCfg?.show_what_we_do && pubCfg?.what_we_do?.length > 0 ? (
              <section className="bf-public-panel">
                <div className="bf-public-sectionHead compact">
                  <h2>What We Do</h2>
                </div>
                <div className="bf-public-infoList">
                  {pubCfg.what_we_do.map((item, idx) => (
                    <div key={`${item}-${idx}`} className="bf-public-infoItem">{item}</div>
                  ))}
                </div>
              </section>
            ) : null}

            {pubCfg?.show_get_involved && involvedActions.length > 0 ? (
              <section className="bf-public-panel">
                <div className="bf-public-sectionHead compact">
                  <h2>Get Involved</h2>
                </div>
                <div className="bf-public-linkGrid">
                  {involvedActions.map((link, idx) => {
                    const spec = actionSpec(link.url);
                    if (spec.kind === "external") {
                      return (
                        <a key={`${link.label}-${idx}`} className="bf-public-linkTile" href={spec.url} target="_blank" rel="noreferrer">
                          {link.label}
                        </a>
                      );
                    }
                    return (
                      <button key={`${link.label}-${idx}`} className="bf-public-linkTile" type="button" onClick={() => triggerAction(link)}>
                        {link.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {pubCfg?.newsletter_enabled && pubCfg?.show_newsletter_card ? (
              <section className="bf-public-panel" id="newsletter">
                <div className="bf-public-sectionHead compact">
                  <h2>Stay Connected</h2>
                  <p>Get updates about needs and public meetings.</p>
                </div>
                <div className="bf-public-formStack">
                  <input className="bf-public-input" value={nlName} onChange={(e) => setNlName(e.target.value)} placeholder="Your name" />
                  <input className="bf-public-input" value={nlEmail} onChange={(e) => setNlEmail(e.target.value)} placeholder="Email address" />
                  <button className="bf-public-inlineBtn full" type="button" onClick={subscribe}>Subscribe</button>
                  {nlMsg ? <div className="bf-public-helperText">{nlMsg}</div> : null}
                </div>
              </section>
            ) : null}
          </aside>
        </section>
      </div>

      {selectedNeed ? (
        <div className="bf-public-modalWrap" onClick={() => setSelectedNeed(null)}>
          <div className="bf-public-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bf-public-sectionHead compact">
              <h2>Pledge to Help</h2>
              <p>{selectedNeed.title || "Public need"}</p>
            </div>
            <div className="bf-public-formStack">
              <input className="bf-public-input" value={pledgeName} onChange={(e) => setPledgeName(e.target.value)} placeholder="Your name" />
              <input className="bf-public-input" value={pledgeEmail} onChange={(e) => setPledgeEmail(e.target.value)} placeholder="Email or phone" />
              <input className="bf-public-input" value={pledgeType} onChange={(e) => setPledgeType(e.target.value)} placeholder="Type of support" />
              <div className="bf-public-dualInputs">
                <input className="bf-public-input" value={pledgeAmount} onChange={(e) => setPledgeAmount(e.target.value)} placeholder="Amount" />
                <input className="bf-public-input" value={pledgeUnit} onChange={(e) => setPledgeUnit(e.target.value)} placeholder="Unit" />
              </div>
              <textarea className="bf-public-textarea" rows={3} value={pledgeNote} onChange={(e) => setPledgeNote(e.target.value)} placeholder="Optional note" />
              <div className="bf-public-buttonRow">
                <button className="bf-public-inlineBtn" type="button" onClick={() => submitPledge(selectedNeed.id)}>Send Pledge</button>
                <button className="bf-public-ghostBtn" type="button" onClick={() => setSelectedNeed(null)}>Cancel</button>
              </div>
              {pledgeMsg ? <div className="bf-public-helperText">{pledgeMsg}</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {activeModal ? (
        <div className="bf-public-modalWrap" onClick={closeModal}>
          <div className="bf-public-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bf-public-sectionHead compact">
              <h2>{copy.title}</h2>
              {copy.subtitle ? <p>{copy.subtitle}</p> : null}
            </div>
            <div className="bf-public-formStack">
              <input className="bf-public-input" value={intakeName} onChange={(e) => setIntakeName(e.target.value)} placeholder="Your name" />
              <input className="bf-public-input" value={intakeContact} onChange={(e) => setIntakeContact(e.target.value)} placeholder="Email, phone, or other contact" />
              {activeModal.kind === "meeting_rsvp" ? (
                <>
                  <select className="bf-public-input" value={intakeStatus} onChange={(e) => setIntakeStatus(e.target.value)}>
                    <option value="yes">Yes</option>
                    <option value="maybe">Maybe</option>
                    <option value="no">No</option>
                  </select>
                  <textarea className="bf-public-textarea" rows={3} value={intakeExtra} onChange={(e) => setIntakeExtra(e.target.value)} placeholder="Optional note" />
                </>
              ) : (
                <>
                  <textarea className="bf-public-textarea" rows={4} value={intakeDetails} onChange={(e) => setIntakeDetails(e.target.value)} placeholder={copy.detailsPlaceholder} />
                  <textarea className="bf-public-textarea" rows={3} value={intakeExtra} onChange={(e) => setIntakeExtra(e.target.value)} placeholder={copy.extraPlaceholder} />
                </>
              )}
              <div className="bf-public-buttonRow">
                <button className="bf-public-inlineBtn" type="button" onClick={submitIntake}>{copy.submitLabel}</button>
                <button className="bf-public-ghostBtn" type="button" onClick={closeModal}>Cancel</button>
              </div>
              {intakeMsg ? <div className="bf-public-helperText">{intakeMsg}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
