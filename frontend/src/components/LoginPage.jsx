import React, { useState } from 'react';
import { ShieldCheck, LogIn, Loader2, Crown, Search, Building2, Eye, EyeOff } from 'lucide-react';

const ROLES = [
  {
    icon: Crown,
    color: '#818cf8',
    title: 'Administrator / IQAC',
    text: 'Full access: all institutes and departments, auditor allocation, dashboard and result comparison.',
    hint: 'admin'
  },
  {
    icon: Search,
    color: '#38bdf8',
    title: 'Academic Auditor',
    text: 'Evaluates only the departments and criteria allocated by the Admin, and signs off ATRs.',
    hint: 'auditor.<name>'
  },
  {
    icon: Building2,
    color: '#f59e0b',
    title: 'Head of Department',
    text: "Views the auditor's report for their own department and enters the Action Taken Report.",
    hint: 'hod.<dept>@<college>.ac.in'
  }
];

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.status === 'success') {
        onLogin(data.user);
      } else {
        setError(data.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('Cannot reach the server. Make sure the Django backend is running.');
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(1200px 600px at 15% -10%, rgba(79, 70, 229, 0.18), transparent 60%), radial-gradient(900px 500px at 110% 110%, rgba(6, 182, 212, 0.12), transparent 60%), var(--bg-main)'
    }}>
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px'
      }}>
        <div className="animate-fade-in" style={{
          width: '100%',
          maxWidth: '980px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '28px',
          alignItems: 'center'
        }}>

          {/* Brand & role overview */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)',
                flexShrink: 0
              }}>
                <ShieldCheck size={30} color="#ffffff" />
              </div>
              <div>
                <h1 style={{ fontWeight: 800, fontSize: '1.45rem', letterSpacing: '-0.02em', color: '#f8fafc' }}>
                  KRGI Academic Audit System
                </h1>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  K. Ramakrishnan Group of Institutions • KRCT • KRCE • MKCE
                </div>
              </div>
            </div>

            <span className="badge" style={{ background: '#1e293b', color: '#818cf8', border: '1px solid #334155', marginBottom: '18px' }}>
              NBA Tier-I Aligned • Criteria C1 – C9
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px' }}>
              {ROLES.map(r => {
                const Icon = r.icon;
                return (
                  <div key={r.title} style={{
                    display: 'flex',
                    gap: '12px',
                    background: 'rgba(17, 24, 39, 0.7)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px'
                  }}>
                    <Icon size={18} color={r.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#e2e8f0' }}>{r.title}</div>
                      <div style={{ fontSize: '0.775rem', color: '#94a3b8' }}>{r.text}</div>
                      <code style={{ fontSize: '0.7rem', color: r.color }}>{r.hint}</code>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Login form */}
          <section style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '28px',
            boxShadow: 'var(--shadow-card)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
              Sign in
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '20px' }}>
              Use the login issued to you by the IQAC office. What you can see depends on your role.
            </p>

            {error && (
              <div role="alert" style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                marginBottom: '14px'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label htmlFor="login-username" style={labelStyle}>Email or Username</label>
                <input
                  id="login-username"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="e.g. hod.cs@krct.ac.in"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="login-password" style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ justifyContent: 'center', padding: '10px', marginTop: '6px', opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                {submitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '18px' }}>
              Forgot your password? Contact the IQAC Administrator to have it reset.
            </p>
          </section>
        </div>
      </main>

      <footer style={{ padding: '14px 16px', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
        KRGI Academic Audit System • NBA Tier-I Self Assessment Report (SAR) Criteria 1-9
      </footer>
    </div>
  );
}
