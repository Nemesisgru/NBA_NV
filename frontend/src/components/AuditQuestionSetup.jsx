import React, { useEffect, useMemo, useState } from 'react';
import { ListChecks, Save, RotateCcw, Search, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

// Round to at most two decimal places for display
const fmt2 = (v) => Math.round((parseFloat(v) || 0) * 100) / 100;

// Admin only: fix which questions of each criterion are part of the selected audit cycle.
// The selection applies to every auditor and department allocated in that cycle.
export default function AuditQuestionSetup({ selectedCycleId, onSaved }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [savedSelection, setSavedSelection] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set(['C1']));
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    if (!selectedCycleId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/cycle-questions/?cycle_id=${selectedCycleId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load questions');
      const ids = new Set(json.criteria.flatMap(c => c.metrics.filter(m => m.selected).map(m => m.id)));
      setData(json);
      setSelected(ids);
      setSavedSelection(ids);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCycleId]);

  const allQuestions = useMemo(
    () => (data?.criteria || []).flatMap(c => c.metrics.filter(m => !m.is_header).map(m => ({ ...m, criterion: c.code }))),
    [data]
  );
  const totalMarks = allQuestions.reduce((s, m) => s + m.max_marks, 0);
  const selectedMarks = allQuestions.filter(m => selected.has(m.id)).reduce((s, m) => s + m.max_marks, 0);

  const isDirty = selected.size !== savedSelection.size || [...selected].some(id => !savedSelection.has(id));
  // Questions already scored in this audit that the new selection would leave out
  const droppedScored = allQuestions.filter(m => !selected.has(m.id) && savedSelection.has(m.id) && m.scored_departments > 0);

  const toggle = (ids, on) => {
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const toggleExpanded = (code) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const save = async (reset = false) => {
    if (!reset && selected.size === 0) {
      setMessage({ type: 'error', text: 'Select at least one question before saving.' });
      return;
    }
    if (droppedScored.length > 0 && !reset && !window.confirm(
      `${droppedScored.length} question(s) already scored in this audit will be left out of the scores and ATR. ` +
      'Their entries are kept and come back if you select the question again. Continue?'
    )) return;

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/cycle-questions/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reset ? { cycle_id: selectedCycleId, reset: true } : { cycle_id: selectedCycleId, metric_ids: [...selected] })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      onSaved?.(selectedCycleId, json.criteria_totals, json.questions_fixed);
      await load();
      setMessage({
        type: 'success',
        text: reset
          ? 'Reset: every question is part of this audit.'
          : `Saved: ${json.question_count} questions (${fmt2(json.max_marks)} marks) fixed for all auditors in this audit.`
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '40px', color: 'var(--text-secondary)' }}>
        <Loader2 size={18} className="animate-spin" /> Loading questions...
      </div>
    );
  }
  if (!data) {
    return <div style={{ padding: '24px', color: 'var(--grade-d)' }}>{message?.text || 'No audit cycle selected.'}</div>;
  }

  const q = search.trim().toLowerCase();
  const matches = (m) => !q || m.code.toLowerCase().includes(q) || m.key_aspect.toLowerCase().includes(q);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Header card */}
      <div style={{
        background: 'var(--hero-gradient)',
        border: '1px solid var(--hero-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <ListChecks size={22} color="var(--accent)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Audit Questions</h2>
            <span className="badge" style={data.questions_fixed
              ? { background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent)' }
              : { background: 'var(--bg-card-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
              {data.questions_fixed ? 'Selection fixed' : 'All questions (default)'}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Fix the questions of each criterion for <strong>{data.cycle.name}</strong>. The selection applies to all auditors
            ({data.departments_allocated} departments allocated) and to scores, summaries, comparison, exports and ATR of this audit only.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)' }}>
              {selected.size}<span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}> / {allQuestions.length}</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>questions</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
              {fmt2(selectedMarks)}<span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}> / {fmt2(totalMarks)}</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>max marks</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '420px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search question code or text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '32px' }}
          />
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => toggle(allQuestions.map(m => m.id), true)}>Select all</button>
        <button className="btn btn-outline btn-sm" onClick={() => setSelected(new Set())}>Clear all</button>
        <button className="btn btn-outline btn-sm" onClick={() => setExpanded(new Set(data.criteria.map(c => c.code)))}>Expand all</button>
        <button className="btn btn-outline btn-sm" onClick={() => setExpanded(new Set())}>Collapse all</button>
        <div style={{ flex: 1 }} />
        {data.questions_fixed && (
          <button className="btn btn-secondary btn-sm" onClick={() => save(true)} disabled={saving} title="Use every question in this audit">
            <RotateCcw size={14} /> Reset to all
          </button>
        )}
        <button className="btn btn-primary" onClick={() => save(false)} disabled={saving || !isDirty}
          style={{ opacity: saving || !isDirty ? 0.6 : 1 }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {isDirty ? 'Save selection' : 'Saved'}
        </button>
      </div>

      {message && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem',
          background: message.type === 'success' ? 'var(--grade-y-bg)' : 'var(--grade-d-bg)',
          color: message.type === 'success' ? 'var(--grade-y)' : 'var(--grade-d)'
        }}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {message.text}
        </div>
      )}
      {isDirty && droppedScored.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem',
          background: 'var(--grade-w-bg)', color: 'var(--grade-w)'
        }}>
          <AlertTriangle size={16} /> {droppedScored.length} question(s) you are removing already have scores in this audit
          ({droppedScored.slice(0, 6).map(m => m.code).join(', ')}{droppedScored.length > 6 ? ', ...' : ''}).
        </div>
      )}

      {/* Criteria */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {data.criteria.map(c => {
          const questions = c.metrics.filter(m => !m.is_header);
          const visible = c.metrics.filter(m => m.is_header || matches(m));
          // Drop section headers left with no visible question under them
          const rows = visible.filter((m, i) => !m.is_header || (visible[i + 1] && !visible[i + 1].is_header));
          if (q && rows.length === 0) return null;

          const nSel = questions.filter(m => selected.has(m.id)).length;
          const marksSel = questions.filter(m => selected.has(m.id)).reduce((s, m) => s + m.max_marks, 0);
          const marksAll = questions.reduce((s, m) => s + m.max_marks, 0);
          const allOn = nSel === questions.length && questions.length > 0;
          const isOpen = expanded.has(c.code) || !!q;

          return (
            <div key={c.code} style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${nSel > 0 ? 'var(--border-subtle)' : 'var(--grade-d-bg)'}`,
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-card)',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer' }}
                onClick={() => toggleExpanded(c.code)}>
                <input
                  type="checkbox"
                  checked={allOn}
                  ref={el => { if (el) el.indeterminate = nSel > 0 && !allOn; }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => toggle(questions.map(m => m.id), e.target.checked)}
                  title="Select every question of this criterion"
                />
                {isOpen ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
                <span className="seg-code">{c.code}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{c.title}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: '0.75rem', color: nSel ? 'var(--text-secondary)' : 'var(--grade-d)', fontWeight: 600 }}>
                  {nSel} / {questions.length} questions
                </span>
                <span className="seg-meta">{fmt2(marksSel)} / {fmt2(marksAll)}M</span>
              </div>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {rows.map(m => m.is_header ? (
                    <div key={m.id} style={{
                      padding: '8px 16px 6px 48px', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.03em',
                      textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-light)'
                    }}>
                      {m.code} {m.key_aspect}
                    </div>
                  ) : (
                    <div key={m.id} onClick={() => toggle([m.id], !selected.has(m.id))} style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 16px 9px 48px',
                      borderTop: '1px solid var(--border-table)', cursor: 'pointer',
                      opacity: selected.has(m.id) ? 1 : 0.6
                    }}>
                      <input type="checkbox" checked={selected.has(m.id)} onClick={(e) => e.stopPropagation()}
                        onChange={(e) => toggle([m.id], e.target.checked)} />
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', minWidth: '48px' }}>
                        {m.code}
                      </span>
                      <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{m.key_aspect}</span>
                      {m.scored_departments > 0 && (
                        <span title="Departments already scored on this question in this audit"
                          style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          scored in {m.scored_departments} dept{m.scored_departments > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="seg-meta">{fmt2(m.max_marks)}M</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
