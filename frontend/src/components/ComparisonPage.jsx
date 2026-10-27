import React, { useState, useEffect } from 'react';
import { BarChart3, CheckSquare, Square, RefreshCw, GitCompare, Award, TrendingUp, Layers } from 'lucide-react';

export default function ComparisonPage({ departments, selectedCycleId, criteriaList }) {
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Default selection: pick first 2 or 3 departments
  useEffect(() => {
    if (departments.length > 0 && selectedDeptIds.length === 0) {
      setSelectedDeptIds(departments.slice(0, 3).map(d => d.id));
    }
  }, [departments]);

  const fetchComparison = async () => {
    if (selectedDeptIds.length === 0) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      selectedDeptIds.forEach(id => params.append('department_ids', id));
      if (selectedCycleId) params.append('cycle_id', selectedCycleId);

      const res = await fetch(`/api/comparison/?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load comparison:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDeptIds.length > 0) {
      fetchComparison();
    }
  }, [selectedDeptIds, selectedCycleId]);

  const toggleDept = (deptId) => {
    setSelectedDeptIds(prev => {
      if (prev.includes(deptId)) {
        if (prev.length === 1) return prev; // keep at least 1
        return prev.filter(id => id !== deptId);
      } else {
        if (prev.length >= 5) {
          alert("You can compare up to 5 departments simultaneously.");
          return prev;
        }
        return [...prev, deptId];
      }
    });
  };

  const comparedDepts = data?.departments || [];
  const criteria = data?.criteria || [];
  const palette = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #162032 0%, #0f172a 100%)',
        border: '1px solid #223249',
        borderRadius: '14px',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span className="badge" style={{ background: '#8b5cf6', color: '#fff', padding: '4px 10px', fontWeight: 800 }}>
              CROSS-DEPARTMENT BENCHMARKING
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
              Academic Audit Results Comparison
            </h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
            Multi-department side-by-side performance comparison across all 9 NBA criteria, grade distributions, and benchmark variance.
          </p>
        </div>

        <button onClick={fetchComparison} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} /> Refresh Comparison
        </button>
      </div>

      {/* Department Multi-Select Pill Box */}
      <div style={{
        background: '#111827',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>
          SELECT DEPARTMENTS TO COMPARE (MAX 5):
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {departments.map((d, idx) => {
            const isSelected = selectedDeptIds.includes(d.id);
            const colorIdx = selectedDeptIds.indexOf(d.id);
            const activeColor = colorIdx >= 0 ? palette[colorIdx % palette.length] : '#4f46e5';

            return (
              <button
                key={d.id}
                onClick={() => toggleDept(d.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  border: isSelected ? `2px solid ${activeColor}` : '1px solid #243247',
                  background: isSelected ? 'rgba(255, 255, 255, 0.05)' : '#0f172a',
                  color: isSelected ? '#f8fafc' : '#94a3b8',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: isSelected ? activeColor : '#334155'
                }} />
                <span>{d.institute_code} - {d.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(comparedDepts.length, 1)}, minmax(220px, 1fr))`,
        gap: '16px'
      }}>
        {comparedDepts.map((d, idx) => {
          const color = palette[idx % palette.length];
          return (
            <div
              key={d.department_id}
              style={{
                background: '#162032',
                border: `1px solid ${color}40`,
                borderRadius: '12px',
                padding: '18px',
                boxShadow: 'var(--shadow-card)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: color }} />
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#f8fafc' }}>
                  {d.label}
                </span>
                <span className={`badge badge-${(d.overall_grade || 'd').toLowerCase()}`}>
                  {d.overall_grade}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '10px 0' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: color }}>
                  {d.overall_pct}%
                </span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Overall Score</span>
              </div>

              {/* Indicator Distribution */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '4px',
                background: '#0f172a',
                padding: '8px',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '0.75rem',
                marginTop: '12px'
              }}>
                <div>
                  <div style={{ color: '#10b981', fontWeight: 800 }}>{d.grade_counts.Y}</div>
                  <div style={{ color: '#64748b' }}>Y</div>
                </div>
                <div>
                  <div style={{ color: '#3b82f6', fontWeight: 800 }}>{d.grade_counts.C}</div>
                  <div style={{ color: '#64748b' }}>C</div>
                </div>
                <div>
                  <div style={{ color: '#f59e0b', fontWeight: 800 }}>{d.grade_counts.W}</div>
                  <div style={{ color: '#64748b' }}>W</div>
                </div>
                <div>
                  <div style={{ color: '#ef4444', fontWeight: 800 }}>{d.grade_counts.D}</div>
                  <div style={{ color: '#64748b' }}>D</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual Chart: Comparative Bar Chart per Criterion */}
      <div style={{
        background: '#111827',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              Criterion-by-Criterion Score Comparison (%)
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Comparison across C1 (Curriculum) to C9 (Governance)
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {comparedDepts.map((d, idx) => (
              <div key={d.department_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: palette[idx % palette.length] }} />
                <span style={{ color: '#cbd5e1' }}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Responsive SVG Chart */}
        <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '10px' }}>
          <div style={{ minWidth: '700px', height: '240px', display: 'flex', alignItems: 'flex-end', gap: '16px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
            {criteria.map((c, cIdx) => (
              <div key={c.code} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '4px', height: '180px' }}>
                  {comparedDepts.map((d, dIdx) => {
                    const score = d.scores[cIdx] || 0;
                    const heightPct = Math.min(score, 100);
                    const color = palette[dIdx % palette.length];
                    return (
                      <div
                        key={d.department_id}
                        title={`${d.label} - ${c.code}: ${score}%`}
                        style={{
                          width: `${Math.floor(80 / comparedDepts.length)}%`,
                          height: `${heightPct}%`,
                          background: color,
                          borderRadius: '4px 4px 0 0',
                          minHeight: '4px',
                          position: 'relative',
                          transition: 'height 0.3s ease'
                        }}
                      />
                    );
                  })}
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0' }}>
                  {c.code}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Side-by-side Criteria Breakdown Table */}
      <div style={{
        background: '#111827',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
            Detailed Percentage & Grade Variance
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="audit-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Criterion</th>
                <th style={{ minWidth: '220px' }}>Title</th>
                {comparedDepts.map((d, idx) => (
                  <th key={d.department_id} style={{ textAlign: 'center', color: palette[idx % palette.length] }}>
                    {d.label} (%)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criteria.map((c, cIdx) => (
                <tr key={c.code}>
                  <td style={{ fontWeight: 800, color: '#818cf8' }}>{c.code}</td>
                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>{c.title}</td>
                  {comparedDepts.map(d => {
                    const score = d.scores[cIdx] || 0;
                    const grade = score > 75 ? 'Y' : (score >= 60 ? 'C' : (score >= 40 ? 'W' : 'D'));
                    return (
                      <td key={d.department_id} style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, marginRight: '6px' }}>{score}%</span>
                        <span className={`badge badge-${grade.toLowerCase()}`} style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                          {grade}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
