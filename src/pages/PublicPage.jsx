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

  const [loading, setLoading] = useState(() => (!!slug && !injected));
  const [error, setError] = useState("");
  const [pubData, setPubData] = useState(() => (injected ? injected : null)); // expects { public, orgId }
  const [publicNeeds, setPublicNeeds] = useState([]);

  // Fetch public page config by slug
  useEffect(() => {
    let mounted = true;
    if (!slug || injected) return;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/public/${encodeURIComponent(slug)}`);
        const j = await res.json().catch(() => ({}));
        if (!mounted) return;

        if (!res.ok || j.ok === false) {
          setPubData(null);
          setError(j.error || `HTTP ${res.status}`);
        } else {
          setPubData(j);
        }
      } catch (e) {
        if (mounted) {
          setPubData(null);
          setError(e?.message || "Fetch failed");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [slug, injected]);

  // Fetch public needs by slug (this is the whole point of public needs)
  useEffect(() => {
    let mounted = true;
    if (!slug) return;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/${encodeURIComponent(slug)}/needs`);
        const j = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (!res.ok || j.ok === false) {
          setPublicNeeds([]);
        } else {
          setPublicNeeds(Array.isArray(j.needs) ? j.needs : []);
        }
      } catch {
        if (mounted) setPublicNeeds([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [slug]);

  // Build config + local data
  const { pubCfg, orgId, local } = useMemo(() => {
    // real public route
    if (slug && pubData?.public) {
      const pub = pubData.public;
      const orgIdFromAPI = pubData.orgId || null;

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

    // preview inside logged-in org
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
  }, [slug, pubData, injected]);

  const orgInfo = useMemo(
    () => (orgId ? readOrgInfo(orgId) : { name: "Org", logo: null }),
    [orgId]
  );

  // Filters (inventory is still local-only for now)
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

  // Public needs should come from API when on slug route
  const openNeeds = useMemo(() => {
    const source = slug ? publicNeeds : (local.needs || []);
    return source.filter((n) => {
      const status = (n?.status ?? "open").toLowerCase();
      const isOpen = status === "open";
      const isPublic = slug ? true : !!n?.is_public || !!n?.public;
      return isOpen && isPublic;
    });
  }, [slug, publicNeeds, local.needs]);

  // Forms (still local-only storage for pledges/newsletter for now)
  const onPledge = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = f.get("name")?.toString().trim() || "Anonymous";
    const contact = f.get("contact")?.toString().trim() || "";
    const message = f.get("message")?.toString().trim() || "";
    savePledge({ name, contact, message, orgId, slug });
    e.currentTarget.reset();
    alert("Thanks. Saved.");
  };

  const onNewsletter = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = f.get("email")?.toString().trim() || "";
    if (email) {
      saveNewsletter(email);
      e.currentTarget.reset();
      alert("Added.");
    }
  };

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (error) return <div style={{ padding: 16, color: "crimson" }}>Error: {error}</div>;

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
        {(pubCfg?.logo || orgInfo.logo) && (
          <img
            src={pubCfg?.logo || orgInfo.logo}
            alt="Org logo"
            style={{ height: 48, width: 48, borderRadius: 8, objectFit: "cover" }}
          />
        )}
        <h1 style={{ margin: 0, fontSize: 24 }}>
          {pubCfg?.title || orgInfo.name || slug || "Public Page"}
        </h1>
      </header>

      {pubCfg?.about && <p style={{ lineHeight: 1.6, marginTop: 12 }}>{pubCfg.about}</p>}

      {Array.isArray(pubCfg?.features) && pubCfg.features.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>
            What we do
          </h3>
          <ul style={{ paddingLeft: 18, marginTop: 8 }}>
            {pubCfg.features.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          marginTop: 12,
        }}
      >
        <section className="card" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Inventory (public)
          </h3>

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
                <option key={c} value={c}>
                  {c}
                </option>
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

        <section className="card" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Open needs
          </h3>

          <ul style={{ paddingLeft: 18, marginTop: 8 }}>
            {openNeeds.map((n) => (
              <li key={n.id || n.title}>
                <strong>{n.title || "Untitled"}</strong>
                {n.urgency ? ` · ${n.urgency}` : ""}
              </li>
            ))}
            {openNeeds.length === 0 && <li className="helper">No open needs right now.</li>}
          </ul>

          <details style={{ marginTop: 12 }}>
            <summary className="section-title" style={{ fontSize: 16 }}>
              I can help
            </summary>
            <form onSubmit={onPledge} className="grid" style={{ gap: 8 }}>
              <input className="input" name="name" placeholder="Your name" />
              <input className="input" name="contact" placeholder="Email or phone" required />
              <textarea className="textarea" name="message" placeholder="How you can help" />
              <button className="btn">Send</button>
            </form>
          </details>
        </section>

        <section className="card" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Stay in touch
          </h3>

          <form onSubmit={onNewsletter} className="grid" style={{ gap: 8 }}>
            <input className="input" name="email" type="email" placeholder="you@example.org" required />
            <button className="btn">Join Newsletter</button>
          </form>

          {Array.isArray(pubCfg?.links) && pubCfg.links.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 className="section-title" style={{ marginTop: 0 }}>
                Links
              </h4>
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
