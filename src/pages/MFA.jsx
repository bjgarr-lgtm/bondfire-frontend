import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import QRCode from 'qrcode';

export default function MFA() {
  const [secret, setSecret] = useState('');
  const [otpURL, setOtpURL] = useState('');
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Get a fresh temp secret + otpauth URL from backend
        const data = await apiFetch('/api/auth/mfa/setup', { method: 'GET' });
        const s = data.secret || data.base32 || '';
        const u = data.otpauthUrl || data.otpauth_url || '';
        setSecret(s);
        setOtpURL(u);
        if (u) setQr(await QRCode.toDataURL(u));
      } catch (e) {
        setMsg(e?.message || 'Failed to start 2FA setup');
      }
    })();
  }, []);

  async function onEnable(e) {
    e.preventDefault();
    setMsg('');
    const token = code.trim();
    if (token.length < 6) {
      setMsg('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    try {
      // Send both token + secret; servers that don’t need secret will ignore it.
      await apiFetch('/api/auth/mfa/verify', {
        method: 'POST',
        body: { token, secret },
      });
      setMsg('✅ 2FA enabled. Keep your authenticator device safe.');
    } catch (e) {
      setMsg(e?.message || 'Failed to enable 2FA');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ maxWidth: 520 }}>
        <h2>Set up 2FA</h2>

        {qr ? (
          <img src={qr} alt="Scan this QR in your authenticator app" style={{ width: 200, height: 200 }} />
        ) : (
          <p className="helper">Waiting for QR…</p>
        )}

        <p className="helper" style={{ marginTop: 8 }}>
          Scan with Google Authenticator, Authy, etc. Manual secret:&nbsp;
          <code>{secret || '—'}</code>
        </p>

        <form onSubmit={onEnable} className="grid" style={{ gap: 8 }}>
          <label className="grid" style={{ gap: 6 }}>
            <span className="helper">6-digit code</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              autoComplete="one-time-code"
            />
          </label>

          {msg && <div className={msg.startsWith('✅') ? 'success' : 'error'}>{msg}</div>}

          <button className="primary" type="submit" disabled={loading || code.length < 6}>
            {loading ? 'Enabling…' : 'Enable 2FA'}
          </button>
        </form>
      </div>
    </div>
  );
}
