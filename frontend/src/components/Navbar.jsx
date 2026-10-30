import React from 'react';
import {
  Building2, Calendar, ShieldCheck, UserCheck, Layers,
  BarChart3, FileSpreadsheet, ExternalLink, Download, FileText, LogOut
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

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
  allowedTabs,
  userRole,
  currentUser,
  onLogout
}) {
  const filteredDepartments = departments.filter(
    d => !selectedInstitute || d.institute_code === selectedInstitute
  );
  // An HOD is locked to their own department
  const isHod = userRole === 'HOD';

  const excelExportUrl = `/api/export/department-excel/?department_id=${selectedDepartment || ''}&cycle_id=${selectedCycle || ''}`;
  const pdfExportUrl = `/api/export/department-pdf/?department_id=${selectedDepartment || ''}&cycle_id=${selectedCycle || ''}`;

  return (
    <header style={{
      background: 'var(--bg-navbar)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border-navbar)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      transition: 'background-color 0.25s ease, border-color 0.25s ease'
    }}>
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #F54927 0%, #f97316 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(245, 73, 39, 0.4)'
          }}>
            <ShieldCheck size={26} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                KRGI Academic Audit System
              </span>
              <span className="badge" style={{ background: 'var(--badge-bg)', color: 'var(--badge-text)', border: '1px solid var(--badge-border)' }}>
                NBA Tier-I Aligned
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              K. Ramakrishnan Group of Institutions (KRCT • KRCE • MKCE)
            </div>
          </div>
        </div>

        {/* Global Context Pickers and Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Institute Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={16} color="var(--text-secondary)" />
            <select
              value={selectedInstitute}
              onChange={(e) => {
                setSelectedInstitute(e.target.value);
                const firstInInst = departments.find(d => d.institute_code === e.target.value);
                if (firstInInst) setSelectedDepartment(firstInInst.id);
              }}
              disabled={isHod}
              style={{ width: '105px', padding: '6px 8px', fontSize: '0.8rem' }}
            >
              {institutes.map(inst => (
                <option key={inst.id} value={inst.code}>{inst.code}</option>
              ))}
            </select>
          </div>

          {/* Department Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Dept:</span>
            <select
              value={selectedDepartment || ''}
              onChange={(e) => setSelectedDepartment(Number(e.target.value))}
              disabled={isHod}
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
            <Calendar size={16} color="var(--text-secondary)" />
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

          {/* Theme Toggle switch for logged-in sessions across all roles */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-card)',
            padding: '4px 8px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)'
          }}>
            <ThemeToggle id="navbar-theme-toggle" size="sm" showLabel={false} />
          </div>

          {/* User Account / Role Badge */}
          {currentUser && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-card)',
              padding: '4px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{currentUser.username}</span>
                <span style={{ color: 'var(--text-secondary)' }}> ({currentUser.role})</span>
              </div>
              <button
                onClick={onLogout}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Log out"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}

          {/* Django Admin Link */}
          {userRole === 'Admin' && (
            <a
              href="/admin/"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <UserCheck size={14} /> Django Admin <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '0 24px',
        overflowX: 'auto',
        background: 'var(--bg-nav-tabs)',
        borderBottom: '1px solid var(--border-navbar)',
        transition: 'background-color 0.25s ease'
      }}>
        {[
          { id: 'criteria', label: isHod ? "Auditor's Report (C1 - C9)" : 'Criteria Evaluation (C1 - C9)', icon: Layers },
          { id: 'summary', label: 'Criterion Summary (1000M)', icon: FileSpreadsheet },
          { id: 'dashboard', label: 'KRGI Dashboard', icon: BarChart3 },
          { id: 'atr', label: 'Action Taken Report (ATR)', icon: ShieldCheck },
          { id: 'allocations', label: 'Auditor Allocation & Admin', icon: UserCheck },
          { id: 'comparison', label: 'Result Comparison', icon: BarChart3 },
        ].filter(tab => allowedTabs.includes(tab.id)).map(tab => {
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
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
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

    </header>
  );
}
