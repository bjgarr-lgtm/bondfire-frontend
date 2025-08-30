// src/pages/OrgPublicPreview.jsx
import * as React from 'react';
import { useParams } from 'react-router-dom';
import PublicPage from './PublicPage.jsx';

// read whatever we’ve saved locally; be tolerant of shapes
function readSettings(orgId) {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(`bf_org_settings_${orgId}`) || '{}'); } catch {}
  try {
    const orgs = JSON.parse(localStorage.getItem('bf_orgs') || '[]');
    const o = orgs.find(x => x?.id === orgId) || {};
    s = { ...o, ...s };
  } catch {}
  return s || {};
}

function toArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string')
    return v.split('\n').map(t => t.trim()).filter(Boolean);
  return [];
}

function toLinks(v) {
  if (Array.isArray(v)) {
    return v
      .map(l => (l && l.url ? { text: l.text || l.url, url: l.url } : null))
      .filter(Boolean);
  }
  if (typeof v === 'string') {
    return v
      .split('\n')
      .map(line => {
        const [text, url] = line.split('|').map(s => (s || '').trim());
        return url ? { text: text || url, url } : null;
      })
      .filter(Boolean);
  }
  return [];
}

export default function OrgPublicPreview() {
  const { orgId } = useParams();
  // read once; if you want live refresh on save, keep your existing bf:org_settings_changed listener
  const s = readSettings(orgId);

  // Always render with best‑effort data (no “enabled” check)
  const title =
    (s.publicTitle || s.title || s.name || 'Public page').trim();
  const about =
    (s.publicAbout || s.about || 'This is a live preview of your public page.').trim();
  const features =
    toArray(s.publicFeatures ?? s.features);
  const links =
    toLinks(s.publicLinks ?? s.links);

  // If literally nothing is configured, show nice defaults so the page isn’t empty.
  const data = {
    public: {
      title,
      about,
      features: features.length ? features : [
        'Mutual aid & community support',
        'Donations & supplies',
        'Volunteer coordination',
      ],
      links: links.length ? links : [
        { text: 'Website', url: 'https://example.org' },
        { text: 'Email',   url: 'mailto:hello@example.org' },
      ],
    }
  };

  return (
    <div style={{ margin: 16 }}>
      <PublicPage data={data} />
    </div>
  );
}
