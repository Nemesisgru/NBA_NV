import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, Clock, AlertTriangle, Save, RefreshCw, Filter, CheckSquare, Square, Edit3, Download, FileText } from 'lucide-react';

export default function ATRWorkspace({ institutes, criteriaList, departmentInfo, selectedDepartmentId, selectedCycleId, userRole }) {
  const [atrs, setAtrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingAtr, setEditingAtr] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');

  // Admin-only: view ATRs across all departments, narrowed by institute / criterion
  const [scope, setScope] = useState('department'); // 'department' | 'all'
  const [instituteFilter, setInstituteFilter] = useState('ALL');
  const [criterionFilter, setCriterionFilter] = useState('ALL');
  const showAll = userRole === 'Admin' && scope === 'all';
  // HOD writes the corrective action; auditor only verifies and signs off (backend enforces the same split)
  const canEditAction = userRole === 'Admin' || userRole === 'HOD';
  const canSignOff = userRole === 'Admin' || userRole === 'Auditor';

  const fetchAtrs = async () => {
    setLoading(true);
    try {
      let url = `/api/atr/?cycle_id=${selectedCycleId || ''}`;
      if (showAll) {
        if (instituteFilter !== 'ALL') url += `&institute_code=${encodeURIComponent(instituteFilter)}`;
        if (criterionFilter !== 'ALL') url += `&criterion_code=${encodeURIComponent(criterionFilter)}`;
      } else if (selectedDepartmentId) {
        url += `&department_id=${selectedDepartmentId}`;
      }
      if (statusFilter !== 'ALL') url += `&status=${encodeURIComponent(statusFilter)}`;
      const res = await fetch(url);
      const json = await res.json();
      setAtrs(json.atrs || []);
    } catch (err) {
      console.error("Failed to load ATRs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAtrs();
    setSelectedIds(new Set());
  }, [selectedDepartmentId, selectedCycleId, statusFilter, showAll, instituteFilter, criterionFilter]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === atrs.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(atrs.map(a => a.atr_id)));
  };

  const handleSaveATR = async (atrData) => {
    setSaveStatus('Saving...');
    try {
      const res = await fetch('/api/atr/update/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(atrData)
      });
      const json = await res.json();
      if (json.status === 'success') {
        setSaveStatus('Saved successfully!');
        setEditingAtr(null);
        await fetchAtrs();
      } else {
        setSaveStatus(json.error || 'Failed to save');
      }
    } catch (err) {
      setSaveStatus('Failed to save');
    } finally {
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };

  // Bulk update status for selected rows
  const bulkUpdateStatus = async (newStatus) => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    for (const id of selectedIds) {
      await fetch('/api/atr/update/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atr_id: id, status: newStatus })
      });
    }
    await fetchAtrs();
    setSelectedIds(new Set());
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Banner */}
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
              ATR MANAGEMENT PORTAL
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Action Taken Report (ATR) Workspace
            </h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Collaborative root-cause analysis and corrective planning. <strong>Any indicator scored below 60% (W/D) is automatically added to this ATR list.</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {!showAll && (<>
          <a
            href={`/api/export/department-excel/?department_id=${selectedDepartmentId}&cycle_id=${selectedCycleId}`}
            download
            className="btn btn-secondary btn-sm"
            style={{ color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' }}
          >
            <Download size={14} /> Export ATR (Excel)
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
          </>)}
          {canEditAction && selectedIds.size > 0 && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                onClick={() => bulkUpdateStatus('In Progress')}
                className="btn btn-secondary btn-sm"
              >
                Mark {selectedIds.size} In Progress
              </button>
              <button 
                onClick={() => bulkUpdateStatus('Closed')}
                className="btn btn-primary btn-sm"
              >
                Close {selectedIds.size}
              </button>
            </div>
          )}
          <button onClick={fetchAtrs} className="btn btn-outline btn-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {userRole === 'Admin' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Scope:</span>
            {[
              ['department', departmentInfo ? `${departmentInfo.institute_code} - ${departmentInfo.code}` : 'Selected department'],
              ['all', 'All departments']
            ].map(([key, text]) => (
              <button
                key={key}
                onClick={() => setScope(key)}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: scope === key ? '#0891b2' : '#1e293b',
                  color: scope === key ? '#fff' : '#94a3b8'
                }}
              >
                {text}
              </button>
            ))}
            {showAll && (
              <>
                <select
                  value={instituteFilter}
                  onChange={(e) => setInstituteFilter(e.target.value)}
                  style={{ width: '130px', padding: '4px 8px', fontSize: '0.75rem' }}
                >
                  <option value="ALL">All institutes</option>
                  {institutes.map(i => (
                    <option key={i.code} value={i.code}>{i.code}</option>
                  ))}
                </select>
                <select
                  value={criterionFilter}
                  onChange={(e) => setCriterionFilter(e.target.value)}
                  style={{ width: '130px', padding: '4px 8px', fontSize: '0.75rem' }}
                >
                  <option value="ALL">All criteria</option>
                  {criteriaList.map(c => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Filter Status:</span>
          {['ALL', 'Open', 'In Progress', 'Closed'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: statusFilter === st ? '#4f46e5' : '#1e293b',
                color: statusFilter === st ? '#fff' : '#94a3b8'
              }}
            >
              {st}
            </button>
          ))}
        </div>
        </div>

        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          Showing <strong>{atrs.length}</strong> ATR items | <strong>{selectedIds.size}</strong> selected
        </div>
      </div>

      {/* ATR Table */}
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
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === atrs.length}
                  onChange={toggleSelectAll}
                  disabled={!canEditAction}
                />
              </th>
              <th style={{ width: '90px' }}>Dept</th>
              <th style={{ width: '80px' }}>Criterion</th>
              <th style={{ width: '90px' }}>Metric</th>
              <th style={{ width: '70px', textAlign: 'center' }}>Grade</th>
              <th style={{ minWidth: '220px' }}>Key Aspect & Gap Note</th>
              <th style={{ minWidth: '200px' }}>Root Cause Analysis</th>
              <th style={{ minWidth: '200px' }}>Corrective Action Plan</th>
              <th style={{ width: '100px' }}>Target Date</th>
              <th style={{ width: '110px', textAlign: 'center' }}>Status</th>
              <th style={{ width: '90px', textAlign: 'center' }}>Sign-off</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {atrs.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  No Action Taken Reports match current filter.
                </td>
              </tr>
            ) : (
              atrs.map(item => {
                const isSelected = selectedIds.has(item.atr_id);
                return (
                  <tr key={item.atr_id} className={isSelected ? 'selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.atr_id)}
                        disabled={!canEditAction}
                      />
                    </td>
                    <td style={{ fontWeight: 700, color: '#818cf8' }}>
                      {item.institute_code} - {item.department_code}
                    </td>
                    <td style={{ fontWeight: 700, color: '#e2e8f0' }}>{item.criterion_code}</td>
                    <td style={{ fontWeight: 700, color: '#a5b4fc' }}>{item.metric_code}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge badge-${item.grade.toLowerCase()}`}>
                        {item.grade}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                        {item.key_aspect}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#f59e0b' }}>
                        Remarks: {item.auditor_remarks || 'Benchmark gap detected.'}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: item.root_cause ? '#cbd5e1' : '#64748b' }}>
                      {item.root_cause || 'Pending HOD analysis...'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: item.action_plan ? '#cbd5e1' : '#64748b' }}>
                      {item.action_plan || 'Pending action plan...'}
                    </td>
                    <td style={{ fontSize: '0.775rem', color: '#94a3b8' }}>
                      {item.target_date || '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span 
                        className="badge" 
                        style={{
                          background: item.status === 'Closed' ? 'rgba(16, 185, 129, 0.15)' : (item.status === 'In Progress' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                          color: item.status === 'Closed' ? '#10b981' : (item.status === 'In Progress' ? '#f59e0b' : '#ef4444'),
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.auditor_signoff ? (
                        <CheckCircle size={18} color="#10b981" />
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Pending</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => setEditingAtr(item)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                      >
                        <Edit3 size={13} /> {canEditAction ? 'Edit' : 'Review'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit ATR Modal */}
      {editingAtr && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                {canEditAction ? 'Write Action Taken Report (ATR)' : 'Review & Sign-off ATR'}
              </h3>
              <button 
                onClick={() => setEditingAtr(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, color: '#a5b4fc', fontSize: '0.85rem' }}>
                {editingAtr.criterion_code} ({editingAtr.metric_code}) — Grade: {editingAtr.grade}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px' }}>
                {editingAtr.key_aspect}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '6px' }}>
                Auditor remarks: {editingAtr.auditor_remarks || '-'} ({editingAtr.percentage}%)
              </div>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              handleSaveATR(editingAtr);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Fields the HOD fills in; read-only for the auditor */}
              <fieldset disabled={!canEditAction} style={{ border: 'none', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Root Cause Analysis (Why did this indicator fall short?)
                </label>
                <textarea
                  rows="3"
                  value={editingAtr.root_cause || ''}
                  onChange={(e) => setEditingAtr({ ...editingAtr, root_cause: e.target.value })}
                  placeholder="Identify procedural, record-keeping, or systemic root cause..."
                />
              </div>

              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Corrective Action Plan
                </label>
                <textarea
                  rows="3"
                  value={editingAtr.action_plan || ''}
                  onChange={(e) => setEditingAtr({ ...editingAtr, action_plan: e.target.value })}
                  placeholder="Specific actions, responsible faculty, and target milestones..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={editingAtr.target_date || ''}
                    onChange={(e) => setEditingAtr({ ...editingAtr, target_date: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Resolution Status
                  </label>
                  <select
                    value={editingAtr.status || 'Open'}
                    onChange={(e) => setEditingAtr({ ...editingAtr, status: e.target.value })}
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Evidence / Resolution URL
                </label>
                <input
                  type="text"
                  value={editingAtr.evidence_ref || ''}
                  onChange={(e) => setEditingAtr({ ...editingAtr, evidence_ref: e.target.value })}
                  placeholder="Link to minutes of meeting, revised file folder, or document repository..."
                />
              </div>

              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  HOD Remarks
                </label>
                <input
                  type="text"
                  value={editingAtr.hod_remarks || ''}
                  onChange={(e) => setEditingAtr({ ...editingAtr, hod_remarks: e.target.value })}
                  placeholder="Any remarks for the auditor..."
                />
              </div>
              </fieldset>

              {!canSignOff && editingAtr.auditor_signoff && (
                <div style={{ fontSize: '0.8rem', color: '#10b981' }}>
                  ✓ Signed off by auditor{editingAtr.auditor_feedback ? `: ${editingAtr.auditor_feedback}` : ''}
                </div>
              )}

              {canSignOff && (
                <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', fontWeight: 700, color: '#10b981', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(editingAtr.auditor_signoff)}
                      onChange={(e) => setEditingAtr({ ...editingAtr, auditor_signoff: e.target.checked })}
                    />
                    <span>Auditor Sign-off (Verify that corrective action resolves the audit finding)</span>
                  </label>
                  <input
                    type="text"
                    value={editingAtr.auditor_feedback || ''}
                    onChange={(e) => setEditingAtr({ ...editingAtr, auditor_feedback: e.target.value })}
                    placeholder="Auditor closing feedback remarks..."
                    style={{ marginTop: '8px', fontSize: '0.775rem' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                {saveStatus && (
                  <span style={{ fontSize: '0.775rem', color: saveStatus.startsWith('Saved') || saveStatus.startsWith('Saving') ? '#10b981' : '#ef4444', marginRight: 'auto' }}>
                    {saveStatus}
                  </span>
                )}
                <button type="button" onClick={() => setEditingAtr(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Save size={15} /> Save ATR Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
