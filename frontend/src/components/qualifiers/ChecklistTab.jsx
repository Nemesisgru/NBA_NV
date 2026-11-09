import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';

export default function ChecklistTab({ checklist = [], config = {}, onRefresh, onUpdateConfig }) {
  const tier1Items = checklist.filter((item) => item.tier_type === 'Tier 1');
  const tier2Items = checklist.filter((item) => item.tier_type === 'Tier 2');

  const currentList = config.tier_type === 'Tier 2' ? tier2Items : tier1Items;
  const compliedCount = currentList.filter((item) => item.compliance_status === 'Complied').length;
  const totalCount = currentList.length;
  const allComplied = totalCount > 0 && compliedCount === totalCount;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner / Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: allComplied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: allComplied ? '#10b981' : '#ef4444',
            }}
          >
            {allComplied ? <CheckCircle2 size={28} /> : <AlertTriangle size={28} />}
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Overall Pre-Visit Status ({config.tier_type || 'Tier 1'})
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: allComplied ? '#10b981' : '#ef4444', marginTop: '2px' }}>
              {compliedCount} of {totalCount} Complied
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {allComplied ? 'Eligible to apply for NBA Accreditation' : 'Resolve red qualifiers before applying'}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Selected Institution Tier
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['Tier 1', 'Tier 2'].map((tier) => (
                <button
                  key={tier}
                  onClick={() => onUpdateConfig && onUpdateConfig({ tier_type: tier })}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: config.tier_type === tier ? 'var(--primary)' : 'var(--border-subtle)',
                    background: config.tier_type === tier ? 'var(--primary-light)' : 'transparent',
                    color: config.tier_type === tier ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: config.tier_type === tier ? 700 : 500,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Current Institution: <strong style={{ color: 'var(--text-primary)' }}>{config.institution_name}</strong>
          </div>
        </div>
      </div>

      {/* Main Checklist Table Card */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="var(--primary)" />
              1. Pre-Visit Qualifiers & Compliance Checklist ({config.tier_type || 'Tier 1'})
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Evaluates all criteria automatically using data entered in Master & Allied Programs and Primary Check.
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Recalculate
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-table-header)', borderBottom: '2px solid var(--border-subtle)' }}>
                <th style={{ padding: '12px 14px', width: '50px', color: 'var(--text-secondary)' }}>S.N.</th>
                <th style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>Pre-Visit Qualifiers</th>
                <th style={{ padding: '12px 14px', width: '180px', color: 'var(--text-secondary)' }}>Current Status</th>
                <th style={{ padding: '12px 14px', width: '150px', textAlign: 'center', color: 'var(--text-secondary)' }}>Compliance Status</th>
              </tr>
            </thead>
            <tbody>
              {currentList.map((item) => {
                const isComplied = item.compliance_status === 'Complied';
                return (
                  <tr
                    key={item.id || item.sno}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isComplied ? 'rgba(16, 185, 129, 0.02)' : 'rgba(239, 68, 68, 0.02)',
                    }}
                  >
                    <td style={{ padding: '14px', fontWeight: 700, color: 'var(--text-muted)' }}>{item.sno}</td>
                    <td style={{ padding: '14px', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                      {item.qualifier_text}
                    </td>
                    <td style={{ padding: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      <span
                        style={{
                          background: 'var(--bg-card)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          display: 'inline-block',
                          fontSize: '0.8rem',
                        }}
                      >
                        {item.current_status || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          fontSize: '0.775rem',
                          fontWeight: 700,
                          background: isComplied ? 'var(--grade-y-bg)' : 'var(--grade-d-bg)',
                          color: isComplied ? 'var(--grade-y)' : 'var(--grade-d)',
                          border: `1px solid ${isComplied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        }}
                      >
                        {isComplied ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {item.compliance_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* HOD Qualification Checklist Reference */}
        <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px' }}>
            HOD Qualification Checks across Programs:
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {['MP', 'AL1', 'AL2', 'AL3', 'AL4', 'AL5', 'AL6'].map((progKey) => {
              const labelMap = {
                MP: 'Master Program (CSE)',
                AL1: 'Allied 1 (AIDS)',
                AL2: 'Allied 2 (CSE AIML)',
                AL3: 'Allied 3 (Cyber Sec)',
                AL4: 'Allied 4 (IT)',
                AL5: 'Allied 5 (CSBS)',
                AL6: 'Allied 6',
              };
              return (
                <div
                  key={progKey}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{labelMap[progKey]}</span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: 'var(--grade-d)',
                    }}
                  >
                    HOD PhD: No
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

