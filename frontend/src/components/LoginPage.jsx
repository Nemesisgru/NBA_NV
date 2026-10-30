import React, { useState } from 'react';
import { ShieldCheck, LogIn, Loader2, Crown, Search, Building2, Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const ROLES = [
  {
    id: 'admin',
    icon: Crown,
    color: '#818cf8',
    title: 'Administrator / IQAC',
    text: 'Full access: all institutes and departments, auditor allocation, dashboard and result comparison.',
    hint: 'admin',
    samplePass: 'admin123'
  },
  {
    id: 'auditor',
    icon: Search,
    color: '#38bdf8',
    title: 'Academic Auditor',
    text: 'Evaluates only the departments and criteria allocated by the Admin, and signs off ATRs.',
    hint: 'auditor.raman',
    samplePass: 'Audit@2025#'
  },
  {
    id: 'hod',
    icon: Building2,
    color: '#f59e0b',
    title: 'Head of Department',
    text: "Views the auditor's report for their own department and enters the Action Taken Report.",
    hint: 'hod.cs@krct.ac.in',
    samplePass: 'Hod#NQ5NAt9o'
  }
];

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedRoleHint, setSelectedRoleHint] = useState(null);

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
    } catch {
      setError('Cannot reach the server. Make sure the Django backend is running.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleQuickSelect = (role) => {
    setSelectedRoleHint(role.id);
    setForm(prev => ({
      ...prev,
      username: role.hint,
      password: role.samplePass || prev.password
    }));
  };

  const labelStyle = {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    display: 'block',
    marginBottom: '6px'
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--login-gradient)',
        color: 'var(--text-primary)',
        transition: 'background 0.3s ease, color 0.3s ease'
      }}
    >
      {/* Top utility bar with brand and Dark/Light Theme Switcher */}
      <header
        style={{
          width: '100%',
          maxWidth: '1080px',
          margin: '0 auto',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="badge"
            style={{
              background: 'var(--badge-bg)',
              color: 'var(--badge-text)',
              border: '1px solid var(--badge-border)',
              padding: '4px 10px',
              fontSize: '0.725rem'
            }}
          >
            NBA Tier-I SAR Portal
          </span>
        </div>

        {/* Theme Toggle switch */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--role-card-bg)',
            padding: '6px 12px',
            borderRadius: '9999px',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Appearance:
          </span>
          <ThemeToggle id="login-top-theme-toggle" showLabel={true} size="sm" />
        </div>
      </header>

      {/* Main Login Container */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 16px 36px'
        }}
      >
        <div
          className="animate-fade-in"
          style={{
            width: '100%',
            maxWidth: '1000px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '32px',
            alignItems: 'center'
          }}
        >
          {/* Brand & role overview */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #F54927 0%, #f97316 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(245, 73, 39, 0.4)',
                  flexShrink: 0
                }}
              >
                <ShieldCheck size={32} color="#ffffff" />
              </div>
              <div>
                <h1
                  style={{
                    fontWeight: 800,
                    fontSize: '1.5rem',
                    letterSpacing: '-0.025em',
                    color: 'var(--text-primary)',
                    lineHeight: 1.2
                  }}
                >
                  KRGI Academic Audit System
                </h1>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  K. Ramakrishnan Group of Institutions • KRCT • KRCE • MKCE
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <span
                className="badge"
                style={{
                  background: 'var(--badge-bg)',
                  color: 'var(--badge-text)',
                  border: '1px solid var(--badge-border)'
                }}
              >
                NBA Tier-I Aligned • Criteria C1 – C9
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Sparkles size={13} color="var(--primary)" /> Multi-Role Access
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Select role to prefill credentials:
              </div>

              {ROLES.map((r) => {
                const Icon = r.icon;
                const isSelected = selectedRoleHint === r.id;
                return (
                  <div
                    key={r.title}
                    onClick={() => handleRoleQuickSelect(r)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRoleQuickSelect(r);
                      }
                    }}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      background: isSelected ? 'var(--primary-light)' : 'var(--role-card-bg)',
                      border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--role-card-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      boxShadow: 'var(--shadow-card)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    title={`Click to fill ${r.title} credentials`}
                  >
                    <Icon size={20} color={r.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          {r.title}
                        </span>
                        {isSelected && <CheckCircle2 size={15} color="var(--primary)" />}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
                        {r.text}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <code
                          style={{
                            fontSize: '0.7rem',
                            color: r.color,
                            background: 'var(--primary-light)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          User: {r.hint}
                        </code>
                        {r.samplePass && (
                          <code
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--text-muted)',
                              background: 'var(--bg-card-hover)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}
                          >
                            Pass: {r.samplePass}
                          </code>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Login form card */}
          <section
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '30px',
              boxShadow: 'var(--shadow-card)',
              transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Sign in
              </h2>
              {/* Secondary switch inside login card for immediate accessibility */}
              <ThemeToggle id="login-card-theme-toggle" showLabel={false} size="sm" />
            </div>

            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '22px' }}>
              Use the credentials issued by the IQAC office or click any role on the left to prefill.
            </p>

            {error && (
              <div
                role="alert"
                style={{
                  background: 'var(--grade-d-bg)',
                  border: '1px solid var(--grade-d)',
                  color: 'var(--grade-d)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.825rem',
                  marginBottom: '16px',
                  fontWeight: 500
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="login-username" style={labelStyle}>
                  Email or Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="e.g. admin or hod.cs@krct.ac.in"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="login-password" style={labelStyle}>
                  Password
                </label>
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
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      padding: '4px'
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
                style={{
                  justifyContent: 'center',
                  padding: '11px',
                  marginTop: '6px',
                  fontSize: '0.9rem',
                  opacity: submitting ? 0.75 : 1
                }}
              >
                {submitting ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />}
                {submitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <span>Forgot password? Contact IQAC Admin</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Mode: <strong style={{ color: 'var(--text-primary)' }}>Dark / Light</strong>
              </span>
            </div>
          </section>
        </div>
      </main>

      <footer
        style={{
          padding: '16px 20px',
          textAlign: 'center',
          fontSize: '0.775rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border-subtle)'
        }}
      >
        KRGI Academic Audit System • NBA Tier-I Self Assessment Report (SAR) Criteria 1-9 • KRCT • KRCE • MKCE
      </footer>
    </div>
  );
}
