// src/pages/Reset.jsx
import React, { useMemo, useState } from 'react';
import { apiFetch } from '../utils/api';

const RESET_PATH = import.meta.env.VITE_AUTH_RESET_PASSWORD_PATH || "/api/auth/reset-password";

// NEW: read params from hash (#/reset?...) or search (?...)
function readParams() {
  const hash = window.location.hash || '';
  const qs = hash.includes('?') ? hash.split('?')[1] : window.location.search.slice(1);
  return Object.fromEntries(new URLSearchParams(qs));
}

export default function Reset(){
  // get both token and email
  const { token, email } = useMemo(() => {
    const p = readParams();
    return { token: p.token || '', email: p.email || '' };
  }, []);

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    if(!token){ setMsg('Missing token.'); return; }
    if(!email){ setMsg('Missing email. Use the link you received.'); return; }
    if(pw1.length < 8){ setMsg('Password must be at least 8 characters.'); return; }
    if(pw1 !== pw2){ setMsg('Passwords do not match.'); return; }
    try {
      setLoading(true);
      await apiFetch(RESET_PATH, { method:'POST', body: { token, email, newPassword: pw1 } });
      setMsg('✅ Password updated. You can sign in now.');
    } catch (e) {
      setMsg(e?.message || 'Reset failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="grid" style={{gap:12}}>
      <div className="card" style={{maxWidth:420}}>
        <h2>Reset your password</h2>
        <form onSubmit={onSubmit} className="grid" style={{gap:8}}>
          <label className="grid" style={{gap:6}}>
            <span className="helper">New password</span>
            <input type="password" value={pw1} onChange={e=>setPw1(e.target.value)} placeholder="New password" autoComplete="new-password" />
          </label>
          <label className="grid" style={{gap:6}}>
            <span className="helper">Confirm password</span>
            <input type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Confirm password" autoComplete="new-password" />
          </label>
          <button className="primary" type="submit" disabled={loading}>Set new password</button>
        </form>

        {msg && <p style={{marginTop:8}} className={msg.startsWith('✅') ? 'success' : 'error'}>{msg}</p>}

        {/* helpful hints */}
        {(!token || !email) && (
          <p className="helper" style={{marginTop:8}}>
            No token/email found. Use the link you received, like:
            <code> #/reset?token=…&amp;email=you@example.com </code>
          </p>
        )}
      </div>
    </div>
  );
}
