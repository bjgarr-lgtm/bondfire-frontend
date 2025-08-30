// src/pages/PublicPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

// --- helpers ---------------------------------------------------------------
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
    const o = orgs.find(x => x?.id === orgId) || {};
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

  const title =
    publicCfg?.title ||
    orgSettings?.name ||
    "Your Organization";

  const about = publicCfg?.about || "";
  const features = Array.isArray(publicCfg?.features) ? publicCfg.features : [];
  const links = Array.isArray(publicCfg?.links) ? publicCfg.links : [];

  const logo =
    publicCfg?.logoDataUrl ||
    publicCfg?.logoUrl ||
    orgSettings?.logoDataUrl ||
    orgSettings?.logoUrl ||
    null;

  return { title, about, features, links, logo, enabled: true };
}

function getLocalStateForPublic(orgId) {
  const s =
    readJSON("bf_state", null) ||
    { inventory: [], needs: [], pledges: [], newsletters: [] };

  const byOrg = (arr) =>
    Array.isArray(arr) && arr.some((x) => x && Object.prototype.hasOwnProperty.call(x, "org"))
      ? arr.filter((x) => x?.org === orgId)
      : arr;

  return {
    inventory: byOrg(s.inventory || []),
    needs: byOrg(s.needs || []),
    pledges: s.pledges || [],
    newsletters: s.newsletters || [],
  };
}

function savePledge(p) {
  const list = readJSON("bf_pledges", []);
  list.push({ ...p, id: crypto.randomUUID(), created: Date.now() });
  localStorage.setItem("bf_pledges", JSON.stringify(list));
}

function saveNewsletter(email) {
  const list = readJSON("bf_newsletters", []);
  if (!list.some((n) => n.email?.toLowerCase() === email.toLowerCase())) {
    list.push({ email, created: Date.now() });
    localStorage.setItem("bf_newsletters", JSON.stringify(list));
  }
}

