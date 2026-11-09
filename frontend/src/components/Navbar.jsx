import React from 'react';
import {
  Building2, Calendar, Filter, ShieldCheck, Download, KeyRound, FileText, LogOut, FileSpreadsheet
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import useSlidingIndicator from '../hooks/useSlidingIndicator';

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
  onLogout,
  onChangePassword,
  onOpenQualifiers
}) {
  const filteredDepartments = departments.filter(
    d => !selectedInstitute || d.institute_code === selectedInstitute
  );
  // An HOD is locked to their own department; a College Head to their own college
  const isHod = userRole === 'HOD';
  const isCollegeHead = userRole === 'CollegeHead';
  const roleLabel = { CollegeHead: 'Coll Head' }[userRole] || userRole;

  const tabs = [
    { id: 'criteria', label: (isHod || isCollegeHead) ? "Auditor's Report (C1 - C9)" : 'Criteria Evaluation (C1 - C9)' },
    { id: 'summary', label: 'Criterion Summary (1000M)' },
    { id: 'dashboard', label: 'KRGI Dashboard' },
    { id: 'atr', label: 'Action Taken Report (ATR)' },
    { id: 'allocations', label: 'Auditor Allocation & Admin' },
    { id: 'questions', label: 'Audit Questions' },
    { id: 'comparison', label: 'Result Comparison' },
    { id: 'assistant', label: 'AI Assistant' },
  ].filter(tab => allowedTabs.includes(tab.id));

  // Sliding "magic" indicator: follows the active tab's position and width
  const { containerRef: navRef, itemRef, indicator } = useSlidingIndicator(activeTab, [allowedTabs.join(','), isHod]);

  // Academic year + semester/cycle: the single cycle selection for every tab
  const currentCycle = cycles.find(c => c.id === selectedCycle);
  const years = [...new Set(cycles.map(c => c.academic_year))].sort().reverse();
  const yearCycles = cycles.filter(c => c.academic_year === currentCycle?.academic_year);
  const handleYearChange = (year) => {
    const sameKind = cycles.find(c => c.academic_year === year && c.semester === currentCycle?.semester
      && c.cycle_type === currentCycle?.cycle_type);
    const first = sameKind || cycles.find(c => c.academic_year === year);
    if (first) setSelectedCycle(first.id);
  };
  const label = { fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 };

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

        {/* Account actions, top right corner aligned with the title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          {/* Pre-Visit Qualifiers Module Button */}
          {onOpenQualifiers && (
            <button
              onClick={onOpenQualifiers}
              className="btn btn-outline btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#10b981',
                borderColor: 'rgba(16, 185, 129, 0.4)',
                background: 'rgba(16, 185, 129, 0.08)',
                fontWeight: 700,
                fontSize: '0.78rem'
              }}
              title="NBA Pre-Visit Qualifiers & Allied Matrix Module"
            >
              <FileSpreadsheet size={14} /> Pre-Visit Qualifiers
            </button>
          )}

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

          {/* User Account / Role Badge with Log out, kept last so it sits in the top right corner */}
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
                <span style={{ color: 'var(--text-secondary)' }}> ({roleLabel})</span>
              </div>
              <button
                onClick={onChangePassword}
                className="btn btn-outline btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Change your password"
              >
                <KeyRound size={14} /> Password
              </button>
              <button
                onClick={onLogout}
                className="btn btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'var(--grade-d)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700
                }}
                title="Log out"
              >
                <LogOut size={14} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Single selection ribbon: college, department, academic year, semester / cycle and exports */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '8px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap'
      }}>
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
              disabled={isHod || isCollegeHead}
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

          {/* Academic Year Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={15} color="var(--primary)" />
            <span style={label}>Academic Year:</span>
            <select
              value={currentCycle?.academic_year || ''}
              onChange={(e) => handleYearChange(e.target.value)}
              style={{ width: '115px', padding: '6px 8px', fontSize: '0.8rem' }}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Semester / Cycle Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="var(--primary)" />
            <span style={label}>Semester / Cycle:</span>
            <select
              value={selectedCycle || ''}
              onChange={(e) => setSelectedCycle(Number(e.target.value))}
              style={{ width: '180px', padding: '6px 8px', fontSize: '0.8rem' }}
            >
              {yearCycles.map(c => (
                <option key={c.id} value={c.id}>{c.semester} ({c.cycle_type})</option>
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
      </div>

      {/* Navigation Tabs: words only, with a sliding curve-outside indicator */}
      <nav
        ref={navRef}
        className="magic-nav"
        style={{ background: 'var(--bg-nav-tabs)', transition: 'background-color 0.25s ease' }}
      >
        {indicator && (
          <div className="magic-nav-indicator" style={{ left: indicator.left, width: indicator.width }}>
            <span />
          </div>
        )}
        {tabs.map(tab => (
          <button
            key={tab.id}
            ref={itemRef(tab.id)}
            onClick={() => setActiveTab(tab.id)}
            className={`magic-nav-item${activeTab === tab.id ? ' active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

    </header>
  );
}
