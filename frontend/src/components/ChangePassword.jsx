import React, { useState } from 'react';
import { KeyRound, Loader2, LogOut, X } from 'lucide-react';

// Change the logged-in user's password. `forced` is used after a new or reset password:
// the app stays locked until the password is changed (the server enforces the same rule).
export default function ChangePassword({ forced = false, username, onChanged, onCancel, onLogout }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (next.length < 10) { setError('The new password must have at least 10 characters.'); return; }
    if (next !== confirm) { setError('The two new passwords do not match.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/change-password/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'The password could not be changed.');
      setCurrent(''); setNext(''); setConfirm('');
      onChanged?.(json.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = (label, value, set, auto) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
      {label}
      <input type="password" value={value} onChange={(e) => set(e.target.value)} autoComplete={auto} required />
    </label>
  );

  const box = (
    <form onSubmit={submit} style={{
      width: 'min(420px, 92vw)', background: 'var(--bg-modal)', border: '1px solid var(--border-modal)',
      borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '24px',
      display: 'flex', flexDirection: 'column', gap: '14px', color: 'var(--text-primary)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <KeyRound size={20} color="var(--primary)" />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, flex: 1 }}>{forced ? 'Choose a new password' : 'Change password'}</h2>
        {!forced && <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} title="Close"><X size={14} /></button>}
      </div>
      {forced && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {username ? <><strong>{username}</strong>: </> : null}your password was given to you by the administrator.
          Choose your own password to continue. The old one will stop working.
        </p>
      )}
      {field('Current password', current, setCurrent, 'current-password')}
      {field('New password (at least 10 characters)', next, setNext, 'new-password')}
      {field('Repeat the new password', confirm, setConfirm, 'new-password')}
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        Avoid your name, username or a common password; it cannot be only numbers.
      </p>
      {error && <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--grade-d)', fontWeight: 600 }}>{error}</div>}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        {forced && onLogout && (
          <button type="button" className="btn btn-outline btn-sm" onClick={onLogout}><LogOut size={14} /> Log out</button>
        )}
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Save new password
        </button>
      </div>
    </form>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: forced ? 'var(--login-gradient)' : 'rgba(0, 0, 0, 0.45)'
    }}>
      {box}
    </div>
  );
}
