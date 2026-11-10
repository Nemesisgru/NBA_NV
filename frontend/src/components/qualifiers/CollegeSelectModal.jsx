import React, { useState } from 'react';
import { Building2, Plus, ArrowRight, Check } from 'lucide-react';

export default function CollegeSelectModal({
  isOpen,
  colleges = [],
  activeCollegeId,
  onAccessCollege,
  onCreateCollege,
  onClose,
}) {
  const savedCollegeId = colleges.some((college) => String(college.id) === String(activeCollegeId))
    ? Number(activeCollegeId)
    : null;
  const [mode, setMode] = useState(colleges.length > 0 ? 'select' : 'create');
  const [selectedId, setSelectedId] = useState(savedCollegeId || (colleges[0]?.id ?? null));
  const [newCollegeName, setNewCollegeName] = useState('');
  const [newCollegeCode, setNewCollegeCode] = useState('');
  const [newTier, setNewTier] = useState('Tier 1');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [accessError, setAccessError] = useState('');
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const handleConfirmSelect = () => {
    if (selectedId) {
      setAccessError('');
      setPassword('');
      setPasswordConfirm('');
      setMode('unlock');
    }
  };

  const selectedCollege = colleges.find((college) => college.id === selectedId);

  const handleAccessSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    setAccessError('');
    try {
      await onAccessCollege(selectedId, password, passwordConfirm);
    } catch (err) {
      setAccessError(err.message || 'Unable to unlock this college.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newCollegeName.trim() || password.length < 8 || password !== passwordConfirm) return;
    setCreating(true);
    try {
      await onCreateCollege({
        institution_name: newCollegeName.trim(),
        institution_code: newCollegeCode.trim() || newCollegeName.trim().slice(0, 6).toUpperCase(),
        tier_type: newTier,
        password,
        password_confirm: passwordConfirm,
      });
      if (onClose) onClose();
    } catch (err) {
      console.error(err);
      setAccessError(err.message || 'Error creating college.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-modal)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '560px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Top Header */}
        <div
          style={{
            padding: '24px 28px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 16px rgba(16, 185, 129, 0.35)',
              }}
            >
              <Building2 size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {mode === 'unlock' ? 'Protect Your College Data' : 'Select or Enter College Name'}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                All qualifier data, departments, and programs are isolated under your selected college title.
              </p>
            </div>
          </div>

          {mode !== 'unlock' && <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
            <button
              type="button"
              onClick={() => setMode('select')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: mode === 'select' ? 'var(--primary)' : 'var(--border-subtle)',
                background: mode === 'select' ? 'var(--primary-light)' : 'transparent',
                color: mode === 'select' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: mode === 'select' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Existing Colleges ({colleges.length})
            </button>
            <button
              type="button"
              onClick={() => setMode('create')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: mode === 'create' ? 'var(--primary)' : 'var(--border-subtle)',
                background: mode === 'create' ? 'var(--primary-light)' : 'transparent',
                color: mode === 'create' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: mode === 'create' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Plus size={14} /> Enter New College
            </button>
          </div>}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 28px', maxHeight: '60vh', overflowY: 'auto' }}>
          {mode === 'unlock' ? (
            <form onSubmit={handleAccessSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedCollege?.institution_name}
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {selectedCollege?.has_password
                  ? 'Enter this college’s password to open its protected data.'
                  : 'This existing college has no password yet. Set one now to protect its data.'}
              </p>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  {selectedCollege?.has_password ? 'College Password' : 'Create Password (at least 8 characters)'}
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={selectedCollege?.has_password ? 'current-password' : 'new-password'}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', padding: '9px 12px', borderRadius: '8px', fontSize: '0.85rem', width: '100%' }}
                />
              </div>
              {!selectedCollege?.has_password && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    autoComplete="new-password"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', padding: '9px 12px', borderRadius: '8px', fontSize: '0.85rem', width: '100%' }}
                  />
                </div>
              )}
              {accessError && <p role="alert" style={{ color: 'var(--grade-d)', margin: 0, fontSize: '0.8rem' }}>{accessError}</p>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setMode('select')}>Back</button>
                <button
                  type="submit"
                  disabled={creating || password.length < 8 || (!selectedCollege?.has_password && password !== passwordConfirm)}
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {creating ? 'Opening...' : selectedCollege?.has_password ? 'Unlock College Data' : 'Set Password & Continue'}
                </button>
              </div>
            </form>
          ) : mode === 'select' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {colleges.map((c) => {
                const isSelected = selectedId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: isSelected ? '#10b981' : 'var(--border-subtle)',
                      background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {c.institution_name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {c.institution_code ? `${c.institution_code} • ` : ''}{c.tier_type || 'Tier 1'}
                      </div>
                    </div>
                    {isSelected && (
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: '#10b981',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={14} />
                      </div>
                    )}
                  </div>
                );
              })}

              {colleges.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No colleges registered yet. Click &quot;Enter New College&quot; above to add one.
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Full College / Institution Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCollegeName}
                  onChange={(e) => setNewCollegeName(e.target.value)}
                  placeholder="e.g. College Name"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-input)',
                    color: 'var(--text-primary)',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    width: '100%',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Create Password (at least 8 characters) *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', padding: '9px 12px', borderRadius: '8px', fontSize: '0.85rem', width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', padding: '9px 12px', borderRadius: '8px', fontSize: '0.85rem', width: '100%' }}
                />
              </div>
              {accessError && <p role="alert" style={{ color: 'var(--grade-d)', margin: 0, fontSize: '0.8rem' }}>{accessError}</p>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    College Code (optional)
                  </label>
                  <input
                    type="text"
                    value={newCollegeCode}
                    onChange={(e) => setNewCollegeCode(e.target.value)}
                    placeholder="e.g. INST"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-input)',
                      color: 'var(--text-primary)',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      width: '100%',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Accreditation Tier
                  </label>
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value)}
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-input)',
                      color: 'var(--text-primary)',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      width: '100%',
                    }}
                  >
                    <option value="Tier 1">Tier 1 (Autonomous / Deemed)</option>
                    <option value="Tier 2">Tier 2 (Affiliated / Non-Autonomous)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={creating || !newCollegeName.trim() || password.length < 8 || password !== passwordConfirm}
                className="btn btn-primary"
                style={{
                  marginTop: '8px',
                  padding: '11px',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Plus size={16} />
                {creating ? 'Creating Workspace...' : 'Create College & Enter Portal'}
              </button>
            </form>
          )}
        </div>

        {/* Modal Footer (for Select mode) */}
        {mode === 'select' && colleges.length > 0 && (
          <div
            style={{
              padding: '16px 28px',
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            {activeCollegeId && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirmSelect}
              disabled={!selectedId}
              className="btn btn-primary"
              style={{
                padding: '9px 20px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              }}
            >
              <span>Open College Workspace</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
