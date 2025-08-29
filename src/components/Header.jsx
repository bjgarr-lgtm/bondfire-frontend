import React from 'react';
const POST_LOGIN_URL = import.meta.env.VITE_POST_LOGIN_URL || '/app/';

export default function Header(){
  return (
    <div className="row" style={{gap:10, alignItems:'center', padding:'10px 14px'}}>
      <img src="/logo-bondfire.png" alt="Bondfire" width="24" height="24" />
      <strong>Bondfire</strong>
      <div style={{flex:1}}/>
      <a href={POST_LOGIN_URL} className="chip">App</a>
      <a href="#/" className="chip">Home</a>
    </div>
  );
}
