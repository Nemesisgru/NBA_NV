import React, { useState } from 'react';
import { 
  Building2, Calendar, ShieldCheck, UserCheck, Layers, 
  BarChart3, FileSpreadsheet, ExternalLink, PlusCircle, Download, FileText, LogIn, LogOut, Key 
} from 'lucide-react';

export default function Navbar({
  institutes,
  departments,
  cycles,
  selectedInstitute,
  setSelectedInstitute,
  selectedDepartment,
  setSelectedDepartment,
  selectedCycle,
  setSelectedCycle,
  activeTab,
  setActiveTab,
  userRole,
  setUserRole,
  currentUser,
  onLogin,
  onLogout,
  onOpenAddDeptModal
}) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const filteredDepartments = departments.filter(
    d => !selectedInstitute || d.institute_code === selectedInstitute
  );

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (data.status === 'success') {
        onLogin(data.user);
        setShowLoginModal(false);
        setLoginForm({ username: '', password: '' });
      } else {
        setLoginError(data.error || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      setLoginError('Server connection error.');
    }
  };

  const excelExportUrl = `/api/export/department-excel/?department_id=${selectedDepartment || ''}&cycle_id=${selectedCycle || ''}`;
  const pdfExportUrl = `/api/export/department-pdf/?department_id=${selectedDepartment || ''}&cycle_id=${selectedCycle || ''}`;

  return (
    <header style={{
      background: 'rgba(17, 24, 39, 0.95)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid #1f2d42',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid #172338',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)'
          }}>
            <ShieldCheck size={26} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', color: '#f8fafc' }}>
                KRGI Academic Audit System
              </span>
              <span className="badge" style={{ background: '#1e293b', color: '#818cf8', border: '1px solid #334155' }}>
                NBA Tier-I Aligned
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              K. Ramakrishnan Group of Institutions (KRCT • KRCE • MKCE)
            </div>
          </div>
        </div>

        {/* Global Context Pickers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Institute Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={16} color="#94a3b8" />
            <select
              value={selectedInstitute}
              onChange={(e) => {
                setSelectedInstitute(e.target.value);
                const firstInInst = departments.find(d => d.institute_code === e.target.value);
                if (firstInInst) setSelectedDepartment(firstInInst.id);
              }}
              style={{ width: '105px', padding: '6px 8px', fontSize: '0.8rem' }}
            >
              {institutes.map(inst => (
                <option key={inst.id} value={inst.code}>{inst.code}</option>
              ))}
            </select>
          </div>

          {/* Department Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Dept:</span>
            <select
              value={selectedDepartment || ''}
              onChange={(e) => setSelectedDepartment(Number(e.target.value))}
              style={{ width: '150px', padding: '6px 8px', fontSize: '0.8rem' }}
            >
              {filteredDepartments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name.length > 16 ? d.name.slice(0, 16) + '...' : d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Audit Cycle Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} color="#94a3b8" />
            <select
              value={selectedCycle || ''}
              onChange={(e) => setSelectedCycle(Number(e.target.value))}
              style={{ width: '185px', padding: '6px 8px', fontSize: '0.8rem' }}
            >
              {cycles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.academic_year} {c.semester} ({c.cycle_type})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Department Download Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <a 
              href={excelExportUrl}
              download
              className="btn btn-outline btn-sm"
              style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}
              title="Download Department Audit Report in Excel / CSV"
            >
              <Download size={13} /> Excel
            </a>
            <a 
              href={pdfExportUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
              style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
              title="View & Print Official PDF Report"
            >
              <FileText size={13} /> PDF
            </a>
          </div>

          {/* User Account / Role Badge */}
          {currentUser ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#1e293b',
              padding: '4px 10px',
              borderRadius: '8px',
              border: '1px solid #334155'
            }}>
              <div style={{ fontSize: '0.75rem' }}>
                <span style={{ color: '#818cf8', fontWeight: 700 }}>{currentUser.username}</span>
                <span style={{ color: '#94a3b8' }}> ({currentUser.role})</span>
              </div>
              <button
                onClick={onLogout}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Log out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <LogIn size={14} /> Login
            </button>
          )}

          {/* Django Admin Link */}
          <a 
            href="/admin/" 
            target="_blank" 
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <UserCheck size={14} /> Django Admin <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '0 24px',
        overflowX: 'auto',
        background: '#0f172a'
      }}>
        {[
          { id: 'criteria', label: 'Criteria Evaluation (C1 - C9)', icon: Layers },
          { id: 'summary', label: 'Criterion Summary (1000M)', icon: FileSpreadsheet },
          { id: 'dashboard', label: 'KRGI Dashboard', icon: BarChart3 },
          { id: 'atr', label: 'Action Taken Report (ATR)', icon: ShieldCheck },
          { id: 'allocations', label: 'Auditor Allocation & Admin', icon: UserCheck },
          { id: 'comparison', label: 'Result Comparison', icon: BarChart3 },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                fontSize: '0.825rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#818cf8' : '#94a3b8',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid #6366f1' : '3px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="#6366f1" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                  User Account Login
                </h3>
              </div>
              <button 
                onClick={() => setShowLoginModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '14px' }}>
              Log in as an <strong>Auditor</strong>, <strong>Head of Department (HOD)</strong>, or <strong>Admin</strong>. Separate logins are auto-generated for all members.
            </p>

            {loginError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 12px', borderRadius: '6px', fontSize: '0.775rem', marginBottom: '12px' }}>
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. auditor.oorkalan or hod.krct.cse or admin"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter account password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                />
              </div>

              <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', fontSize: '0.725rem', color: '#64748b' }}>
                <strong>Quick Reference:</strong><br />
                • <strong>Admin:</strong> <code>admin</code> / <code>admin123</code><br />
                • <strong>Auditor:</strong> <code>auditor.&lt;name&gt;</code> / <code>Audit@&lt;Name&gt;#</code><br />
                • <strong>HOD:</strong> <code>hod.&lt;inst&gt;.&lt;dept&gt;</code> / <code>Hod@&lt;Dept&gt;2025#</code>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowLoginModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Log In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </header>
  );
}