// --- component -------------------------------------------------------------
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

  // Fetch when we have a slug (public route)
  useEffect(() => {
    if (!slug || injected) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/${encodeURIComponent(slug)}`);
        const j = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (!res.ok || j.ok === false) {
          setState({ loading: false, error: j.error || `HTTP ${res.status}`, data: null });
        } else {
          setState({ loading: false, error: "", data: j }); // expect { public, orgId }
        }
      } catch (e) {
        if (mounted) setState({ loading: false, error: e.message, data: null });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug, injected]);

  // Build config + local data (this is where orgId is created)
  const { pubCfg, orgId, local } = useMemo(() => {
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
        },
        orgId: orgIdFromAPI,
        local: getLocalStateForPublic(orgIdFromAPI),
      };
    }

    const oid = parseOrgIdFromHash();
    const cfg = injected?.public
      ? {
          title: injected.public.title || "Your Organization",
          about: injected.public.about || "",
          features: Array.isArray(injected.public.features) ? injected.public.features : [],
          links: Array.isArray(injected.public.links) ? injected.public.links : [],
          logo: injected.public.logoDataUrl || injected.public.logoUrl || null,
          enabled: true,
        }
      : getPreviewConfig(oid);

    return { pubCfg: cfg, orgId: oid, local: getLocalStateForPublic(oid) };
  }, [slug, state.data, injected]);

  // ✅ NOW that orgId exists, read the same logo as OrgDash
  const orgInfo = useMemo(
    () => (orgId ? readOrgInfo(orgId) : { name: "Org", logo: null }),
    [orgId]
  );

  // Filters
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  const cats = useMemo(() => {
    const set = new Set(
      (local.inventory || [])
        .filter((i) => i?.public)
        .map((i) => i?.category)
        .filter(Boolean)
    );
    return Array.from(set);
  }, [local.inventory]);

  const publicItems = useMemo(() => {
    const all = (local.inventory || []).filter((i) => i?.public);
    const text = q.toLowerCase();
    return all.filter(
      (i) =>
        (!text ||
          `${i?.name || ""} ${i?.category || ""} ${i?.location || ""}`.toLowerCase().includes(text)) &&
        (!cat || i?.category === cat)
    );
  }, [local.inventory, q, cat]);

  const openNeeds = useMemo(() => {
    return (local.needs || []).filter((n) => (n?.status ?? "open") === "open");
  }, [local.needs]);

  // Forms
  const onPledge = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = f.get("name")?.toString().trim() || "Anonymous";
    const contact = f.get("contact")?.toString().trim() || "";
    const message = f.get("message")?.toString().trim() || "";
    savePledge({ name, contact, message, orgId });
    e.currentTarget.reset();
    alert("Thanks — we saved your pledge.");
  };

  const onNewsletter = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = f.get("email")?.toString().trim() || "";
    if (email) {
      saveNewsletter(email);
      e.currentTarget.reset();
      alert("You are on the list.");
    }
  };

  if (state.loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (state.error) return <div style={{ padding: 16, color: "crimson" }}>Error: {state.error}</div>;

  // Render
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 0, borderBottom: "1px solid #eee", paddingBottom: 12 }}>
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

      {/* about */}
      {pubCfg?.about && (
        <p style={{ lineHeight: 1.6, marginTop: 12 }}>{pubCfg.about}</p>
      )}

      {/* features */}
      {Array.isArray(pubCfg?.features) && pubCfg.features.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>What we do</h3>
          <ul style={{ paddingLeft: 18, marginTop: 8 }}>
            {pubCfg.features.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* grid cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          marginTop: 12,
        }}
      >
        {/* Inventory (public) */}
        <section className="card" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Inventory (public)</h3>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <input
              className="input"
              placeholder="Search items…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              className="input"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              style={{ width: 120 }}
            >
              <option value="">All</option>
              {cats.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <ul style={{ marginTop: 10, paddingLeft: 18 }}>
            {publicItems.map((i) => (
              <li key={i.id || i.name}>
                <strong>{i.name}</strong>
                {i.qty ? ` — ${i.qty}` : ""} {i.unit || ""} {i.category ? ` · ${i.category}` : ""}
              </li>
            ))}
            {publicItems.length === 0 && <li className="helper">No public items.</li>}
          </ul>
        </section>

        {/* Open needs */}
        <section className="card" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Open needs</h3>
          <ul style={{ paddingLeft: 18, marginTop: 8 }}>
            {openNeeds.map((n) => (
              <li key={n.id || n.title}>
                <strong>{n.title || "Untitled"}</strong>
                {n.status ? ` — ${n.status}` : ""}
              </li>
            ))}
            {openNeeds.length === 0 && <li className="helper">No open needs right now.</li>}
          </ul>

          <details style={{ marginTop: 12 }}>
            <summary className="section-title" style={{ fontSize: 16 }}>I can help</summary>
            <form onSubmit={onPledge} className="grid" style={{ gap: 8 }}>
              <input className="input" name="name" placeholder="Your name" />
              <input className="input" name="contact" placeholder="Email or phone" required />
              <textarea className="textarea" name="message" placeholder="How you can help" />
              <button className="btn">Send</button>
            </form>
          </details>
        </section>

        {/* Newsletter + links */}
        <section className="card" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Stay in touch</h3>
          <form onSubmit={onNewsletter} className="grid" style={{ gap: 8 }}>
            <input className="input" name="email" type="email" placeholder="you@example.org" required />
            <button className="btn">Join Newsletter</button>
          </form>

          {Array.isArray(pubCfg?.links) && pubCfg.links.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 className="section-title" style={{ marginTop: 0 }}>Links</h4>
              <ul style={{ paddingLeft: 18 }}>
                {pubCfg.links.map((l, i) => (
                  <li key={i}>
                    <a href={l.url} target="_blank" rel="noreferrer">
                      {l.text || l.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
