import React, { useState } from 'react';
import { ShieldCheck, LogIn, Loader2, Eye, EyeOff, Sparkles, FileSpreadsheet, ArrowRight } from 'lucide-react';
import ThemeToggle from './ThemeToggle';


export default function LoginPage({ onLogin, onOpenQualifiers }) {
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
    } catch {
      setError('Cannot reach the server. Make sure the Django backend is running.');
    } finally {
      setSubmitting(false);
    }
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
          <button
            type="button"
            onClick={onOpenQualifiers}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Open NBA Pre-Visit Qualifiers & Allied Matrix Module"
          >
            <FileSpreadsheet size={14} />
            Pre-Visit Qualifiers Module
          </button>
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
          {/* Brand */}
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
                  Academic Audit System
                </h1>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Institutional review workflow • Multi-role access
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

            {/* Pre-Visit Qualifiers Module Option Card */}
            <div
              style={{
                marginTop: '16px',
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.03) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.18)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    NBA Pre-Visit Qualifiers Module
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Google Sheet Matrix • 10 Individual Program Tabs • Dedicated Backend
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenQualifiers}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                }}
              >
                <span>Enter Pre-Visit Qualifier Data</span>
                <ArrowRight size={15} />
              </button>
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
              Use the username or email and password issued by the IQAC office.
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

              <div style={{ textAlign: 'center', margin: '4px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                — or —
              </div>

              <button
                type="button"
                onClick={onOpenQualifiers}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontWeight: 700,
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.2s ease'
                }}
              >
                <FileSpreadsheet size={16} />
                Enter Pre-Visit Qualifiers Data
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
        Academic Audit System • NBA Tier-I Self Assessment Report (SAR) Criteria 1-9 • Multi-institution review
      </footer>
    </div>
  );
}
