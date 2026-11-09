import React, { useState } from 'react';
import {
  ClipboardCheck,
  Building2,
  Calculator,
  ChevronDown,
  ChevronRight,
  Folder,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  Laptop,
} from 'lucide-react';

export default function QualifierSidebar({
  activeTab,
  onSelectTab,
  config = {},
  departments = [],
  mappings = [],
  programs = [],
  onOpenCollegeSelect,
  onBackToLogin,
}) {
  // Collapsed state for department groups in the sidebar
  const [collapsedDepts, setCollapsedDepts] = useState({});

  const toggleDeptCollapse = (deptSno) => {
    setCollapsedDepts((prev) => ({
      ...prev,
      [deptSno]: !prev[deptSno],
    }));
  };

  // Keep each 2.A department visible even before its 2.B programs are entered.
  const deptsMap = {};
  departments.forEach((department) => {
    deptsMap[department.sno] = {
      sno: department.sno,
      name: department.department_name || `Department ${department.sno}`,
      programs: [],
    };
  });

  mappings.forEach((m) => {
    const existing = deptsMap[m.sno];
    deptsMap[m.sno] = {
      sno: m.sno,
      name: existing?.name && !existing.name.startsWith('Department ')
        ? existing.name
        : m.department_name || existing?.name || `Department ${m.sno}`,
      programs: existing?.programs || [],
    };
  });

  // Attach programs to corresponding department
  programs.forEach((p) => {
    const dSno = p.dept_sno || 1;
    if (!deptsMap[dSno]) {
      deptsMap[dSno] = {
        sno: dSno,
        name: p.department_name || `Department ${dSno}`,
        programs: [],
      };
    }
    deptsMap[dSno].programs.push(p);
  });

  const deptGroups = Object.values(deptsMap).sort((a, b) => a.sno - b.sno);

  const getProgramIcon = (type) => {
    if (type === 'master') return <Laptop size={14} color="#f85d3f" />;
    return <Sparkles size={14} color="#10b981" />;
  };

  return (
    <aside
      style={{
        width: '300px',
        minWidth: '300px',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* College Switcher Header */}
      <div
        style={{
          padding: '16px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, transparent 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current Institution
          </span>
          <button
            onClick={onOpenCollegeSelect}
            className="btn btn-secondary btn-sm"
            style={{
              padding: '2px 8px',
              fontSize: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '6px',
            }}
            title="Switch or create college title"
          >
            <RefreshCw size={11} /> Switch
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: '2px',
            }}
          >
            <Building2 size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={config.institution_name}
            >
              {config.institution_name || 'Select College'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {config.tier_type || 'Tier 1'} • NBA Qualifiers
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Section 1: Institutional Setup */}
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 8px', marginBottom: '6px' }}>
            Institutional Compliance
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {/* Checklist */}
            <button
              onClick={() => onSelectTab('checklist')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: activeTab === 'checklist' ? 'var(--primary)' : 'transparent',
                background: activeTab === 'checklist' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'checklist' ? 'var(--primary)' : 'var(--text-primary)',
                fontWeight: activeTab === 'checklist' ? 700 : 500,
                fontSize: '0.8rem',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <ClipboardCheck size={16} color={activeTab === 'checklist' ? 'var(--primary)' : 'var(--text-secondary)'} />
              <span>1. Check List Compliance</span>
            </button>

            {/* Departments */}
            <button
              onClick={() => onSelectTab('departments')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: activeTab === 'departments' ? 'var(--primary)' : 'transparent',
                background: activeTab === 'departments' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'departments' ? 'var(--primary)' : 'var(--text-primary)',
                fontWeight: activeTab === 'departments' ? 700 : 500,
                fontSize: '0.8rem',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Building2 size={16} color={activeTab === 'departments' ? 'var(--primary)' : 'var(--text-secondary)'} />
              <span>2. Departments (2.A & 2.B)</span>
            </button>

            {/* Primary Check */}
            <button
              onClick={() => onSelectTab('primary')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: activeTab === 'primary' ? 'var(--primary)' : 'transparent',
                background: activeTab === 'primary' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'primary' ? 'var(--primary)' : 'var(--text-primary)',
                fontWeight: activeTab === 'primary' ? 700 : 500,
                fontSize: '0.8rem',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Calculator size={16} color={activeTab === 'primary' ? 'var(--primary)' : 'var(--text-secondary)'} />
              <span>3. Primary Check (SFR)</span>
            </button>
          </div>
        </div>

        {/* Section 2: Departments & Programs (Dynamic rows for each department) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Departments & Programs ({deptGroups.length})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {deptGroups.map((group) => {
              const isCollapsed = collapsedDepts[group.sno];
              return (
                <div
                  key={group.sno}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Department Group Header */}
                  <div
                    onClick={() => toggleDeptCollapse(group.sno)}
                    style={{
                      padding: '8px 10px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: isCollapsed ? 'none' : '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <Folder size={14} color="#3b82f6" />
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={group.name}
                      >
                        {group.name}
                      </span>
                    </div>
                    {isCollapsed ? <ChevronRight size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                  </div>

                  {/* List of Master & Allied Programs inside this Department */}
                  {!isCollapsed && (
                    <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {group.programs.map((p) => {
                        const isProgActive = activeTab === p.program_key;
                        return (
                          <button
                            key={p.program_key}
                            onClick={() => onSelectTab(p.program_key)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: isProgActive ? 'var(--primary)' : 'transparent',
                              background: isProgActive ? 'var(--primary-light)' : 'transparent',
                              color: isProgActive ? 'var(--primary)' : 'var(--text-secondary)',
                              fontWeight: isProgActive ? 700 : 500,
                              fontSize: '0.76rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {getProgramIcon(p.program_type)}
                            <span
                              style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={p.tab_title}
                            >
                              {p.tab_title}
                            </span>
                          </button>
                        );
                      })}

                      {group.programs.length === 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '6px 10px' }}>
                          No programs added yet. Add in 2.B.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div
        style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {onBackToLogin && (
          <button
            onClick={onBackToLogin}
            className="btn btn-secondary"
            style={{
              width: '100%',
              justifyContent: 'center',
              fontSize: '0.78rem',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft size={14} /> Back to Audit Portal
          </button>
        )}
      </div>
    </aside>
  );
}
