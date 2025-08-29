import React from 'react';
import { useAuth } from '../context/AuthContext';

const POST_LOGIN_URL = import.meta.env.VITE_POST_LOGIN_URL || '';

export default function AppGate(){
  const { logout } = useAuth();
  const go = () => {
    if (POST_LOGIN_URL) window.location.assign(POST_LOGIN_URL);
  };
  return (
    <div className="grid" style={{gap:12}}>
      <div className="card">
        <h2>You're in ✅</h2>
        <p>Mount your existing app here, or continue to your app if configured.</p>
        <div className="row" style={{gap:8, marginTop:8}}>
          <a className="linkbtn" href="#/mfa">Set up 2FA</a>
          {POST_LOGIN_URL ? <button className="primary" onClick={go}>Continue to your app</button> : null}
          <button onClick={logout}>Sign out</button>
        </div>
        {POST_LOGIN_URL ? <p className="helper" style={{marginTop:8}}>Configured target: {POST_LOGIN_URL}</p> : null}
      </div>
    </div>
  );
}
