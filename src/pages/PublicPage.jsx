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
  const publicCfg = readJSON(`bf_public_cfg_${orgId}`, null) || readJSON(`bf_public_${orgId}`, null) || null;

  const title = publicCfg?.title || orgSettings?.name || "Your Organization";
  const about = publicCfg?.about || "";
  const features = Array.isArray(publicCfg?.features) ? publicCfg.features : [];
  const links = Array.isArray(publicCfg?.links) ? publicCfg.links : [];
  const logo = publicCfg?.logoDataUrl || publicCfg?.logoUrl || orgSettings?.logoDataUrl || orgSettings?.logoUrl || null;

  return { title, about, features, links, logo, enabled: true };
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
          return;
        }

        setState({ loading: false, error: "", data: j });

        const nRes = await fetch(`${API_BASE}/api/public/${encodeURIComponent(slug)}/needs`);
        const nData = await nRes.json().catch(() => ({}));
        if (!mounted) return;
        setPublicNeeds(Array.isArray(nData.needs) ? nData.needs : []);
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

    return { pubCfg: cfg, orgId: oid };
  }, [slug, state.data, injected]);

  const orgInfo = useMemo(() => (orgId ? readOrgInfo(orgId) : { name: "Org", logo: null }), [orgId]);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  const openNeeds = useMemo(() => {
    return publicNeeds.filter((n) => (n?.status ?? "open") === "open");
  }, [publicNeeds]);

  if (state.loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (state.error) return <div style={{ padding: 16, color: "crimson" }}>Error: {state.error}</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 0, borderBottom: "1px solid #eee", paddingBottom: 12 }}>
        {orgInfo.logo && (
          <img src={orgInfo.logo} alt="Org logo" style={{ height: 48, width: 48, borderRadius: 8, objectFit: "cover" }} />
        )}
        <h1 style={{ margin: 0, fontSize: 24 }}>
          {pubCfg?.title || orgInfo.name || slug || "Public Page"}
        </h1>
      </header>

      {pubCfg?.about && <p style={{ lineHeight: 1.6, marginTop: 12 }}>{pubCfg.about}</p>}

      {Array.isArray(pubCfg?.features) && pubCfg.features.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>What we do</h3>
          <ul style={{ paddingLeft: 18, marginTop: 8 }}>
            {pubCfg.features.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 12 }}>
        <section className="card" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Open needs</h3>
          <ul style={{ paddingLeft: 18, marginTop: 8 }}>
            {openNeeds.map((n) => (
              <li key={n.id || n.title}>
                <strong>{n.title || "Untitled"}</strong>
                {n.urgency ? ` · ${n.urgency}` : ""}
              </li>
            ))}
            {openNeeds.length === 0 && <li className="helper">No open needs right now.</li>}
          </ul>
        </section>

        <section className="card" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Stay in touch</h3>
          <div className="helper">Newsletter and pledges can be wired next.</div>
        </section>
      </div>
    </div>
  );
}
