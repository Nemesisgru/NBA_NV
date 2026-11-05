import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Send, RotateCcw, FileText, Download, AlertTriangle, CheckCircle2, Loader2, Info, ShieldAlert, Cpu } from 'lucide-react';
import { COMPARE_SELECTION_KEY } from './ComparisonPage';

// Audit AI Assistant. Every number and table here comes from the backend's verified analytics;
// the local model only adds optional narration, shown as plain text (never rendered as HTML).

const fmtRatio = (r) => (r && typeof r === 'object' && 'numerator' in r)
  ? `${r.numerator} / ${r.denominator}${r.percent !== null ? ` (${r.percent}%)` : ''}`
  : (r ?? '-');
const fmt = (v) => (v === null || v === undefined || v === '') ? '-' : (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : fmtRatio(v));
const fmtTime = (iso) => iso ? new Date(iso).toLocaleString() : 'no data recorded';

const card = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-card)', padding: '16px'
};

function Kpi({ label, value, sub, color }) {
  return (
    <div style={{ ...card, padding: '12px 14px', minWidth: '150px', flex: '1 1 150px' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: color || 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}

function DataTable({ columns, rows, caption }) {
  if (!rows || rows.length === 0) return <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>No rows.</div>;
  return (
    <div style={{ overflowX: 'auto', maxHeight: '360px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
      <table className="audit-table" style={{ fontSize: '0.75rem' }}>
        {caption && <caption style={{ textAlign: 'left', padding: '6px 10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{caption}</caption>}
        <thead><tr>{columns.map(c => <th key={c.key} scope="col">{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{columns.map(c => <td key={c.key}>{c.render ? c.render(r) : fmt(r[c.key])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const gradeBadge = (g) => g ? <span className={`badge badge-${g.toLowerCase()}`}>{g}</span> : '-';

// Accessible horizontal bar chart of criterion percentages (the table below holds the same data)
function CriterionBars({ rows }) {
  const data = rows.filter(r => r.percentage !== null && r.percentage !== undefined);
  if (data.length === 0) return null;
  const desc = data.map(r => `${r.criterion} ${r.percentage}%`).join(', ');
  return (
    <div role="img" aria-label={`Criterion percentages: ${desc}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '8px 0' }}>
      {data.map(r => (
        <div key={r.criterion} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
          <span className="seg-code" style={{ minWidth: '30px', textAlign: 'center' }}>{r.criterion}</span>
          <div style={{ flex: 1, background: 'var(--bg-card-hover)', borderRadius: '4px', height: '10px' }}>
            <div style={{ width: `${Math.min(100, r.percentage)}%`, height: '100%', borderRadius: '4px', background: `var(--grade-${(r.grade || 'd').toLowerCase()})` }} />
          </div>
          <span style={{ minWidth: '48px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.percentage}%</span>
        </div>
      ))}
    </div>
  );
}

// Dropdown with checkboxes; an empty selection means "all authorised"
function MultiSelect({ label, allLabel, options, selected, onChange, width = '220px', extra }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const chosen = options.filter(o => selected.includes(o.value));
  const summary = chosen.length === 0 ? allLabel
    : chosen.length <= 2 ? chosen.map(o => o.label).join(', ') : `${chosen.length} selected`;
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  return (
    <div ref={boxRef} style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px', position: 'relative' }}>
      {label}
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}
        style={{ width, textAlign: 'left', padding: '8px 12px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-input)', background: 'var(--bg-input)', color: 'var(--text-primary)', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <div role="listbox" aria-multiselectable="true" style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 60, minWidth: width, maxHeight: '320px', overflowY: 'auto',
          background: 'var(--bg-modal)', border: '1px solid var(--border-modal)', borderRadius: 'var(--radius-md)',
          boxShadow: '0 16px 40px -12px rgba(0, 0, 0, 0.35)', padding: '8px'
        }}>
          <div style={{ display: 'flex', gap: '6px', paddingBottom: '6px', marginBottom: '4px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange(options.map(o => o.value))}>Select all</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange([])}>{allLabel}</button>
            {extra}
          </div>
          {options.map(o => (
            <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 500 }}>
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function RefChip({ code, onOpenCriterion }) {
  const crit = /^C[1-9]$/.test(code) ? code : (/^\d\./.test(code) ? `C${code[0]}` : null);
  return crit ? (
    <button className="seg-code" onClick={() => onOpenCriterion(crit)} title={`Open ${crit} in Criteria Evaluation`}
      style={{ border: 'none', cursor: 'pointer', marginRight: '4px' }}>{code}</button>
  ) : <span className="seg-meta" style={{ marginRight: '4px' }}>{code}</span>;
}

function ResultView({ result, onOpenCriterion }) {
  const [showDefs, setShowDefs] = useState(false);
  const t = result.totals || {};
  const critCode = (r) => <RefChip code={r.criterion} onOpenCriterion={onOpenCriterion} />;
  let body = null;

  if (result.operation === 'audit_summary') {
    body = (
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <Kpi label="Overall score" value={result.withheld?.includes('percentage') ? 'Hidden' : (t.percentage !== null ? `${t.percentage}%` : 'No scores')} sub={`${fmt(t.marks_obtained)} / ${fmt(t.max_marks)} marks`} color="var(--primary)" />
          <Kpi label="Grade / status" value={t.grade || '-'} sub={t.compliance} color={t.grade ? `var(--grade-${t.grade.toLowerCase()})` : undefined} />
          <Kpi label="Submissions completed" value={fmtRatio(t.submission_completed)} />
          <Kpi label="Evidence uploaded" value={fmtRatio(t.evidence_uploaded)} sub={t.evidence_files_manual_check ? `${t.evidence_files_manual_check} file(s) need manual verification` : 'questions with a file'} />
          <Kpi label="Evidence verified" value={fmtRatio(t.evidence_verified)} sub={`auditor recorded complete: ${fmtRatio(t.evidence_complete)}`} />
          <Kpi label="Findings" value={t.findings} sub={`ATR open ${t.atr_open} · in progress ${t.atr_in_progress} · closed ${t.atr_closed} · approved ${t.findings_approved}`} />
        </div>
        <CriterionBars rows={result.criteria || []} />
        <DataTable rows={result.criteria} columns={[
          { key: 'criterion', label: 'Criterion', render: critCode }, { key: 'title', label: 'Title' },
          { key: 'submission_completed', label: 'Scored' }, { key: 'percentage', label: '%' },
          { key: 'grade', label: 'Grade', render: r => gradeBadge(r.grade) }, { key: 'compliance', label: 'Status' },
          { key: 'evidence_verified', label: 'Evidence verified' }, { key: 'findings', label: 'Findings' },
          { key: 'atr_open', label: 'ATR open' }]} />
        {result.departments?.length > 0 && (
          <DataTable caption="By department" rows={result.departments} columns={[
            { key: 'department', label: 'Department' }, { key: 'submission_completed', label: 'Scored' },
            { key: 'percentage', label: '%' }, { key: 'grade', label: 'Grade', render: r => gradeBadge(r.grade) },
            { key: 'compliance', label: 'Status' }, { key: 'findings', label: 'Findings' }, { key: 'atr_open', label: 'ATR open' }]} />
        )}
      </>
    );
  } else if (result.operation === 'missing_evidence') {
    body = (
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <Kpi label="Not uploaded" value={fmtRatio(t.evidence_not_uploaded)} color="var(--grade-d)" />
          <Kpi label="Partial" value={fmtRatio(t.evidence_partial)} color="var(--grade-w)" />
          <Kpi label="Not assessed yet" value={fmtRatio(t.not_assessed)} />
          <Kpi label="Mandatory without file" value={t.mandatory_configured ? fmtRatio(t.mandatory_without_file) : 'Not configured'} color="var(--primary)" />
        </div>
        <DataTable rows={result.rows} columns={[
          { key: 'department', label: 'Department' }, { key: 'criterion', label: 'Criterion', render: critCode },
          { key: 'question', label: 'Question' }, { key: 'key_aspect', label: 'Key aspect' },
          { key: 'evidence_status', label: 'Evidence' }, { key: 'mandatory', label: 'Mandatory' },
          { key: 'files_uploaded', label: 'Files' }, { key: 'physical_check', label: 'Physical check' },
          { key: 'grade', label: 'Grade', render: r => gradeBadge(r.grade) }]} />
      </>
    );
  } else if (result.operation === 'search_evidence') {
    body = (
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <Kpi label="Matching passages" value={t.matches_listed} sub={result.query_terms?.length ? `words: ${result.query_terms.join(', ')}` : 'no search words'} />
          <Kpi label="Files in scope" value={t.files_in_scope} sub={t.files_needing_manual_check ? `${t.files_needing_manual_check} need manual verification` : ''} />
        </div>
        <DataTable rows={result.rows} columns={[
          { key: 'evidence_id', label: 'Evidence', render: r => <a href={`/api/evidence/${r.evidence_id.slice(3)}/download/`}>{r.evidence_id}</a> },
          { key: 'file', label: 'File' }, { key: 'location', label: 'Location' },
          { key: 'criterion', label: 'Criterion', render: critCode }, { key: 'question', label: 'Question' },
          { key: 'excerpt', label: 'Excerpt (quoted from the document)', render: r => <span style={{ fontStyle: 'italic' }}>"{r.excerpt}"</span> }]} />
      </>
    );
  } else if (result.operation === 'pending_corrective_actions') {
    body = (
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <Kpi label="Matching actions" value={t.matching_actions} />
          <Kpi label="Overdue" value={t.overdue} color="var(--grade-d)" sub={`as of ${t.as_of_date}`} />
          <Kpi label="No target date" value={t.without_target_date} />
          <Kpi label="Plan not entered" value={t.action_plan_not_entered} />
          <Kpi label="Closed, awaiting sign-off" value={t.closed_awaiting_auditor_signoff} />
        </div>
        <DataTable rows={result.rows} columns={[
          { key: 'atr_id', label: 'ATR' }, { key: 'department', label: 'Department' },
          { key: 'criterion', label: 'Criterion', render: critCode }, { key: 'question', label: 'Question' },
          { key: 'status', label: 'Status' }, { key: 'target_date', label: 'Target date' },
          { key: 'days_overdue', label: 'Days overdue' }, { key: 'owner', label: 'Owner' },
          { key: 'action_plan', label: 'Action plan', render: r => r.action_plan || 'Not yet entered' }]} />
      </>
    );
  } else if (result.operation === 'criterion_findings') {
    body = (
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <Kpi label="Findings" value={t.findings} sub={Object.entries(t.by_grade || {}).map(([g, n]) => `${g}: ${n}`).join(' · ')} />
          <Kpi label="Approved (listed rows)" value={fmtRatio(t.approved_in_listed_rows)} />
        </div>
        <DataTable rows={result.rows} columns={[
          { key: 'department', label: 'Department' }, { key: 'criterion', label: 'Criterion', render: critCode },
          { key: 'question', label: 'Question' }, { key: 'key_aspect', label: 'Key aspect' },
          { key: 'grade', label: 'Grade', render: r => gradeBadge(r.grade) }, { key: 'percentage', label: '%' },
          { key: 'auditor_remarks', label: 'Auditor remarks' }, { key: 'atr_status', label: 'ATR' },
          { key: 'finding_approved', label: 'Approved' }]} />
      </>
    );
  } else if (result.operation === 'compare_departments') {
    const cols = result.department_columns || [];
    const cell = (v) => (v && v.percentage !== null && v.percentage !== undefined)
      ? <span>{v.percentage}% {gradeBadge(v.grade)}</span> : '-';
    body = (
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <Kpi label="Departments compared" value={t.departments_compared} sub={`${t.colleges_compared} college(s) · ${t.criteria_compared} criteria${result.criterion_filter ? ` (${result.criterion_filter} only)` : ''}`} />
          <Kpi label="Highest" value={t.highest_percent !== null && t.highest_percent !== undefined ? `${t.highest_percent}%` : '-'} sub={t.highest} color="var(--grade-y)" />
          <Kpi label="Lowest" value={t.lowest_percent !== null && t.lowest_percent !== undefined ? `${t.lowest_percent}%` : '-'} sub={t.lowest} color="var(--grade-d)" />
        </div>
        <DataTable caption="Ranking (overall for the questions compared)" rows={result.departments} columns={[
          { key: 'rank', label: 'Rank' }, { key: 'department', label: 'Department' },
          { key: 'percentage', label: '%' }, { key: 'grade', label: 'Grade', render: r => gradeBadge(r.grade) },
          { key: 'submission_completed', label: 'Scored' }, { key: 'compliance', label: 'Status' },
          { key: 'findings', label: 'Findings' }, { key: 'atr_open', label: 'ATR open' }]} />
        <DataTable caption="Criterion by criterion" rows={result.criteria} columns={[
          { key: 'criterion', label: 'Criterion', render: critCode },
          ...cols.map(c => ({ key: `d${c.id}`, label: c.label, render: r => cell(r.values?.[c.id]) })),
          { key: 'highest', label: 'Highest', render: r => r.highest ? `${r.highest} (${r.highest_percent}%)` : '-' },
          { key: 'lowest', label: 'Lowest', render: r => r.lowest ? `${r.lowest} (${r.lowest_percent}%)` : '-' },
          { key: 'spread', label: 'Gap (points)' }]} />
        {result.colleges?.length > 0 && (
          <DataTable caption="By college (selected departments only)" rows={result.colleges} columns={[
            { key: 'college', label: 'College' }, { key: 'departments_compared', label: 'Departments' },
            { key: 'percentage', label: '%' }, { key: 'grade', label: 'Grade', render: r => gradeBadge(r.grade) },
            ...(result.criteria || []).map(c => ({ key: `c${c.criterion}`, label: c.criterion, render: r => cell(r.criteria?.[c.criterion]) })),
            { key: 'findings', label: 'Findings' }]} />
        )}
      </>
    );
  } else if (result.operation === 'compare_cycles') {
    body = (
      <>
        <div style={{
          ...card, padding: '10px 14px', fontSize: '0.8rem',
          background: result.compatible ? 'var(--grade-y-bg)' : 'var(--grade-w-bg)',
          color: result.compatible ? 'var(--grade-y)' : 'var(--grade-w)'
        }}>
          {result.compare_cycle
            ? <>Compared with <strong>{result.compare_cycle.name}</strong>: {result.compatible ? 'identical question sets.' : 'question sets differ - only identical criteria are compared, no overall ranking.'}</>
            : 'No comparison possible.'}
        </div>
        {(result.departments || []).map(d => (
          <div key={d.department} style={{ marginTop: '8px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', margin: '4px 0' }}>
              {d.department}{d.overall && <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                {' '}· overall {d.overall.current_percent}% vs {d.overall.previous_percent}% ({d.overall.change > 0 ? '+' : ''}{d.overall.change} points)</span>}
            </div>
            <DataTable rows={d.criteria} columns={[
              { key: 'criterion', label: 'Criterion', render: critCode }, { key: 'current_percent', label: 'Current %' },
              { key: 'previous_percent', label: 'Previous %' }, { key: 'change', label: 'Change' },
              { key: 'current_grade', label: 'Grade now', render: r => gradeBadge(r.current_grade) },
              { key: 'coverage_note', label: 'Coverage note' }]} />
          </div>
        ))}
        {(result.criteria || []).filter(c => !c.compatible).length > 0 && (
          <ul style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px', paddingLeft: '18px' }}>
            {result.criteria.filter(c => !c.compatible).map(c => <li key={c.criterion}>{c.criterion} not compared: {c.reason}</li>)}
          </ul>
        )}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span><CheckCircle2 size={12} style={{ verticalAlign: '-2px', color: 'var(--grade-y)' }} /> Verified from the audit database</span>
        <span>Scope: {result.scope?.label}</span>
        <span>Data as of: {fmtTime(result.data_as_of)}</span>
        {result.truncated && <span style={{ color: 'var(--grade-w)' }}>Only the first rows are listed</span>}
      </div>
      {body}
      {result.notes?.length > 0 && (
        <ul style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingLeft: '18px', margin: 0 }}>
          {result.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
      <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowDefs(!showDefs)}>
        <Info size={13} /> {showDefs ? 'Hide' : 'How these figures are defined'}
      </button>
      {showDefs && (
        <dl style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
          {Object.entries(result.definitions || {}).map(([k, v]) => (
            <div key={k} style={{ marginBottom: '4px' }}><dt style={{ fontWeight: 700, display: 'inline' }}>{k.replace(/_/g, ' ')}: </dt><dd style={{ display: 'inline', margin: 0 }}>{v}</dd></div>
          ))}
        </dl>
      )}
    </div>
  );
}

function NarrationView({ narration, onOpenCriterion }) {
  if (!narration) return null;
  if (narration.pending) {
    return (
      <div style={{ ...card, padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        <Loader2 size={13} className="animate-spin" style={{ verticalAlign: '-2px' }} /> The local model is writing an explanation.
        This can take a few minutes on this computer; the verified figures above are already complete.
      </div>
    );
  }
  if (narration.unavailable) {
    return (
      <div style={{ ...card, padding: '10px 14px', fontSize: '0.78rem', background: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}>
        <Cpu size={13} style={{ verticalAlign: '-2px' }} /> AI narration unavailable: {narration.unavailable} The verified figures above are complete without it.
      </div>
    );
  }
  const list = (items) => items.map((o, i) => (
    <li key={i} style={{ marginBottom: '4px' }}>
      {o.text} {o.refs?.map(r => <RefChip key={r} code={r} onOpenCriterion={onOpenCriterion} />)}
      {o.unverified_numbers?.length > 0 && <span style={{ color: 'var(--grade-w)', fontSize: '0.7rem' }}> (unverified number: {o.unverified_numbers.join(', ')})</span>}
    </li>
  ));
  return (
    <div style={{ ...card, borderLeft: '3px solid var(--accent)', fontSize: '0.82rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '6px', letterSpacing: '0.03em' }}>
        AI EXPLANATION · local model {narration.model} · check against the verified tables
      </div>
      {narration.summary && <p style={{ margin: '0 0 8px' }}>{narration.summary}</p>}
      {narration.observations?.length > 0 && <><strong style={{ fontSize: '0.75rem' }}>Observations</strong><ul style={{ paddingLeft: '18px', margin: '4px 0 8px' }}>{list(narration.observations)}</ul></>}
      {narration.suggested_actions?.length > 0 && <><strong style={{ fontSize: '0.75rem' }}>Suggested actions (suggestions, not findings)</strong><ul style={{ paddingLeft: '18px', margin: '4px 0 8px' }}>{list(narration.suggested_actions)}</ul></>}
      {narration.insufficient_information?.length > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Insufficient information: {narration.insufficient_information.join(' ')}</div>}
      {narration.warnings?.map((w, i) => <div key={i} style={{ fontSize: '0.72rem', color: 'var(--grade-w)', marginTop: '4px' }}><AlertTriangle size={12} style={{ verticalAlign: '-2px' }} /> {w}</div>)}
    </div>
  );
}

export default function AIAssistant({ selectedDepartmentId, selectedCycleId, onOpenCriterion, userRole }) {
  const [status, setStatus] = useState(null);
  const [modelSaving, setModelSaving] = useState(false);
  const [error, setError] = useState('');
  const [colleges, setColleges] = useState([]);
  const [departmentIds, setDepartmentIds] = useState(selectedDepartmentId ? [String(selectedDepartmentId)] : []);
  const departmentId = departmentIds.length === 1 ? departmentIds[0] : '';
  const [cycleId, setCycleId] = useState(selectedCycleId ? String(selectedCycleId) : '');
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [narrate, setNarrate] = useState(true);
  const [reportsList, setReportsList] = useState([]);
  const [reportNarration, setReportNarration] = useState(false);
  const [compareCycleId, setCompareCycleId] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const bottomRef = useRef(null);

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/ai/status/');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load the assistant');
      setStatus(json);
    } catch (e) { setError(e.message); }
  };
  // Admin only: choose which installed local Ollama model the assistant uses for everyone
  const changeModel = async (name) => {
    setModelSaving(true);
    setError('');
    try {
      const res = await fetch('/api/ai/model/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: name })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not change the model');
      setStatus(prev => ({ ...prev, ...json }));
    } catch (e) { setError(e.message); }
    finally { setModelSaving(false); }
  };
  const loadReports = async () => {
    const res = await fetch('/api/ai/reports/');
    if (res.ok) setReportsList((await res.json()).reports);
  };
  useEffect(() => { loadStatus(); loadReports(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending]);

  // Poll while a report is being generated
  useEffect(() => {
    if (!reportsList.some(r => r.status === 'pending' || r.status === 'running')) return;
    const id = setTimeout(loadReports, 3000);
    return () => clearTimeout(id);
  }, [reportsList]);

  const options = status?.options || { colleges: [], departments: [], cycles: [] };
  const deptChoices = useMemo(() => options.departments.filter(d => colleges.length === 0 || colleges.includes(d.college)), [options, colleges]);
  const deptLabel = (id) => { const d = options.departments.find(x => String(x.id) === id); return d ? `${d.college} - ${d.code}` : ''; };
  const scope = { colleges, department_ids: departmentIds, cycle_id: cycleId || undefined };
  const scopeLabel = [
    departmentIds.length > 0
      ? (departmentIds.length <= 4 ? departmentIds.map(deptLabel).join(', ') : `${departmentIds.length} selected departments`)
      : (colleges.length ? `${colleges.join(', ')} (all authorised departments)` : 'All authorised departments'),
    options.cycles.find(c => String(c.id) === cycleId)?.name || 'no audit cycle selected'
  ].join(' · ');

  const changeColleges = (list) => {
    setColleges(list);
    // Keep only departments that belong to the chosen colleges
    if (list.length) setDepartmentIds(ids => ids.filter(id => list.includes(options.departments.find(d => String(d.id) === id)?.college)));
  };
  // Departments picked on the Results Comparison page (kept for this login session)
  const comparisonIds = (() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(COMPARE_SELECTION_KEY) || '[]');
      const known = new Set(options.departments.map(d => d.id));
      return Array.isArray(saved) ? saved.filter(id => known.has(id)).map(String) : [];
    } catch { return []; }
  })();
  const useComparisonSelection = () => { setColleges([]); setDepartmentIds(comparisonIds); };

  const resetConversation = async () => {
    if (conversationId) await fetch(`/api/ai/conversations/${conversationId}/`, { method: 'DELETE' });
    setConversationId(null);
    setMessages([]);
    setError('');
  };

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput('');
    setError('');
    setMessages(m => [...m, { role: 'user', content: message, id: `u${Date.now()}` }]);
    setSending(true);
    try {
      const res = await fetch('/api/ai/chat/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversation_id: conversationId, narrate, ...scope })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'The assistant could not answer');
      setConversationId(json.conversation_id);
      setMessages(m => [...m, json.message]);
      if (json.message.narration?.pending) explain(json.message.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  // Ask the local model to explain a verified result; the answer replaces the pending placeholder
  const explain = async (messageId) => {
    let narration;
    try {
      const res = await fetch(`/api/ai/messages/${messageId}/narrate/`, { method: 'POST' });
      const json = await res.json();
      narration = res.ok ? json.message.narration : { unavailable: json.error || 'The explanation could not be produced.' };
    } catch {
      narration = { unavailable: 'The explanation request failed.' };
    }
    setMessages(m => m.map(x => (x.id === messageId ? { ...x, narration } : x)));
  };

  const generateReport = async () => {
    setReportBusy(true);
    setError('');
    try {
      const res = await fetch('/api/ai/reports/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: departmentId, cycle_id: cycleId, include_narration: reportNarration,
          compare_cycle_id: compareCycleId || undefined })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not start the report');
      await loadReports();
    } catch (e) { setError(e.message); } finally { setReportBusy(false); }
  };

  if (!status && !error) {
    return <div style={{ padding: '40px', color: 'var(--text-secondary)' }}><Loader2 size={18} className="animate-spin" /> Loading the assistant...</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '18px', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
        {/* Header & scope */}
        <div style={{ ...card, background: 'var(--hero-gradient)', border: '1px solid var(--hero-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Bot size={22} color="var(--accent)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Audit AI Assistant</h2>
            {userRole === 'Admin' && status?.installed?.length > 0 ? (
              <label className="badge" title="Models installed in the local Ollama server. Applies to every user."
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: status.available ? 'var(--grade-y-bg)' : 'var(--grade-w-bg)', color: status.available ? 'var(--grade-y)' : 'var(--grade-w)' }}>
                Local model:
                <select value={status.model} disabled={modelSaving} onChange={(e) => changeModel(e.target.value)}
                  style={{ width: 'auto', padding: '2px 6px', fontSize: '0.72rem', fontWeight: 700 }}>
                  {!status.installed.some(m => m.name === status.model) && (
                    <option value={status.model}>{status.model} (not installed)</option>
                  )}
                  {status.installed.map(m => (
                    <option key={m.name} value={m.name}>
                      {m.name}{m.size ? ` (${m.size})` : ''}{m.name === status.default_model ? ' - default' : ''}
                    </option>
                  ))}
                </select>
                {modelSaving && <span style={{ fontWeight: 500 }}>saving...</span>}
              </label>
            ) : (
              <span className="badge" style={status?.available
                ? { background: 'var(--grade-y-bg)', color: 'var(--grade-y)' }
                : { background: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}>
                {status?.available ? `Local model: ${status.model}` : 'AI narration unavailable'}
              </span>
            )}
            <span className="badge" style={{ background: 'var(--grade-w-bg)', color: 'var(--grade-w)' }}>Draft — requires auditor review</span>
          </div>
          {!status?.available && status?.reason && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              <ShieldAlert size={12} style={{ verticalAlign: '-2px' }} /> {status.reason} Verified tables, summaries and report exports still work.
            </p>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px', alignItems: 'center' }}>
            <MultiSelect label="College(s)" allLabel="All authorised" width="170px"
              options={options.colleges.map(c => ({ value: c.code, label: c.code }))}
              selected={colleges} onChange={changeColleges} />
            <MultiSelect label="Department(s)" allLabel="All in scope" width="240px"
              options={deptChoices.map(d => ({ value: String(d.id), label: `${d.college} - ${d.code}` }))}
              selected={departmentIds} onChange={setDepartmentIds}
              extra={comparisonIds.length > 0 && (
                <button type="button" className="btn btn-outline btn-sm" onClick={useComparisonSelection}
                  title="Use the departments selected on the Results Comparison page">
                  From Results Comparison ({comparisonIds.length})
                </button>
              )} />
            <label style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>Audit cycle
              <select value={cycleId} onChange={e => setCycleId(e.target.value)} style={{ width: '230px' }}>
                <option value="">Select a cycle</option>
                {options.cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px' }}>
              <input type="checkbox" checked={narrate} onChange={e => setNarrate(e.target.checked)} disabled={!status?.available} />
              AI explanation
            </label>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Active scope: <strong>{scopeLabel}</strong></span>
            {comparisonIds.length > 0 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={useComparisonSelection}>
                Use Results Comparison selection ({comparisonIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Conversation */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '320px' }}>
          {messages.length === 0 && (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Ask about the selected audit. Figures are always computed by the application; the local model only explains them.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(status?.starters || []).map(s => (
                  <button key={s} className="btn btn-outline btn-sm" onClick={() => send(s)} disabled={sending}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map(m => m.role === 'user' ? (
            <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '80%', background: 'var(--accent)', color: '#fff', padding: '8px 12px', borderRadius: '12px 12px 2px 12px', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
              {m.content}
            </div>
          ) : (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}><Bot size={14} style={{ verticalAlign: '-2px', color: 'var(--accent)' }} /> {m.content}</div>
              {m.result && <ResultView result={m.result} onOpenCriterion={onOpenCriterion} />}
              <NarrationView narration={m.narration} onOpenCriterion={onOpenCriterion} />
            </div>
          ))}
          {sending && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <Loader2 size={14} className="animate-spin" style={{ verticalAlign: '-2px' }} /> Working...
            </div>
          )}
          {error && <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--grade-d)' }}><AlertTriangle size={14} style={{ verticalAlign: '-2px' }} /> {error}</div>}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={e => { e.preventDefault(); send(); }} style={{ display: 'flex', gap: '8px' }}>
          <input type="text" value={input} onChange={e => setInput(e.target.value)} maxLength={1000}
            placeholder="Ask about this audit, e.g. 'List findings for C3'" aria-label="Question for the audit assistant" />
          <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}><Send size={15} /> Ask</button>
          <button type="button" className="btn btn-secondary" onClick={resetConversation} title="Start a new conversation"><RotateCcw size={15} /> Reset</button>
        </form>
      </div>

      {/* Reports */}
      <aside style={{ ...card, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="var(--primary)" /><strong>Draft audit report</strong>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Word, Excel and PDF built from verified data for one department and cycle. Always a draft that requires auditor review.
        </p>
        <label style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>Compare with
          <select value={compareCycleId} onChange={e => setCompareCycleId(e.target.value)}>
            <option value="">Previous cycle with data (automatic)</option>
            {options.cycles.filter(c => String(c.id) !== cycleId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" checked={reportNarration} onChange={e => setReportNarration(e.target.checked)} disabled={!status?.available} />
          Add AI-drafted narrative (slower)
        </label>
        <button className="btn btn-primary" onClick={generateReport} disabled={reportBusy || !departmentId || !cycleId}
          title={!departmentId || !cycleId ? 'Select exactly one department and an audit cycle' : ''}>
          {reportBusy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Generate draft report
        </button>
        {(!departmentId || !cycleId) && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Select exactly one department and an audit cycle first (reports cover one department).</div>}

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {reportsList.length === 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No reports yet.</div>}
          {reportsList.map(r => (
            <div key={r.id} style={{ fontSize: '0.75rem', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 700 }}>{r.department} · {r.cycle}</div>
              <div style={{ color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleString()} · {r.review_status}</div>
              {r.status === 'done' ? (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  {r.formats.map(f => (
                    <a key={f} className="btn btn-outline btn-sm" href={`/api/ai/reports/${r.id}/download/${f}/`}><Download size={12} /> {f.toUpperCase()}</a>
                  ))}
                </div>
              ) : r.status === 'failed' ? (
                <div style={{ color: 'var(--grade-d)', marginTop: '4px' }}>Failed: {r.error}</div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}><Loader2 size={12} className="animate-spin" style={{ verticalAlign: '-2px' }} /> {r.status}...</div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
