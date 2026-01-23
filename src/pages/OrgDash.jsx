import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// temp local store until real backend
const load = () => { try{ return JSON.parse(localStorage.getItem('bf_orgs')||'[]'); }catch{return []} };
const save = (x) => localStorage.setItem('bf_orgs', JSON.stringify(x));

export default function OrgDash(){
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');
  const [orgs, setOrgs] = useState(load());
  const nav = useNavigate();

  const create = (e) => {
    e.preventDefault();
    const n = name.trim(); if(!n) return;
    const org = { id: 'org_'+Math.random().toString(36).slice(2,8), name:n, role:'owner' };
    const next = [...orgs, org]; setOrgs(next); save(next); setName('');
  };
  const join = (e) => {
    e.preventDefault();
    const code = invite.trim(); if(!code) return;
    const org = { id: code, name: `Org ${code.slice(-4)}`, role:'member' };
    const next = [...orgs, org]; setOrgs(next); save(next); setInvite('');
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
