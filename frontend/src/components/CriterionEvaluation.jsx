import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, Square, Filter, Search, Save, AlertTriangle, 
  ChevronRight, RefreshCw, Eye, Download, Info, CheckCircle2 
} from 'lucide-react';

// Round to at most two decimal places for display (trailing zeros dropped)
const fmt2 = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? v : Math.round(n * 100) / 100;
};

// Roles that get the search / grade filter / column toggle toolbar (administrative tool)
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
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [savingId, setSavingId] = useState(null);
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // Column visibility controls with checkboxes
  const [visibleColumns, setVisibleColumns] = useState({
    sampling: true,
    rubrics: false,
    inputs: true,
    results: true,
    remarks: true,
    evidence: true,
    atrCheckbox: true,
  });

  const [showColMenu, setShowColMenu] = useState(false);

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
    setSelectedRowIds(new Set());
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

  // Toggle row selection checkbox
  const toggleRowSelect = (id) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all rows
  const toggleSelectAll = () => {
    if (selectedRowIds.size === evaluableMetrics.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(evaluableMetrics.map(m => m.id)));
    }
  };

  // Bulk flag selected rows for ATR
  const bulkFlagForATR = async () => {
    if (selectedRowIds.size === 0) return;
    setLoading(true);
    for (const id of selectedRowIds) {
      const m = metrics.find(item => item.id === id);
      if (m) {
        await fetch('/api/evaluations/save/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            department_id: selectedDepartmentId,
            cycle_id: selectedCycleId,
            metric_id: id,
            items_checked: m.evaluation?.items_checked,
            valid_items: m.evaluation?.valid_items,
            is_flagged_for_atr: true
          })
        });
      }
    }
    await fetchCriterion();
    setLoading(false);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Criteria Selection Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        padding: '6px 0',
        borderBottom: '1px solid #1e293b'
      }}>
        {criteriaList.map(c => {
          const isCurrent = c.code === activeCriterionCode;
          const isAllocated = !editableCriteria || editableCriteria.includes(c.code);
          return (
            <button
              key={c.code}
              onClick={() => setActiveCriterionCode(c.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: isCurrent ? '1px solid #6366f1' : '1px solid #1e293b',
                background: isCurrent ? 'rgba(99, 102, 241, 0.15)' : '#111827',
                color: isCurrent ? '#a5b4fc' : '#94a3b8',
                fontWeight: isCurrent ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >
              <span style={{ 
                background: isCurrent ? '#4f46e5' : '#1e293b', 
                color: '#fff', 
                padding: '2px 6px', 
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                {c.code}
              </span>
              <span>{c.title}</span>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({fmt2(c.max_marks)}M)</span>
              {userRole === 'Auditor' && isAllocated && (
                <span title="Allocated to you" style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 700 }}>● yours</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Criterion Header Card */}
      <div style={{
        background: 'linear-gradient(135deg, #162032 0%, #0f172a 100%)',
        border: '1px solid #223249',
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
              background: '#4f46e5', 
              color: 'white', 
              fontWeight: 800, 
              padding: '4px 10px', 
              borderRadius: '6px',
              fontSize: '0.85rem'
            }}>
              {criterionData?.code || activeCriterionCode}
            </span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
              {criterionData?.title}
            </h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: '#94a3b8', maxWidth: '700px' }}>
            Physical validation rubrics and sample evaluation. Benchmark vs Validated values calculation, indicator scoring, and Action Taken Report (ATR) workflow.
          </p>
        </div>

        {/* Live Scorecards */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'center', padding: '0 12px', borderRight: '1px solid #23344d' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>MAX MARKS</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#e2e8f0' }}>{summaryStats.max}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0 12px', borderRight: '1px solid #23344d' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>VALIDATED</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#818cf8' }}>{summaryStats.obt}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0 12px', borderRight: '1px solid #23344d' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>PERCENTAGE</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981' }}>{summaryStats.pct}%</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0 12px' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>GRADE</div>
            <div className={`badge badge-${summaryStats.grade.toLowerCase()}`} style={{ fontSize: '1.1rem', padding: '4px 14px' }}>
              {summaryStats.grade}
            </div>
          </div>
        </div>
      </div>

      {readOnly && !loading && (
        <div style={{
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '10px',
          padding: '10px 16px',
          fontSize: '0.8rem',
          color: '#bae6fd',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Info size={15} />
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
        background: '#111827',
        border: '1px solid #1e293b',
        borderRadius: '10px',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Search & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search aspect or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={14} color="#94a3b8" />
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Grade:</span>
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
                  background: gradeFilter === g ? '#4f46e5' : '#1e293b',
                  color: gradeFilter === g ? '#fff' : '#94a3b8'
                }}
              >
                {g}
              </button>
            ))}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.775rem', color: '#f59e0b', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={onlyFlagged}
              onChange={(e) => setOnlyFlagged(e.target.checked)}
            />
            <span>Flagged for ATR only</span>
          </label>
        </div>

        {/* Column Checkboxes & Bulk Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
          {/* Column Toggle Menu Button */}
          <button
            onClick={() => setShowColMenu(!showColMenu)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Eye size={14} /> Columns Checkbox {showColMenu ? '▲' : '▼'}
          </button>

          {/* Column selector dropdown */}
          {showColMenu && (
            <div style={{
              position: 'absolute',
              top: '38px',
              right: '0',
              background: '#162032',
              border: '1px solid #2d3f59',
              borderRadius: '8px',
              padding: '12px',
              zIndex: 50,
              width: '210px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', borderBottom: '1px solid #23344d', paddingBottom: '4px' }}>
                TOGGLE TABLE COLUMNS
              </div>
              {Object.keys(visibleColumns).map(colKey => {
                const labels = {
                  sampling: 'Sampling Guidelines',
                  rubrics: 'Y/C/W/D Rubrics Text',
                  inputs: 'Auditor Input (Checked/Valid)',
                  results: 'Marks & Percentage',
                  remarks: 'Auditor Remarks',
                  evidence: 'Evidence & Physical Status',
                  atrCheckbox: 'ATR Selection Checkbox'
                };
                return (
                  <label key={colKey} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.775rem', color: '#e2e8f0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={visibleColumns[colKey]}
                      onChange={(e) => setVisibleColumns(prev => ({ ...prev, [colKey]: e.target.checked }))}
                    />
                    <span>{labels[colKey]}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Bulk Action for selected rows */}
          {!readOnly && selectedRowIds.size > 0 && (
            <button
              onClick={bulkFlagForATR}
              className="btn btn-sm"
              style={{ background: '#f59e0b', color: '#000', fontWeight: 700 }}
            >
              Flag {selectedRowIds.size} for ATR
            </button>
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
        background: '#111827',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ overflowX: 'auto', maxHeight: '72vh' }}>
          <table className="audit-table">
            <thead>
              <tr>
                {showToolbar && (
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedRowIds.size > 0 && selectedRowIds.size === evaluableMetrics.length}
                      onChange={toggleSelectAll}
                      disabled={readOnly}
                      title="Select all rows"
                    />
                  </th>
                )}
                <th style={{ width: '70px' }}>Code</th>
                <th style={{ minWidth: '220px' }}>Key Aspect & Indicator</th>
                
                {visibleColumns.sampling && (
                  <>
                    <th style={{ width: '100px' }}>Unit / Sample</th>
                    <th style={{ minWidth: '180px' }}>Verification Rule</th>
                  </>
                )}

                {visibleColumns.rubrics && (
                  <>
                    <th style={{ minWidth: '150px' }}>Y Rubric (&gt;75%)</th>
                    <th style={{ minWidth: '150px' }}>C Rubric (60-75%)</th>
                    <th style={{ minWidth: '150px' }}>W Rubric (40-60%)</th>
                    <th style={{ minWidth: '150px' }}>D Rubric (&lt;40%)</th>
                  </>
                )}

                <th style={{ width: '75px', textAlign: 'right' }}>Max Marks</th>

                {visibleColumns.inputs && (
                  <>
                    <th style={{ width: '85px', textAlign: 'center', background: '#192338' }}>Items Checked</th>
                    <th style={{ width: '85px', textAlign: 'center', background: '#192338' }}>Valid Items</th>
                    <th style={{ width: '80px', textAlign: 'center', background: '#192338' }}>Benchmark</th>
                    <th style={{ width: '90px', textAlign: 'right', background: '#192338' }}>Validated Value</th>
                  </>
                )}

                {visibleColumns.results && (
                  <>
                    <th style={{ width: '90px', textAlign: 'right' }}>Marks Obt.</th>
                    <th style={{ width: '75px', textAlign: 'right' }}>%</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>Grade</th>
                  </>
                )}

                {visibleColumns.remarks && (
                  <th style={{ minWidth: '180px' }}>Auditor Remarks</th>
                )}

                {visibleColumns.evidence && (
                  <>
                    <th style={{ width: '120px' }}>Evidence Status</th>
                    <th style={{ width: '130px' }}>Physical Check</th>
                  </>
                )}

                {visibleColumns.atrCheckbox && (
                  <th style={{ width: '80px', textAlign: 'center' }}>Flag ATR</th>
                )}
              </tr>
            </thead>

            <tbody>
              {filteredMetrics.map(item => {
                if (item.is_header) {
                  return (
                    <tr key={item.id} className="header-row">
                      <td colSpan={20} style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.9rem', color: '#e0e7ff', fontWeight: 700 }}>
                            {item.code} — {item.key_aspect}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                            Sub-Total: {fmt2(item.max_marks)} Marks
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                }

                const ev = item.evaluation || {};
                const isSelected = selectedRowIds.has(item.id);
                const isSaving = savingId === item.id;

                return (
                  <tr 
                    key={item.id} 
                    className={isSelected ? 'selected' : ''}
                    style={{ background: isSaving ? 'rgba(99, 102, 241, 0.05)' : undefined }}
                  >
                    {/* Row Select Checkbox (bulk actions live in the admin toolbar) */}
                    {showToolbar && (
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelect(item.id)}
                          disabled={readOnly}
                        />
                      </td>
                    )}

                    {/* Metric Code */}
                    <td style={{ fontWeight: 700, color: '#a5b4fc' }}>
                      {item.code}
                    </td>

                    {/* Key Aspect */}
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '2px' }}>
                        {item.key_aspect}
                      </div>
                      {item.auditor_verifies && (
                        <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                          {item.auditor_verifies}
                        </div>
                      )}
                    </td>

                    {/* Sampling info */}
                    {visibleColumns.sampling && (
                      <>
                        <td style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                          <div>{item.unit}</div>
                          {item.sampling_unit && (
                            <div style={{ color: '#64748b' }}>Unit: {item.sampling_unit}</div>
                          )}
                          {item.min_sample && (
                            <div style={{ color: '#64748b' }}>Min: {item.min_sample}</div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                          {item.valid_condition || item.how_to_sample || 'Verify compliant records.'}
                        </td>
                      </>
                    )}

                    {/* Rubrics descriptions */}
                    {visibleColumns.rubrics && (
                      <>
                        <td style={{ fontSize: '0.7rem', color: '#10b981' }}>{item.rubric_Y || '-'}</td>
                        <td style={{ fontSize: '0.7rem', color: '#3b82f6' }}>{item.rubric_C || '-'}</td>
                        <td style={{ fontSize: '0.7rem', color: '#f59e0b' }}>{item.rubric_W || '-'}</td>
                        <td style={{ fontSize: '0.7rem', color: '#ef4444' }}>{item.rubric_D || '-'}</td>
                      </>
                    )}

                    {/* Max Marks */}
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#e2e8f0' }}>
                      {fmt2(item.max_marks)}
                    </td>

                    {/* Auditor Inputs */}
                    {visibleColumns.inputs && (
                      <>
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
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                          {fmt2(item.benchmark)} {item.unit}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#38bdf8' }}>
                          {ev.validated_value !== null && ev.validated_value !== undefined ? `${fmt2(ev.validated_value)} ${item.unit}` : '-'}
                        </td>
                      </>
                    )}

                    {/* Calculated Results */}
                    {visibleColumns.results && (
                      <>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#f8fafc' }}>
                          {ev.marks_obtained !== null && ev.marks_obtained !== undefined ? fmt2(ev.marks_obtained) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#cbd5e1' }}>
                          {ev.percentage !== null && ev.percentage !== undefined ? `${fmt2(ev.percentage)}%` : '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {ev.grade ? (
                            <span className={`badge badge-${ev.grade.toLowerCase()}`}>
                              {ev.grade}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b' }}>-</span>
                          )}
                        </td>
                      </>
                    )}

                    {/* Remarks */}
                    {visibleColumns.remarks && (
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
                    {visibleColumns.evidence && (
                      <>
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
                      </>
                    )}

                    {/* ATR Checkbox */}
                    {visibleColumns.atrCheckbox && (
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
