import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, Square, Filter, Search, Save, AlertTriangle, 
  ChevronRight, RefreshCw, Eye, Download, Info, CheckCircle2 
} from 'lucide-react';
import useSlidingIndicator from '../hooks/useSlidingIndicator';
import ColumnPicker from './ColumnPicker';
import { normalizeColumns, sameColumns } from '../auditColumns';

// Round to at most two decimal places for display (trailing zeros dropped)
const fmt2 = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? v : Math.round(n * 100) / 100;
};

// Roles that get the search / grade filter toolbar (administrative tool)
const TOOLBAR_ROLES = ['Admin'];

// Restrict typed numeric input to at most two decimal places
const limit2 = (v) => {
  const s = String(v);
  const dot = s.indexOf('.');
  return dot === -1 ? s : s.slice(0, dot + 3);
};

export default function CriterionEvaluation({
  criteriaList,
  activeCriterionCode,
  setActiveCriterionCode,
  selectedDepartmentId,
  selectedCycleId,
  departmentInfo,
  userRole,
  editableCriteria,
  visibleColumns,
  onColumnsSaved,
  onNavigateToATR
}) {
  const [criterionData, setCriterionData] = useState(null);
  const [metrics, setMetrics] = useState([]);
  // Set by the backend: Admin, or the auditor allocated this criterion; HODs always view-only
  const [canEdit, setCanEdit] = useState(false);
  const readOnly = !canEdit;
  const showToolbar = TOOLBAR_ROLES.includes(userRole);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // Columns fixed for this audit (Audit Questions tab). The server sends the current setting with every
  // criterion it loads, so a change by the Admin applies without logging in again; for other logins the
  // server also leaves out the data of hidden columns. The Admin can change the columns here for their own
  // view and save them for all auditors of the audit.
  const [serverColumns, setServerColumns] = useState(null);
  const columnsKey = JSON.stringify(serverColumns || visibleColumns || null);
  const auditColumns = useMemo(() => normalizeColumns(serverColumns || visibleColumns), [columnsKey]);
  const [col, setCol] = useState(auditColumns);
  const [columnSaveState, setColumnSaveState] = useState(null);
  useEffect(() => { setCol(auditColumns); setColumnSaveState(null); }, [auditColumns, selectedCycleId]);
  const columnsChanged = !sameColumns(col, auditColumns);

  const saveColumnsForAudit = async () => {
    setColumnSaveState('saving');
    try {
      const res = await fetch('/api/cycle-questions/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: selectedCycleId, visible_columns: col })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      onColumnsSaved?.(selectedCycleId, json);
      setColumnSaveState('saved');
    } catch {
      setColumnSaveState('error');
    }
  };


  // Fetch criterion metrics and evaluations
  const fetchCriterion = async () => {
    if (!activeCriterionCode || !selectedDepartmentId || !selectedCycleId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/criteria/${activeCriterionCode}/?department_id=${selectedDepartmentId}&cycle_id=${selectedCycleId}`);
      const data = await res.json();
      if (data.criterion) {
        setCriterionData(data.criterion);
        setMetrics(data.metrics || []);
        if (data.visible_columns) setServerColumns(data.visible_columns);
      }
      setCanEdit(Boolean(data.can_edit));
    } catch (err) {
      console.error("Failed to load criterion:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCriterion();
  }, [activeCriterionCode, selectedDepartmentId, selectedCycleId]);

  // Recalculate local metric values
  const handleInputChange = (metricId, field, value) => {
    if (readOnly) return;
    setMetrics(prev => prev.map(m => {
      if (m.id !== metricId) return m;

      const evalData = { ...(m.evaluation || {}) };
      if (field === 'items_checked' || field === 'valid_items') value = limit2(value);
      evalData[field] = value;

      const itemsChecked = parseFloat(evalData.items_checked);
      const validItems = parseFloat(evalData.valid_items);
      const maxMarks = parseFloat(m.max_marks) || 0;
      const benchmark = parseFloat(m.benchmark) || (m.unit === '%' ? 100 : 10);

      let valValue = null;
      let marksObt = null;
      let pct = null;
      let grade = '';

      if (!isNaN(validItems) && !isNaN(itemsChecked) && itemsChecked > 0) {
        if (m.unit === '%') {
          valValue = Math.round((validItems / itemsChecked) * 10000) / 100;
        } else {
          valValue = Math.round(validItems * 100) / 100;
        }
      }

      if (valValue !== null) {
        const ratio = Math.min(valValue / (benchmark || 100), 1.0);
        marksObt = Math.round(maxMarks * ratio * 100) / 100;
        pct = maxMarks > 0 ? Math.round((marksObt / maxMarks) * 10000) / 100 : 100;

        if (pct > 75) grade = 'Y';
        else if (pct >= 60) grade = 'C';
        else if (pct >= 40) grade = 'W';
        else grade = 'D';

        if (grade === 'W' || grade === 'D') {
          evalData.is_flagged_for_atr = true;
        }
      }

      evalData.validated_value = valValue;
      evalData.marks_obtained = marksObt;
      evalData.percentage = pct;
      evalData.grade = grade;

      return { ...m, evaluation: evalData };
    }));

    // Trigger save
    debouncedSave(metricId, field, (field === 'items_checked' || field === 'valid_items') ? limit2(value) : value);
  };

  // Auto save to Django backend
  const debouncedSave = async (metricId, field, value) => {
    setSavingId(metricId);
    try {
      const metric = metrics.find(m => m.id === metricId);
      const evalData = metric ? metric.evaluation : {};

      const payload = {
        department_id: selectedDepartmentId,
        cycle_id: selectedCycleId,
        metric_id: metricId,
        items_checked: evalData.items_checked,
        valid_items: evalData.valid_items,
        auditor_remarks: evalData.auditor_remarks,
        evidence_status: evalData.evidence_status || 'Complete',
        physical_check_result: evalData.physical_check_result || 'Matches claim',
        is_flagged_for_atr: evalData.is_flagged_for_atr || false,
        [field]: value
      };

      const res = await fetch('/api/evaluations/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.status === 'success') {
        setLastSavedTime(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Auto save failed:", err);
    } finally {
      setTimeout(() => setSavingId(null), 400);
    }
  };


  const evaluableMetrics = useMemo(() => metrics.filter(m => !m.is_header), [metrics]);

  // Compute live totals for this criterion
  const summaryStats = useMemo(() => {
    let max = 0;
    let obt = 0;
    let y = 0, c = 0, w = 0, d = 0, unscored = 0;

    evaluableMetrics.forEach(m => {
      const mMax = parseFloat(m.max_marks) || 0;
      max += mMax;
      const ev = m.evaluation;
      if (ev && ev.marks_obtained !== null && ev.marks_obtained !== undefined) {
        obt += parseFloat(ev.marks_obtained);
        if (ev.grade === 'Y') y++;
        else if (ev.grade === 'C') c++;
        else if (ev.grade === 'W') w++;
        else if (ev.grade === 'D') d++;
      } else {
        unscored++;
      }
    });

    const pct = max > 0 ? Math.round((obt / max) * 10000) / 100 : 0;
    let grade = '-';
    if (evaluableMetrics.length - unscored > 0) {
      if (pct > 75) grade = 'Y';
      else if (pct >= 60) grade = 'C';
      else if (pct >= 40) grade = 'W';
      else grade = 'D';
    }

    return { max: Math.round(max * 100) / 100, obt: Math.round(obt * 100) / 100, pct, grade, y, c, w, d, unscored };
  }, [evaluableMetrics]);

  // Filter metrics
  const filteredMetrics = useMemo(() => {
    const rows = metrics.filter(m => {
      if (m.is_header) return true; // Keep headers for grouping
      const ev = m.evaluation || {};
      const matchesSearch = 
        m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.key_aspect.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.auditor_verifies && m.auditor_verifies.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesGrade = 
        gradeFilter === 'ALL' ||
        (gradeFilter === 'UNSCORED' && !ev.grade) ||
        ev.grade === gradeFilter;

      const matchesATR = !onlyFlagged || ev.is_flagged_for_atr;

      return matchesSearch && matchesGrade && matchesATR;
    });
    // Drop section headers left with no matching metric rows under them
    return rows.filter((m, i) => !m.is_header || (rows[i + 1] && !rows[i + 1].is_header));
  }, [metrics, searchQuery, gradeFilter, onlyFlagged]);

  const { containerRef: critTabsRef, itemRef: critTabRef, indicator: critIndicator } =
    useSlidingIndicator(activeCriterionCode, [criteriaList.length, userRole]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Criteria Selection Tabs: segmented control with a sliding active pill */}
      <div ref={critTabsRef} className="seg-tabs">
        {critIndicator && (
          <div className="seg-indicator" style={{ left: critIndicator.left, width: critIndicator.width }} />
        )}
        {criteriaList.map(c => {
          const isCurrent = c.code === activeCriterionCode;
          const isAllocated = !editableCriteria || editableCriteria.includes(c.code);
          return (
            <button
              key={c.code}
              ref={critTabRef(c.code)}
              onClick={() => setActiveCriterionCode(c.code)}
              className={`seg-tab${isCurrent ? ' active' : ''}`}
            >
              <span className="seg-code">{c.code}</span>
              <span>{c.title}</span>
              <span className="seg-meta">{fmt2(c.max_marks)}M</span>
              {userRole === 'Auditor' && isAllocated && (
                <span title="Allocated to you" className="seg-yours">● yours</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Criterion Header Card */}
      <div style={{
        background: 'var(--hero-gradient)',
        border: '1px solid var(--hero-border)',
        borderRadius: '14px',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ 
              background: 'var(--primary)', 
              color: 'white', 
              fontWeight: 800, 
              padding: '4px 10px', 
              borderRadius: '6px',
              fontSize: '0.85rem'
            }}>
              {criterionData?.code || activeCriterionCode}
            </span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {criterionData?.title}
            </h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', maxWidth: '700px' }}>
            Physical validation rubrics and sample evaluation. Benchmark vs Validated values calculation, indicator scoring, and Action Taken Report (ATR) workflow.
          </p>
        </div>

        {/* Live Scorecards (for logins other than Admin, only those whose columns are shown in this audit) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {(showToolbar || auditColumns.maxMarks) && (
            <div style={{ textAlign: 'center', padding: '0 12px', borderRight: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>MAX MARKS</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>{summaryStats.max}</div>
            </div>
          )}
          {(showToolbar || auditColumns.marksObtained) && (
            <div style={{ textAlign: 'center', padding: '0 12px', borderRight: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>VALIDATED</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)' }}>{summaryStats.obt}</div>
            </div>
          )}
          {(showToolbar || (auditColumns.percentage && auditColumns.maxMarks && auditColumns.marksObtained)) && (
            <div style={{ textAlign: 'center', padding: '0 12px', borderRight: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>PERCENTAGE</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981' }}>{summaryStats.pct}%</div>
            </div>
          )}
          {(showToolbar || (auditColumns.grade && auditColumns.maxMarks && auditColumns.marksObtained)) && (
            <div style={{ textAlign: 'center', padding: '0 12px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>GRADE</div>
              <div className={`badge badge-${summaryStats.grade.toLowerCase()}`} style={{ fontSize: '1.1rem', padding: '4px 14px' }}>
                {summaryStats.grade}
              </div>
            </div>
          )}
        </div>
      </div>

      {readOnly && !loading && (
        <div style={{
          background: 'var(--primary-light)',
          border: '1px solid var(--primary-border)',
          borderRadius: '10px',
          padding: '10px 16px',
          fontSize: '0.8rem',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Info size={15} color="var(--primary)" />
          {userRole === 'HOD'
            ? <span>This is the auditor's report for your department (view-only). Indicators below 60% appear in the <strong>Action Taken Report</strong> tab, where you enter the root cause and action plan.</span>
            : <span>View-only: {activeCriterionCode} of this department is not allocated to you for this audit cycle.</span>}
        </div>
      )}

      {/* Auditors still need save feedback when the admin toolbar is hidden */}
      {!showToolbar && lastSavedTime && (
        <span style={{ fontSize: '0.725rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-end' }}>
          <CheckCircle2 size={13} /> Saved at {lastSavedTime}
        </span>
      )}

      {/* Action Toolbar */}
      {showToolbar && (
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: 'var(--shadow-card)'
      }}>
        {/* Search & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search aspect or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={14} color="var(--text-secondary)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Grade:</span>
            {['ALL', 'Y', 'C', 'W', 'D', 'UNSCORED'].map(g => (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: gradeFilter === g ? 'var(--primary)' : 'var(--bg-card-hover)',
                  color: gradeFilter === g ? '#fff' : 'var(--text-secondary)'
                }}
              >
                {g}
              </button>
            ))}
          </div>

          <button
            onClick={() => setOnlyFlagged(!onlyFlagged)}
            className="btn btn-sm"
            style={{
              borderRadius: '999px',
              border: `1px solid ${onlyFlagged ? 'var(--grade-w)' : 'var(--border-subtle)'}`,
              background: onlyFlagged ? 'var(--grade-w-bg)' : 'transparent',
              color: onlyFlagged ? 'var(--grade-w)' : 'var(--text-secondary)'
            }}
            title="Show only the items flagged for the Action Taken Report"
          >
            <AlertTriangle size={13} /> Flagged for ATR only
          </button>
        </div>

        {/* Columns, refresh & save status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative', flexWrap: 'wrap' }}>
          <ColumnPicker
            value={col}
            onChange={(next) => { setCol(next); setColumnSaveState(null); }}
            title="COLUMNS IN THIS VIEW"
            highlight={columnsChanged}
            footer={'Changes apply to your view now. Use "Save for this audit" to show the same columns to every auditor in this audit.'}
          />
          {columnsChanged && (
            <>
              <button className="btn btn-primary btn-sm" onClick={saveColumnsForAudit} disabled={columnSaveState === 'saving'}
                title="Save these columns for all auditors in this audit cycle">
                <Save size={13} /> Save for this audit
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setCol(auditColumns)} title="Back to the columns saved for this audit">
                Undo
              </button>
            </>
          )}
          {columnSaveState === 'saved' && !columnsChanged && (
            <span style={{ fontSize: '0.725rem', color: 'var(--grade-y)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> Columns saved for this audit
            </span>
          )}
          {columnSaveState === 'error' && (
            <span style={{ fontSize: '0.725rem', color: 'var(--grade-d)' }}>Could not save columns</span>
          )}

          <button
            onClick={fetchCriterion}
            className="btn btn-outline btn-sm"
            title="Refresh Evaluation"
          >
            <RefreshCw size={14} />
          </button>

          {lastSavedTime && (
            <span style={{ fontSize: '0.725rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> Saved at {lastSavedTime}
            </span>
          )}
        </div>
      </div>
      )}

      {/* Main Rubrics & Evaluation Data Table */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ overflowX: 'auto', maxHeight: '72vh' }}>
          <table className="audit-table">
            <thead>
              <tr>
                <th style={{ width: '70px' }}>Code</th>
                <th style={{ minWidth: '220px' }}>Key Aspect & Indicator</th>
                
                {col.unitSample && <th style={{ width: '100px' }}>Unit / Sample</th>}
                {col.verificationRule && <th style={{ minWidth: '180px' }}>Verification Rule</th>}

                {col.rubricY && <th style={{ minWidth: '150px' }}>Y Rubric (&gt;75%)</th>}
                {col.rubricC && <th style={{ minWidth: '150px' }}>C Rubric (60-75%)</th>}
                {col.rubricW && <th style={{ minWidth: '150px' }}>W Rubric (40-60%)</th>}
                {col.rubricD && <th style={{ minWidth: '150px' }}>D Rubric (&lt;40%)</th>}

                {col.maxMarks && <th style={{ width: '75px', textAlign: 'right' }}>Max Marks</th>}

                {col.itemsChecked && <th style={{ width: '85px', textAlign: 'center', background: 'var(--bg-table-header)' }}>Items Checked</th>}
                {col.validItems && <th style={{ width: '85px', textAlign: 'center', background: 'var(--bg-table-header)' }}>Valid Items</th>}
                {col.benchmark && <th style={{ width: '80px', textAlign: 'center', background: 'var(--bg-table-header)' }}>Benchmark</th>}
                {col.validatedValue && <th style={{ width: '90px', textAlign: 'right', background: 'var(--bg-table-header)' }}>Validated Value</th>}

                {col.marksObtained && <th style={{ width: '90px', textAlign: 'right' }}>Marks Obt.</th>}
                {col.percentage && <th style={{ width: '75px', textAlign: 'right' }}>%</th>}
                {col.grade && <th style={{ width: '70px', textAlign: 'center' }}>Grade</th>}

                {col.remarks && <th style={{ minWidth: '180px' }}>Auditor Remarks</th>}

                {col.evidenceStatus && <th style={{ width: '120px' }}>Evidence Status</th>}
                {col.physicalCheck && <th style={{ width: '130px' }}>Physical Check</th>}

                {col.atrFlag && <th style={{ width: '80px', textAlign: 'center' }}>Flag ATR</th>}
              </tr>
            </thead>

            <tbody>
              {filteredMetrics.map(item => {
                if (item.is_header) {
                  return (
                    <tr key={item.id} className="header-row">
                      <td colSpan={20} style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            {item.code} — {item.key_aspect}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--primary)', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            Sub-Total: {fmt2(item.max_marks)} Marks
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                }

                const ev = item.evaluation || {};
                const isSaving = savingId === item.id;

                return (
                  <tr
                    key={item.id}
                    style={{ background: isSaving ? 'var(--primary-light)' : undefined }}
                  >

                    {/* Metric Code */}
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {item.code}
                    </td>

                    {/* Key Aspect */}
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {item.key_aspect}
                      </div>
                      {item.auditor_verifies && (
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                          {item.auditor_verifies}
                        </div>
                      )}
                    </td>

                    {/* Sampling info */}
                    {col.unitSample && (
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <div>{item.unit}</div>
                          {item.sampling_unit && (
                            <div style={{ color: 'var(--text-muted)' }}>Unit: {item.sampling_unit}</div>
                          )}
                          {item.min_sample && (
                            <div style={{ color: 'var(--text-muted)' }}>Min: {item.min_sample}</div>
                          )}
                        </td>
                    )}
                    {col.verificationRule && (
                        <td style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                          {item.valid_condition || item.how_to_sample || 'Verify compliant records.'}
                        </td>
                    )}

                    {/* Rubrics descriptions */}
                    {col.rubricY && <td style={{ fontSize: '0.7rem', color: 'var(--grade-y)' }}>{item.rubric_Y || '-'}</td>}
                    {col.rubricC && <td style={{ fontSize: '0.7rem', color: 'var(--grade-c)' }}>{item.rubric_C || '-'}</td>}
                    {col.rubricW && <td style={{ fontSize: '0.7rem', color: 'var(--grade-w)' }}>{item.rubric_W || '-'}</td>}
                    {col.rubricD && <td style={{ fontSize: '0.7rem', color: 'var(--grade-d)' }}>{item.rubric_D || '-'}</td>}

                    {/* Max Marks */}
                    {col.maxMarks && (
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {fmt2(item.max_marks)}
                      </td>
                    )}

                    {/* Auditor Inputs */}
                    {col.itemsChecked && (
                        <td style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.015)' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ev.items_checked !== null && ev.items_checked !== undefined ? ev.items_checked : ''}
                            onChange={(e) => handleInputChange(item.id, 'items_checked', e.target.value)}
                            disabled={readOnly}
                            style={{ 
                              width: '65px', 
                              textAlign: 'center', 
                              padding: '4px 6px', 
                              fontSize: '0.8rem',
                              border: !readOnly && ev.items_checked ? '1px solid #4f46e5' : undefined 
                            }}
                            placeholder="0"
                          />
                        </td>
                    )}
                    {col.validItems && (
                        <td style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.015)' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ev.valid_items !== null && ev.valid_items !== undefined ? ev.valid_items : ''}
                            onChange={(e) => handleInputChange(item.id, 'valid_items', e.target.value)}
                            disabled={readOnly}
                            style={{ 
                              width: '65px', 
                              textAlign: 'center', 
                              padding: '4px 6px', 
                              fontSize: '0.8rem',
                              border: !readOnly && ev.valid_items ? '1px solid #10b981' : undefined
                            }}
                            placeholder="0"
                          />
                        </td>
                    )}
                    {col.benchmark && (
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                          {fmt2(item.benchmark)} {item.unit}
                        </td>
                    )}
                    {col.validatedValue && (
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#38bdf8' }}>
                          {ev.validated_value !== null && ev.validated_value !== undefined ? `${fmt2(ev.validated_value)} ${item.unit}` : '-'}
                        </td>
                    )}

                    {/* Calculated Results */}
                    {col.marksObtained && (
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#f8fafc' }}>
                          {ev.marks_obtained !== null && ev.marks_obtained !== undefined ? fmt2(ev.marks_obtained) : '-'}
                        </td>
                    )}
                    {col.percentage && (
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#cbd5e1' }}>
                          {ev.percentage !== null && ev.percentage !== undefined ? `${fmt2(ev.percentage)}%` : '-'}
                        </td>
                    )}
                    {col.grade && (
                        <td style={{ textAlign: 'center' }}>
                          {ev.grade ? (
                            <span className={`badge badge-${ev.grade.toLowerCase()}`}>
                              {ev.grade}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b' }}>-</span>
                          )}
                        </td>
                    )}

                    {/* Remarks */}
                    {col.remarks && (
                      <td>
                        <input
                          type="text"
                          value={ev.auditor_remarks || ''}
                          onChange={(e) => handleInputChange(item.id, 'auditor_remarks', e.target.value)}
                          disabled={readOnly}
                          placeholder="Add verification notes..."
                          style={{ fontSize: '0.775rem', padding: '4px 8px' }}
                        />
                      </td>
                    )}

                    {/* Evidence & Physical Status */}
                    {col.evidenceStatus && (
                        <td>
                          <select
                            value={ev.evidence_status || 'Complete'}
                            onChange={(e) => handleInputChange(item.id, 'evidence_status', e.target.value)}
                            disabled={readOnly}
                            style={{ fontSize: '0.75rem', padding: '3px 6px' }}
                          >
                            <option value="Complete">Complete</option>
                            <option value="Partial">Partial</option>
                            <option value="Not Uploaded">Not Uploaded</option>
                          </select>
                        </td>
                    )}
                    {col.physicalCheck && (
                        <td>
                          <select
                            value={ev.physical_check_result || 'Matches claim'}
                            onChange={(e) => handleInputChange(item.id, 'physical_check_result', e.target.value)}
                            disabled={readOnly}
                            style={{ fontSize: '0.75rem', padding: '3px 6px' }}
                          >
                            <option value="Matches claim">Matches claim</option>
                            <option value="Partially matches">Partially matches</option>
                            <option value="Does not match">Does not match</option>
                            <option value="Not checked">Not checked</option>
                          </select>
                        </td>
                    )}

                    {/* ATR Checkbox */}
                    {col.atrFlag && (
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(ev.is_flagged_for_atr)}
                          onChange={(e) => handleInputChange(item.id, 'is_flagged_for_atr', e.target.checked)}
                          disabled={readOnly}
                          title="Flag this item for HOD Action Taken Report"
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
