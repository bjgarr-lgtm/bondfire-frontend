// Auth v1 stable/frontend/src/pages/PublicOrg.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';

export default function PublicOrg(){
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch(`/api/public/${encodeURIComponent(slug)}`);
        if (alive) setData(res.public);
      } catch (e) {
        if (alive) setErr(e?.message || 'Not found');
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  if (err) {
    return (
      <div className="card">
        <h2>Not found</h2>
        <p className="helper">{err}</p>
      </div>
    );
  }

  if (!data) return (<div className="card"><p>Loading…</p></div>);

  return (
    <div className="grid" style={{gap:12}}>
      <div className="card">
        <h1 style={{margin:'4px 0 8px'}}>{data.title || 'Organization'}</h1>
        {data.about && <p style={{marginTop:6}}>{data.about}</p>}
      </div>

      {!!(data.features?.length) && (
        <div className="card">
          <h3>Highlights</h3>
          <ul style={{lineHeight:1.6, marginTop:6}}>
            {data.features.map((f,i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      {!!(data.links?.length) && (
        <div className="card">
          <h3>Links</h3>
          <ul style={{lineHeight:1.6, marginTop:6}}>
            {data.links.map((l,i) => (
              <li key={i}><a href={l.url} target="_blank" rel="noreferrer">{l.text || l.url}</a></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
