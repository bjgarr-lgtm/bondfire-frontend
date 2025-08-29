import React, { createContext, useContext, useMemo, useState } from 'react';
import { apiFetch, setToken, setRefreshToken, clearTokens, setOnUnauthorized } from '../utils/api';

const AuthCtx = createContext(null);
export function useAuth(){
  const ctx = useContext(AuthCtx);
  if(!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }){
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // if the API ever returns 401, clear tokens
  useMemo(() => {
    setOnUnauthorized(() => { clearTokens(); setUser(null); });
    return () => setOnUnauthorized(null);
  }, []);

  async function login({ email, password, mfa, remember }){
    setLoading(true);
    try{
      const data = await apiFetch('/api/auth/login', { method:'POST', body: { email, password, mfa }});
      setToken(data.token, !!remember);
      if (data.refreshToken) setRefreshToken(data.refreshToken, !!remember);
      setUser({ email: data.email, name: data.name });
      return { ok: true };
    }catch(e){ return { ok:false, error:e.message }; }
    finally{ setLoading(false); }
  }

  async function register({ name, email, password }){
    setLoading(true);
    try{
      await apiFetch('/api/auth/register', { method:'POST', body: { name, email, password }});
      return { ok:true };
    }catch(e){ return { ok:false, error:e.message }; }
    finally{ setLoading(false); }
  }

  async function sendMagicLink(email){
    try{ await apiFetch('/api/auth/magic-link', { method:'POST', body:{ email } }); return { ok:true }; }
    catch(e){ return { ok:false, error:e.message }; }
  }

  async function forgotPassword(email){
    try{ await apiFetch('/api/auth/forgot-password', { method:'POST', body:{ email } }); return { ok:true }; }
    catch(e){ return { ok:false, error:e.message }; }
  }

  function signOut(){
    clearTokens();
    setUser(null);
    window.location.assign('/'); // back to public home
  }

  const value = { user, loading, login, register, sendMagicLink, forgotPassword, signOut };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
