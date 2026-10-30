import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, RefreshCw, Award, CheckCircle, AlertCircle, AlertTriangle, XCircle, Printer, Download, FileText } from 'lucide-react';

export default function CriterionSummary({ selectedDepartmentId, selectedCycleId, onSelectCriterion }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    if (!selectedDepartmentId || !selectedCycleId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/criterion-summary/?department_id=${selectedDepartmentId}&cycle_id=${selectedCycleId}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedDepartmentId, selectedCycleId]);

  if (loading && !data) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading Criterion Summary...</div>;
  }

  const totals = data?.totals || {};
  const rows = data?.rows || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Banner & Quick Controls */}
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
            <span className="badge" style={{ background: 'var(--primary)', color: 'white', padding: '4px 10px' }}>
              1000 MARKS EVALUATION
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Criterion-Wise Executive Summary
            </h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Consolidated NBA Tier-I audit performance across C1 to C9 for{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{data?.department?.institute} - {data?.department?.code}</strong> ({data?.cycle?.academic_year} {data?.cycle?.semester}).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <a
            href={`/api/export/department-excel/?department_id=${selectedDepartmentId}&cycle_id=${selectedCycleId}`}
            download
            className="btn btn-secondary btn-sm"
            style={{ color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' }}
          >
            <Download size={14} /> Download Excel (.csv)
          </a>
          <a
            href={`/api/export/department-pdf/?department_id=${selectedDepartmentId}&cycle_id=${selectedCycleId}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)' }}
          >
            <FileText size={14} /> Print / Save PDF
          </a>
          <button onClick={fetchSummary} className="btn btn-outline btn-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        <div style={{ background: '#162032', border: '1px solid #243247', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>OVERALL SCORE</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc' }}>{totals.validated_marks}</span>
            <span style={{ fontSize: '0.9rem', color: '#64748b' }}>/ {totals.max_marks}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#818cf8', marginTop: '4px' }}>
            Percentage: {totals.percentage}%
          </div>
        </div>

        <div style={{ background: '#162032', border: '1px solid #243247', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>OVERALL GRADE</div>
          <div style={{ marginTop: '8px' }}>
            <span className={`badge badge-${(totals.grade || 'd').toLowerCase()}`} style={{ fontSize: '1.4rem', padding: '4px 18px' }}>
              {totals.grade || '-'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
            Threshold: Y &gt; 75% | C &gt;= 60%
          </div>
        </div>

        <div style={{ background: '#162032', border: '1px solid #243247', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>COMPLIANT INDICATORS (Y+C)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <CheckCircle size={24} color="#10b981" />
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
              {(totals.count_y || 0) + (totals.count_c || 0)}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Y: {totals.count_y || 0} | C: {totals.count_c || 0}
          </div>
        </div>

        <div style={{ background: '#162032', border: '1px solid #243247', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>NEEDS IMPROVEMENT (W+D)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <AlertTriangle size={24} color="#f59e0b" />
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>
              {(totals.count_w || 0) + (totals.count_d || 0)}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            W: {totals.count_w || 0} | D: {totals.count_d || 0} (Flagged for ATR)
          </div>
        </div>
      </div>

      {/* Criterion Summary Table */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)'
      }}>
        <table className="audit-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Criterion</th>
              <th style={{ minWidth: '240px' }}>Title</th>
              <th style={{ width: '110px', textAlign: 'right' }}>Max Marks</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Validated Marks</th>
              <th style={{ width: '90px', textAlign: 'right' }}>Validated %</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Grade</th>
              <th style={{ width: '60px', textAlign: 'center', color: '#10b981' }}>Y</th>
              <th style={{ width: '60px', textAlign: 'center', color: '#3b82f6' }}>C</th>
              <th style={{ width: '60px', textAlign: 'center', color: '#f59e0b' }}>W</th>
              <th style={{ width: '60px', textAlign: 'center', color: '#ef4444' }}>D</th>
              <th style={{ width: '90px', textAlign: 'center', color: '#64748b' }}>Unscored</th>
              <th style={{ width: '90px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.code}>
                <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{r.code}</td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {r.title}
                  {/* Mini progress bar */}
                  <div style={{ width: '100%', height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', marginTop: '6px' }}>
                    <div style={{
                      width: `${Math.min(r.percentage, 100)}%`,
                      height: '100%',
                      background: r.grade === 'Y' ? '#10b981' : (r.grade === 'C' ? '#3b82f6' : (r.grade === 'W' ? '#f59e0b' : '#ef4444')),
                      borderRadius: '2px'
                    }} />
                  </div>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: '#94a3b8' }}>{r.max_marks}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#f8fafc' }}>{r.validated_marks}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: '#38bdf8' }}>{r.percentage}%</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`badge badge-${(r.grade || 'd').toLowerCase()}`}>
                    {r.grade}
                  </span>
                </td>
                <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{r.count_y}</td>
                <td style={{ textAlign: 'center', color: '#3b82f6', fontWeight: 700 }}>{r.count_c}</td>
                <td style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 700 }}>{r.count_w}</td>
                <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>{r.count_d}</td>
                <td style={{ textAlign: 'center', color: '#64748b' }}>{r.unscored}</td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => onSelectCriterion(r.code)}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.725rem', padding: '3px 8px' }}
                  >
                    Inspect
                  </button>
                </td>
              </tr>
            ))}

            {/* Total Row matching Excel Criterion Summary */}
            <tr style={{ background: '#172338', borderTop: '2px solid #334863', fontWeight: 800 }}>
              <td style={{ color: '#fff' }}>TOTAL</td>
              <td style={{ color: '#fff' }}>Overall Institutional Academic Audit Score</td>
              <td style={{ textAlign: 'right', color: '#e2e8f0' }}>{totals.max_marks}</td>
              <td style={{ textAlign: 'right', color: '#818cf8', fontSize: '1rem' }}>{totals.validated_marks}</td>
              <td style={{ textAlign: 'right', color: '#10b981', fontSize: '1rem' }}>{totals.percentage}%</td>
              <td style={{ textAlign: 'center' }}>
                <span className={`badge badge-${(totals.grade || 'd').toLowerCase()}`} style={{ fontSize: '0.85rem' }}>
                  {totals.grade}
                </span>
              </td>
              <td style={{ textAlign: 'center', color: '#10b981' }}>{totals.count_y}</td>
              <td style={{ textAlign: 'center', color: '#3b82f6' }}>{totals.count_c}</td>
              <td style={{ textAlign: 'center', color: '#f59e0b' }}>{totals.count_w}</td>
              <td style={{ textAlign: 'center', color: '#ef4444' }}>{totals.count_d}</td>
              <td style={{ textAlign: 'center', color: '#64748b' }}>{totals.unscored}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}
