import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MFA_ENABLED = (import.meta.env.VITE_AUTH_REQUIRE_2FA || 'false') === 'true';
const MAGIC_LINK_ENABLED = !!import.meta.env.VITE_AUTH_MAGIC_LINK_PATH;
const FORGOT_ENABLED = !!import.meta.env.VITE_AUTH_FORGOT_PASSWORD_PATH;
const REGISTER_ENABLED = !!import.meta.env.VITE_AUTH_REGISTER_PATH;
const POST_LOGIN_URL = import.meta.env.VITE_POST_LOGIN_URL || '';

function Input({label, type='text', value, onChange, placeholder, autoComplete}){
  return (
    <label className="grid" style={{gap:6}}>
      <span className="helper">{label}</span>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} />
    </label>
  );
}

function LoginCard(){
  const { login, loading, sendMagicLink, forgotPassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from?.pathname || '/app';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfa, setMfa] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [lock, setLock] = useState({ fails:0, until:0 });

  const now = Date.now();
  const locked = lock.until && now < lock.until;

  const onSubmit = async (e) => {
    e.preventDefault();
    if(locked) return;
    setErr('');
    const res = await login({ email, password, mfa: MFA_ENABLED ? mfa : undefined, remember });
    if(res.ok){
      if (POST_LOGIN_URL) { window.location.assign(POST_LOGIN_URL); }
      else { navigate(from, { replace:true }); }
    } else {
      const fails = lock.fails + 1;
      setLock({ fails, until: fails >= 3 ? Date.now() + 30000 : 0 });
      setErr(res.error || 'Login failed');
    }
  };

  const onMagic = async () => {
    if(!MAGIC_LINK_ENABLED) return;
    setErr(''); setSent(false);
    const r = await sendMagicLink(email);
    if(r.ok) setSent(true); else setErr(r.error);
  };

  const onForgot = async () => {
    if(!FORGOT_ENABLED) return;
    setErr(''); setResetSent(false);
    const r = await forgotPassword(email);
    if(r.ok) setResetSent(true); else setErr(r.error);
  };

  return (
    <div className="card">
      <h2>Welcome back</h2>
      <form onSubmit={onSubmit} className="grid" style={{gap:8}}>
        <Input label="Email" value={email} onChange={setEmail} placeholder="you@org.org" autoComplete="username email" />
        <div className="row" style={{gap:6}}>
          <label className="grid" style={{gap:6, flex:1}}>
            <span className="helper">Password</span>
            <div className="row" style={{gap:6, width:'100%'}}>
              <input style={{flex:1}} type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              <button type="button" onClick={()=>setShowPw(v=>!v)}>{showPw?'Hide':'Show'}</button>
            </div>
          </label>
        </div>
        {MFA_ENABLED && <Input label="2FA Code" value={mfa} onChange={setMfa} placeholder="123456" autoComplete="one-time-code" />}
        <div className="row" style={{justifyContent:'space-between'}}>
          <label className="row"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} /> <span className="helper">Remember me</span></label>
          <div className="row" style={{gap:8}}>
            {FORGOT_ENABLED && <button type="button" onClick={onForgot}>Forgot password</button>}
            {MAGIC_LINK_ENABLED && <button type="button" onClick={onMagic}>Email me a login link</button>}
          </div>
        </div>
        {err && <div className="error">{err}</div>}
        {sent && <div className="success">If that email exists, a login link was sent.</div>}
        {resetSent && <div className="success">If that email exists, a reset link was sent.</div>}
        <button className="primary" type="submit" disabled={loading || locked}>{locked ? 'Try again in 30s' : (loading ? 'Signing in…' : 'Sign in')}</button>
      </form>
      <p className="helper" style={{marginTop:10}}>Trouble? Contact your org admin.</p>
    </div>
  );
}

function RegisterCard(){
  const { register, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const enabled = import.meta.env.VITE_AUTH_REGISTER_PATH;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setOk(false);
    if(!enabled){ setErr('Registration disabled'); return; }
    const res = await register({ name, email, password });
    if(res.ok){ setOk(true); } else { setErr(res.error || 'Registration failed'); }
  };

  return (
    <div className="card">
      <h2>Create account</h2>
      <form onSubmit={onSubmit} className="grid" style={{gap:8}}>
        <Input label="Name" value={name} onChange={setName} placeholder="Your name" autoComplete="name" />
        <Input label="Email" value={email} onChange={setEmail} placeholder="you@org.org" autoComplete="email" />
        <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="Choose a strong password" autoComplete="new-password" />
        {err && <div className="error">{err}</div>}
        {ok && <div className="success">Account created. You can sign in now.</div>}
        <button className="primary" type="submit" disabled={loading}>Create account</button>
      </form>
      {!enabled && <p className="helper" style={{marginTop:8}}>Registration is disabled on this environment.</p>}
    </div>
  );
}

export default function Home(){
  const features = [
    'Org-scoped workspaces',
    'People & roles tracking',
    'Inventory & low-stock alerts',
    'Needs → pledges → closure',
    'Meetings & notes',
    'Public org pages (share what you choose)'
  ];

  return (
    <div className="grid" style={{gap:12}}>
      <div className="card">
        <h1 style={{margin:'4px 0 8px'}}>Bondfire</h1>
        <p className="helper">Sign in to access your workspace. Public org pages remain available without an account.</p>
      </div>
      <div className="grid cols-2">
        <LoginCard/>
        <RegisterCard/>
      </div>
      <div className="card">
        <h3>What you get</h3>
        <ul style={{lineHeight:1.6, marginTop:6}}>
          {features.map(f => <li key={f}>{f}</li>)}
        </ul>
      </div>
    </div>
  );
}
