import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
function authFetch(path, opts = {}) {
  const token = localStorage.getItem('bf_auth_token') || sessionStorage.getItem('bf_auth_token');
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || j.message || `HTTP ${r.status}`);
    return j;
  });
}

export default function OrgDash(){
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [msg, setMsg] = useState('');
  const nav = useNavigate();

  const refreshOrgs = async () => {
    try {
      const r = await authFetch('/api/orgs', { method: 'GET' });
      setOrgs(Array.isArray(r.orgs) ? r.orgs : []);
    } catch (e) {
      // if user isn't logged in yet, keep it quiet
      setMsg(e.message || 'Failed to load orgs');
    }
  };

  useEffect(() => {
    refreshOrgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = (e) => {
    e.preventDefault();
    setMsg('Org creation is currently done during account creation. (Invite-based org creation coming soon.)');
    setTimeout(() => setMsg(''), 2500);
    setName('');
  };
  const join = async (e) => {
    e.preventDefault();
    const code = invite.trim(); if(!code) return;
    setMsg('');
    try {
      await authFetch('/api/invites/redeem', { method: 'POST', body: { code } });
      setInvite('');
      await refreshOrgs();
      setMsg('Joined.');
      setTimeout(() => setMsg(''), 1200);
    } catch (e2) {
      setMsg(e2.message || 'Join failed');
    }
  };
  const open = (id) => nav(`/org/${id}`);

  return (
    <div className="grid" style={{gap:12}}>
      <div className="card"><h1 style={{margin:'4px 0 8px'}}>Org Dashboard</h1>
        <p className="helper">Choose an organization to enter its workspace, or create/join one.</p>
      </div>

<div style={{marginTop:8}}>
  <button
    className="primary"
    type="button"
    onClick={() => window.location.assign('/#/mfa')} // goes to the Auth app's MFA page
  >
    Set up 2FA (recommended)
  </button>
</div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Create a new org</h3>
          <form onSubmit={create} className="grid" style={{gap:8}}>
            <label className="grid" style={{gap:6}}>
              <span className="helper">Organization name</span>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Bondfire Team"/>
            </label>
            <button className="primary" type="submit">Create</button>
          </form>
          <p className="helper" style={{marginTop:8}}>Org creation currently happens during account creation. Invite codes are for joining existing orgs.</p>
        </div>

        <div className="card">
          <h3>Join with an invite code</h3>
          <form onSubmit={join} className="grid" style={{gap:8}}>
            <label className="grid" style={{gap:6}}>
              <span className="helper">Invite code</span>
              <input value={invite} onChange={e=>setInvite(e.target.value)} placeholder="Paste invite code"/>
            </label>
            <button className="primary" type="submit">Join</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h3>Your orgs</h3>
        {msg ? <p className={msg === 'Joined.' ? 'success' : 'error'} style={{marginTop:6}}>{msg}</p> : null}
        {!orgs.length ? <p className="helper" style={{marginTop:6}}>You don’t belong to any orgs yet.</p> :
          <ul style={{display:'grid', gap:8, marginTop:8, listStyle:'none', padding:0}}>
            {orgs.map(o => (
              <li key={o.id} className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:600}}>{o.name}</div>
                  <div className="helper">Role: {o.role}</div>
                </div>
                <button className="btn" onClick={() => nav(`/org/${o.id}/overview`)}>Open</button>
              </li>
            ))}
          </ul>
        }
      </div>
    </div>
  );
}
