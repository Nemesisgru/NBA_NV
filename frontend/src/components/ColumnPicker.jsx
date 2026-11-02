import React, { useEffect, useRef, useState } from 'react';
import { Columns3 } from 'lucide-react';
import { AUDIT_COLUMNS, TOGGLEABLE_COLUMNS, DEFAULT_COLUMNS, countShown } from '../auditColumns';

// Dropdown listing every evaluation table column, grouped, with show/hide toggles.
// `value` is {column key: bool}; `onChange` receives the new object.
export default function ColumnPicker({ value, onChange, title = 'COLUMNS', highlight = false, footer }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on a click outside the menu
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const groups = [...new Set(AUDIT_COLUMNS.map(c => c.group))];
  const setAll = (on) => onChange(Object.fromEntries(TOGGLEABLE_COLUMNS.map(c => [c.key, on])));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(!open)}
        style={highlight ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined}
        title="Choose the columns of the evaluation table"
      >
        <Columns3 size={14} /> Columns ({countShown(value)}/{TOGGLEABLE_COLUMNS.length}) {open ? '▲' : '▼'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, width: '290px',
          maxHeight: '70vh', overflowY: 'auto',
          background: 'var(--bg-modal)', border: '1px solid var(--border-modal)', borderRadius: 'var(--radius-md)',
          boxShadow: '0 16px 40px -12px rgba(0, 0, 0, 0.35)', padding: '12px'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
            paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px'
          }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{title}</span>
            <span style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', fontWeight: 700 }}>
              <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => setAll(true)}>All</span>
              <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => onChange({ ...DEFAULT_COLUMNS })}>Default</span>
            </span>
          </div>

          {groups.map(group => (
            <div key={group}>
              <div style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--accent)', padding: '8px 4px 2px' }}>
                {group}
              </div>
              {AUDIT_COLUMNS.filter(c => c.group === group).map(c => {
                const checked = c.locked || Boolean(value?.[c.key]);
                return (
                  <div
                    key={c.key}
                    onClick={() => !c.locked && onChange({ ...value, [c.key]: !checked })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 4px', borderRadius: '6px',
                      cursor: c.locked ? 'default' : 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)',
                      opacity: c.locked ? 0.6 : 1
                    }}
                  >
                    <input type="checkbox" checked={checked} readOnly disabled={c.locked} style={{ pointerEvents: 'none' }} />
                    <span style={{ flex: 1 }}>{c.label}</span>
                    {c.locked && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>always</span>}
                  </div>
                );
              })}
            </div>
          ))}

          {footer && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
