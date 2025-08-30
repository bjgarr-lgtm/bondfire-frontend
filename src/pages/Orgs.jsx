import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// local storage org list until backend is wired
function loadOrgs(){ try { return JSON.parse(localStorage.getItem('bf_orgs') || '[]'); } catch { return []; } }
function saveOrgs(list){ localStorage.setItem('bf_orgs', JSON.stringify(list)); }

export default function Orgs(){
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState(loadOrgs());
  const [orgName, setOrgName] = useState('');
  const [invite, setInvite] = useState('');

  const go = (id) => navigate(`/org/${id}`); // routes into InnerSanctum

  const onCreate = (e) => {
    e.preventDefault();
    const name = orgName.trim(); if(!name) return;
    const id = 'org_' + Math.random().toString(36).slice(2,8);
    const next = [...orgs, { id, name, role:'owner' }];
    setOrgs(next); saveOrgs(next);
    go(id);
  };

  const onJoin = (e) => {
    e.preventDefault();
    const code = invite.trim(); if(!code) return;
    const id = code.startsWith('org_') ? code : `org_${code}`;
    const name = `Org ${id.slice(-4).toUpperCase()}`;
    const already = orgs.some(o => o.id === id);
    const next = already ? orgs : [...orgs, { id, name, role:'member' }];
    if (!already) { setOrgs(next); saveOrgs(next); }
    go(id);
  };

  const items = useMemo(() => orgs.map(o => (
    <li key={o.id} className="row" style={{justifyContent:'space-between', alignItems:'center', gap:8}}>
      <div>
        <div style={{fontWeight:600}}>{o.name}</div>
        <div className="helper">Role: {o.role}</div>
      </div>
      <button type="button" className="primary" onClick={()=>go(o.id)}>Open</button>
    </li>
  )), [orgs]);

  return (
    <div className="grid" style={{gap:12, paddingTop:12}}>
      <div className="card">
        <h2 style={{margin:'4px 0 8px'}}>Org Dashboard</h2>
        <p className="helper">Choose an organization to enter its workspace, or create/join one.</p>
        <div style={{marginTop:8}}>
          <button className="primary" type="button" onClick={() => window.location.assign('/#/mfa')}>
            Set up 2FA (recommended)
          </button>
        </div>
      </div>

      <div className="grid cols-2" style={{gap:12}}>
        <div className="card">
          <h3>Create a new org</h3>
          <form onSubmit={onCreate} className="grid" style={{gap:8}}>
            <label className="grid" style={{gap:6}}>
              <span className="helper">Organization name</span>
              <input value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="e.g. Bondfire Team" />
            </label>
            <button className="primary" type="submit">Create</button>
          </form>
        </div>

        <div className="card">
          <h3>Join with an invite code</h3>
          <form onSubmit={onJoin} className="grid" style={{gap:8}}>
            <label className="grid" style={{gap:6}}>
              <span className="helper">Invite code</span>
              <input value={invite} onChange={e=>setInvite(e.target.value)} placeholder="Paste invite code" />
            </label>
            <button className="primary" type="submit">Join</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h3>Your orgs</h3>
        {items.length === 0
          ? <p className="helper" style={{marginTop:6}}>You don’t belong to any orgs yet.</p>
          : <ul style={{display:'grid', gap:8, marginTop:8, padding:0, listStyle:'none'}}>{items}</ul>}
      </div>
    </div>
  );
}
