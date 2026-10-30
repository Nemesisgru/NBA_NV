import React, { useState, useEffect } from 'react';
import { BarChart3, Building, CheckCircle2, ChevronRight, Layers, RefreshCw } from 'lucide-react';

export default function KRGIDashboard({ selectedCycleId, onSelectDepartment }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/?cycle_id=${selectedCycleId || ''}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [selectedCycleId]);

  if (loading && !data) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading KRGI Dashboard...</div>;
  }

  const institutes = data?.institutes || [];
  const matrix = data?.department_matrix || [];
  const criteria = data?.criteria || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Dashboard Header */}
      <div style={{
        background: 'var(--hero-gradient)',
        border: '1px solid var(--hero-border)',
        borderRadius: '14px',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span className="badge" style={{ background: 'var(--primary)', color: '#fff', padding: '4px 10px', fontWeight: 800 }}>
              KRGI GROUP DASHBOARD
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Academic Audit Cross-Department Analytics
            </h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Multi-institutional comparison across KRCT, KRCE, and MKCE. Automatic grade rollup and criterion distribution.
          </p>
        </div>

        <button onClick={fetchDashboard} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} /> Refresh Dashboard
        </button>
      </div>

      {/* Institute Performance Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px'
      }}>
        {institutes.map(inst => (
          <div
            key={inst.institute_code}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: 'var(--shadow-card)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              height: '4px',
              background: inst.institute_code === 'KRCT' ? 'var(--primary)' : (inst.institute_code === 'KRCE' ? '#06b6d4' : '#10b981')
            }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {inst.institute_code}
                </h3>
              </div>
              <span className={`badge badge-${(inst.grade || 'd').toLowerCase()}`} style={{ fontSize: '0.9rem', padding: '3px 12px' }}>
                {inst.grade}
              </span>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {inst.institute_name}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Departments Audited</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {inst.departments_audited} / {inst.total_departments}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Average Score</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                  {inst.average_pct}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cross Department Matrix Table */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Comprehensive Department & Criteria Heatmap
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Click department to switch evaluation context
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="audit-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Institute</th>
                <th style={{ width: '100px' }}>Dept</th>
                <th style={{ minWidth: '180px' }}>Department Name</th>
                <th style={{ width: '90px', textAlign: 'right' }}>Overall %</th>
                <th style={{ width: '70px', textAlign: 'center' }}>Grade</th>
                {criteria.map(c => (
                  <th key={c.code} style={{ width: '75px', textAlign: 'center' }}>
                    {c.code}
                  </th>
                ))}
                <th style={{ width: '140px', textAlign: 'center' }}>Y / C / W / D</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map(dept => (
                <tr 
                  key={`${dept.institute_code}-${dept.department_code}`}
                  onClick={() => onSelectDepartment(dept.department_id, dept.institute_code)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 700, color: '#818cf8' }}>{dept.institute_code}</td>
                  <td style={{ fontWeight: 800, color: '#f8fafc' }}>{dept.department_code}</td>
                  <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{dept.department_name}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: dept.has_data ? '#10b981' : '#64748b' }}>
                    {dept.has_data ? `${dept.overall_pct}%` : 'Pending'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {dept.has_data ? (
                      <span className={`badge badge-${(dept.overall_grade || 'd').toLowerCase()}`}>
                        {dept.overall_grade}
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>-</span>
                    )}
                  </td>

                  {/* Criteria cells */}
                  {criteria.map(c => {
                    const cData = dept.criteria?.[c.code] || {};
                    return (
                      <td key={c.code} style={{ textAlign: 'center' }}>
                        {cData.grade && cData.grade !== '-' ? (
                          <span 
                            className={`badge badge-${cData.grade.toLowerCase()}`}
                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                            title={`${c.code}: ${cData.pct}%`}
                          >
                            {cData.grade}
                          </span>
                        ) : (
                          <span style={{ color: '#475569' }}>·</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Distribution */}
                  <td style={{ textAlign: 'center', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {dept.has_data ? (
                      <span>
                        <strong style={{ color: '#10b981' }}>{dept.y_count}</strong> /{' '}
                        <strong style={{ color: '#3b82f6' }}>{dept.c_count}</strong> /{' '}
                        <strong style={{ color: '#f59e0b' }}>{dept.w_count}</strong> /{' '}
                        <strong style={{ color: '#ef4444' }}>{dept.d_count}</strong>
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>Not evaluated</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
