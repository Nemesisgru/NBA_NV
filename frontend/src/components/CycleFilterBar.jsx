import React from 'react';
import { Calendar, Filter } from 'lucide-react';

// Per-tab academic year / audit cycle filter, kept in sync with the cycle picker in the top ribbon
export default function CycleFilterBar({ cycles, selectedCycle, setSelectedCycle, tabLabel }) {
  const current = cycles.find(c => c.id === selectedCycle);
  const years = [...new Set(cycles.map(c => c.academic_year))].sort().reverse();
  const yearCycles = cycles.filter(c => c.academic_year === current?.academic_year);

  const handleYearChange = (year) => {
    const first = cycles.find(c => c.academic_year === year);
    if (first) setSelectedCycle(first.id);
  };

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '10px',
      padding: '10px 18px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
      boxShadow: 'var(--shadow-card)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} color="var(--primary)" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Academic Year:</span>
          <select
            value={current?.academic_year || ''}
            onChange={(e) => handleYearChange(e.target.value)}
            style={{ width: '120px', padding: '5px 8px', fontSize: '0.8rem' }}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={14} color="var(--primary)" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Semester / Cycle:</span>
          <select
            value={selectedCycle || ''}
            onChange={(e) => setSelectedCycle(Number(e.target.value))}
            style={{ width: '190px', padding: '5px 8px', fontSize: '0.8rem' }}
          >
            {yearCycles.map(c => (
              <option key={c.id} value={c.id}>{c.semester} ({c.cycle_type})</option>
            ))}
          </select>
        </div>
      </div>

      {current && (
        <span style={{
          fontSize: '0.75rem',
          color: 'var(--primary)',
          background: 'var(--primary-light)',
          border: '1px solid var(--primary-border)',
          padding: '3px 10px',
          borderRadius: '4px',
          fontWeight: 600
        }}>
          Showing {tabLabel} for {current.academic_year} • {current.semester} ({current.cycle_type})
        </span>
      )}
    </div>
  );
}
