import React, { useState, useEffect } from 'react';
import { 
  UserCheck, UserPlus, Building, PlusCircle, CheckCircle2, 
  AlertCircle, Shield, RefreshCw, Save, Search, Download, Upload, Copy, Key, RotateCcw, Pencil
} from 'lucide-react';

export default function AdminAllocation({ 
  institutes, 
  departments, 
  auditors, 
  cycles, 
  selectedCycleId, 
  criteriaList,
  onDepartmentAdded,
  onAuditorAdded 
}) {
  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments' | 'pool'
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchAuditor, setSearchAuditor] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [saveIsError, setSaveIsError] = useState(false);
  const [resettingAllAssignments, setResettingAllAssignments] = useState(false);
  const [resetRequest, setResetRequest] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [editingAssignmentIds, setEditingAssignmentIds] = useState(() => new Set());
  const [editRequest, setEditRequest] = useState(null);
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [autoAllotPreview, setAutoAllotPreview] = useState(null);
  const [isPreviewingAutoAllot, setIsPreviewingAutoAllot] = useState(false);
  const [isApplyingAutoAllot, setIsApplyingAutoAllot] = useState(false);
  // College Head logins (from bootstrap.institutes; Admin only)
  const [heads, setHeads] = useState(institutes || []);
  useEffect(() => { setHeads(institutes || []); }, [institutes]);
  const saveHead = async (h) => {
    try {
      const res = await fetch('/api/college-heads/save/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institute_id: h.id, head_name: h.head_name, head_email: h.head_email })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save');
      setHeads(prev => prev.map(x => (x.id === h.id ? { ...x, ...json.institute } : x)));
      setSaveIsError(false);
      setSaveStatus(`Saved Coll Head of ${h.code}`);
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  // Passwords shown once in this browser tab ('auditor:12' -> password); never kept by the server
  const [shownPasswords, setShownPasswords] = useState({});
  const [passwordStatus, setPasswordStatus] = useState({});

  const accountPassword = async (kind, id, action, label) => {
    if (action === 'reset' && !window.confirm(`Issue a new password for ${label}? The current password stops working at once and the user must choose a new one at first login.`)) return;
    try {
      const res = await fetch('/api/accounts/password/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, action })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not get the password');
      setShownPasswords(prev => ({ ...prev, [`${kind}:${id}`]: json.password }));
      setPasswordStatus(prev => ({ ...prev, [`${kind}:${id}`]: 'first_login' }));
    } catch (err) {
      alert(err.message);
    }
  };

  // Password cell: pending -> "Show once"; afterwards only "Reset"
  const PasswordCell = ({ kind, id, status, label }) => {
    const key = `${kind}:${id}`;
    const shown = shownPasswords[key];
    const st = passwordStatus[key] || status;
    if (st === 'no_login') return <span style={{ color: 'var(--text-muted)' }}>No login</span>;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {shown ? (
          <>
            <code style={{ fontFamily: 'monospace', fontWeight: 700 }}>{shown}</code>
            <button className="btn btn-outline btn-sm" style={{ padding: '2px 6px' }} title="Copy"
              onClick={() => navigator.clipboard?.writeText(shown)}><Copy size={12} /></button>
          </>
        ) : st === 'pending' ? (
          <button className="btn btn-outline btn-sm" style={{ padding: '2px 8px' }}
            title="Shows the initial password once; it is then deleted from the server"
            onClick={() => accountPassword(kind, id, 'reveal', label)}>Show once</button>
        ) : (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {st === 'set' ? 'Set by user' : 'Waiting for first login'}
          </span>
        )}
        <button className="btn btn-outline btn-sm" style={{ padding: '2px 8px' }}
          title="Issue a new random password (shown once)"
          onClick={() => accountPassword(kind, id, 'reset', label)}>Reset</button>
      </span>
    );
  };
  // Assignment table filters
  const [collegeFilter, setCollegeFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [assignFilter, setAssignFilter] = useState('ALL'); // 'ALL' | 'assigned' | 'unassigned'

  // Modals
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showAddAuditorModal, setShowAddAuditorModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Forms
  const [newDept, setNewDept] = useState({ institute_code: '', code: '', name: '', hod_name: '', hod_email: '' });
  const [newAuditor, setNewAuditor] = useState({ name: '', email: '', institute_code: '', department_name: '', designation: 'Associate Professor', experience: '10 and above' });
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkImportResults, setBulkImportResults] = useState(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assignments/?cycle_id=${selectedCycleId || ''}`);
      const json = await res.json();
      setAssignments((json.assignments || []).map(assignment => ({
        ...assignment,
        saved_auditor_1_id: assignment.auditor_1?.id || null,
        saved_auditor_2_id: assignment.auditor_2?.id || null,
      })));
      setEditingAssignmentIds(new Set());
    } catch (err) {
      console.error("Failed to load assignments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [selectedCycleId]);

  const visibleRows = assignments.filter(a =>
    (collegeFilter === 'ALL' || a.institute_code === collegeFilter) &&
    (deptFilter === 'ALL' || String(a.department_id) === String(deptFilter)) &&
    (assignFilter === 'ALL' || (assignFilter === 'assigned' ? a.assigned : !a.assigned)));

  const auditorAllocationCounts = new Map();
  assignments.forEach(assignment => {
    [assignment.auditor_1?.id, assignment.auditor_2?.id].filter(Boolean).forEach(id => {
      auditorAllocationCounts.set(id, (auditorAllocationCounts.get(id) || 0) + 1);
    });
  });

  // Deployment rules (also enforced by the server):
  //  * not from the department's own college
  //  * not from the same department (discipline) in any college, e.g. no ECE auditor for ECE / ECE (VLSI)
  //  * Auditor 2 is not from Auditor 1's department (any college)
  //  * one department in each of at most two other colleges per audit cycle
  const discipline = (code) => (code || '').split('(')[0].trim().toUpperCase();
  const auditorDept = (aud) => discipline(aud?.dept_name || aud?.dept);
  const auditorChoices = (row, slot) => {
    const current = row[slot]?.id;
    const partner = slot === 'auditor_1' ? row.auditor_2 : row.auditor_1;
    const partnerDept = partner ? auditorDept(auditors.find(a => a.id === partner.id) || partner) : '';
    return auditors.filter(a => {
      if (a.id === current) return true;
      if (a.institute_code === row.institute_code ||
          auditorDept(a) === discipline(row.department_code) ||
          a.id === partner?.id ||
          (partnerDept && auditorDept(a) === partnerDept)) return false;
      const assignedElsewhere = assignments.filter(assignment =>
        assignment.department_id !== row.department_id &&
        [assignment.auditor_1?.id, assignment.auditor_2?.id].includes(a.id));
      const assignedColleges = new Set(assignedElsewhere.map(assignment => assignment.institute_code));
      return !assignedColleges.has(row.institute_code) && assignedColleges.size < 2;
    });
  };

  // Update auditor selection
  const handleAuditorChange = (deptId, auditorField, auditorObj) => {
    setAssignments(prev => prev.map(a => {
      if (a.department_id !== deptId) return a;
      const next = { ...a, [auditorField]: auditorObj };
      // A new Auditor 1 from the same department as Auditor 2 clears Auditor 2 (and vice versa)
      const otherField = auditorField === 'auditor_1' ? 'auditor_2' : 'auditor_1';
      if (auditorObj && next[otherField] && auditorDept(auditorObj) === auditorDept(auditors.find(x => x.id === next[otherField].id) || next[otherField])) {
        next[otherField] = null;
      }
      return next;
    }));
  };

  // Update a plain field of a row (e.g. status)
  const handleAssignmentChange = (deptId, field, value) => {
    setAssignments(prev => prev.map(a => (a.department_id === deptId ? { ...a, [field]: value } : a)));
  };

  // Toggle individual criterion for a specific auditor (Auditor 1 or Auditor 2)
  const toggleAuditorCriteria = (deptId, auditorNumber, critCode) => {
    const fieldName = auditorNumber === 1 ? 'auditor_1_criteria' : 'auditor_2_criteria';
    setAssignments(prev => prev.map(a => {
      if (a.department_id !== deptId) return a;
      const currentList = Array.isArray(a[fieldName]) ? [...a[fieldName]] : [];
      let updated;
      if (currentList.includes(critCode)) {
        updated = currentList.filter(c => c !== critCode);
      } else {
        updated = [...currentList, critCode];
      }
      return { ...a, [fieldName]: updated };
    }));
  };

  // Toggle ALL criteria for a specific auditor
  const toggleAllAuditorCriteria = (deptId, auditorNumber) => {
    const fieldName = auditorNumber === 1 ? 'auditor_1_criteria' : 'auditor_2_criteria';
    const allCodes = criteriaList.map(c => c.code);
    setAssignments(prev => prev.map(a => {
      if (a.department_id !== deptId) return a;
      const currentList = Array.isArray(a[fieldName]) ? a[fieldName] : [];
      const isAll = currentList.length === allCodes.length;
      return { ...a, [fieldName]: isAll ? [] : allCodes };
    }));
  };

  // Reset one department: clear its auditors so they can be reassigned (scores already entered are kept)
  const resetAssignmentRow = (row) => {
    const label = `${row.institute_code} - ${row.department_code}`;
    const blank = { id: null, assigned: false, auditor_1: null, auditor_2: null, auditor_1_criteria: [], auditor_2_criteria: [],
      saved_auditor_1_id: null, saved_auditor_2_id: null,
      assigned_criteria: [], deployment_check: 'Not assigned yet', status: 'Not started' };
    if (!row.assigned) {  // nothing saved yet: just clear the unsaved choices
      setAssignments(prev => prev.map(a => (a.department_id === row.department_id ? { ...a, ...blank } : a)));
      return;
    }
    const cycleName = cycles.find(c => c.id === selectedCycleId);
    if (!window.confirm(`Reset the auditor assignment of ${label}${cycleName ? ` for ${cycleName.academic_year} ${cycleName.semester} (${cycleName.cycle_type})` : ''}?\n\n` +
      'Both auditors are removed from this department and become available for other departments. ' +
      'Scores and ATRs already entered are kept.')) return;
    setEditingAssignmentIds(prev => {
      const next = new Set(prev);
      next.delete(row.department_id);
      return next;
    });
    setResetError('');
    setResetPassword('');
    setResetRequest({ type: 'single', row, label, blank });
  };

  const toggleAssignmentEdit = (row) => {
    const isEditing = editingAssignmentIds.has(row.department_id);
    setEditingAssignmentIds(prev => {
      const next = new Set(prev);
      if (isEditing) next.delete(row.department_id);
      else next.add(row.department_id);
      return next;
    });
    if (isEditing) {
      setAssignments(current => current.map(assignment => assignment.department_id === row.department_id
        ? {
          ...assignment,
          auditor_1: auditors.find(auditor => auditor.id === assignment.saved_auditor_1_id) || null,
          auditor_2: auditors.find(auditor => auditor.id === assignment.saved_auditor_2_id) || null,
        }
        : assignment));
    }
  };

  const resetAllAssignments = () => {
    const cycleName = cycles.find(c => c.id === selectedCycleId);
    const cycleLabel = cycleName
      ? `${cycleName.academic_year} ${cycleName.semester} (${cycleName.cycle_type})`
      : 'the selected cycle';
    const savedCount = assignments.filter(assignment => assignment.assigned).length;
    if (!window.confirm(
      `Full reset for ${cycleLabel}?\n\n` +
      `This removes all ${savedCount} saved auditor assignments and their criteria, and clears unsaved choices. ` +
      'Scores and ATR data are kept.'
    )) return;
    setResetError('');
    setResetPassword('');
    setResetRequest({ type: 'all', cycleLabel });
  };

  const confirmAssignmentReset = async (event) => {
    event.preventDefault();
    if (!resetRequest || !resetPassword) {
      setResetError('Enter the current Admin password to continue.');
      return;
    }
    setIsResetting(true);
    setResettingAllAssignments(true);
    try {
      const isFullReset = resetRequest.type === 'all';
      const endpoint = isFullReset ? '/api/assignments/reset-all/' : '/api/assignments/reset/';
      const payload = isFullReset
        ? { cycle_id: selectedCycleId, password: resetPassword }
        : {
          department_id: resetRequest.row.department_id,
          cycle_id: selectedCycleId,
          password: resetPassword,
        };
      setSaveIsError(false);
      setSaveStatus(isFullReset ? 'Resetting all auditor assignments...' : `Resetting ${resetRequest.label}...`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Reset failed');
      if (isFullReset) {
        setAssignments(prev => prev.map(assignment => ({
          ...assignment,
          id: null,
          assigned: false,
          auditor_1: null,
          auditor_2: null,
          saved_auditor_1_id: null,
          saved_auditor_2_id: null,
          auditor_1_criteria: [],
          auditor_2_criteria: [],
          assigned_criteria: [],
          deployment_check: 'Not assigned yet',
          status: 'Not started',
        })));
        setSaveStatus(
          `All assignments reset (${json.assignments_removed} removed). ` +
          `${json.scores_kept} existing scores and all ATR data are kept.`
        );
      } else {
        setAssignments(prev => prev.map(a => (
          a.department_id === resetRequest.row.department_id
            ? { ...a, ...resetRequest.blank }
            : a
        )));
        setSaveStatus(`${resetRequest.label} reset. Choose new auditors and click Save.`);
      }
      setResetRequest(null);
      setResetPassword('');
    } catch (err) {
      setResetError(err.message || 'Reset failed');
    } finally {
      setIsResetting(false);
      setResettingAllAssignments(false);
    }
  };

  const previewAutoAllotment = async () => {
    if (!selectedCycleId) return;
    setIsPreviewingAutoAllot(true);
    setSaveIsError(false);
    try {
      const res = await fetch('/api/assignments/auto-allot/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', cycle_id: selectedCycleId })
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Could not create auto-allotment preview');
      setAutoAllotPreview(json);
    } catch (err) {
      setSaveIsError(true);
      setSaveStatus(err.message || 'Could not create auto-allotment preview');
    } finally {
      setIsPreviewingAutoAllot(false);
    }
  };

  const applyAutoAllotment = async () => {
    if (!autoAllotPreview?.proposed?.length) return;
    setIsApplyingAutoAllot(true);
    setSaveIsError(false);
    try {
      const res = await fetch('/api/assignments/auto-allot/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          cycle_id: selectedCycleId,
          proposed: autoAllotPreview.proposed,
        })
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Could not apply auto-allotment');
      await fetchAssignments();
      const repeated = (json.repeated_auditors || []).map(auditor => auditor.name);
      setSaveStatus(
        `Auto-allotted ${json.assignments_created} department(s).` +
        (repeated.length ? ` Repeated across colleges: ${repeated.join(', ')}.` : ' No auditors are assigned twice.')
      );
      setAutoAllotPreview(null);
    } catch (err) {
      setSaveIsError(true);
      setSaveStatus(err.message || 'Could not apply auto-allotment');
    } finally {
      setIsApplyingAutoAllot(false);
      setTimeout(() => setSaveStatus(''), 8000);
    }
  };

  // Save assignment to backend with individual criteria for each auditor
  const saveAssignmentRow = async (assignment) => {
    setSaveStatus('Saving assignment...');
    setSaveIsError(false);
    let failed = false;
    try {
      const payload = {
        department_id: assignment.department_id,
        cycle_id: selectedCycleId,
        auditor_1_id: assignment.auditor_1?.id || null,
        auditor_2_id: assignment.auditor_2?.id || null,
        auditor_1_criteria: assignment.auditor_1_criteria || [],
        auditor_2_criteria: assignment.auditor_2_criteria || [],
        status: assignment.status || 'Not started'
      };

      const res = await fetch('/api/assignments/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.status === 'success') {
        setSaveStatus(`Saved: ${assignment.institute_code} - ${assignment.department_code}`);
        // Update only this row so unsaved choices in other rows are kept
        setAssignments(prev => prev.map(a => (a.department_id === assignment.department_id
          ? { ...a, id: json.assignment_id, assigned: true, deployment_check: json.check } : a)));
        setAssignments(prev => prev.map(a => (a.department_id === assignment.department_id
          ? {
            ...a,
            saved_auditor_1_id: assignment.auditor_1?.id || null,
            saved_auditor_2_id: assignment.auditor_2?.id || null,
          }
          : a)));
        setEditingAssignmentIds(prev => {
          const next = new Set(prev);
          next.delete(assignment.department_id);
          return next;
        });
        return true;
      } else {
        failed = true;
        setSaveStatus(json.error || 'Failed to save assignment');
      }
    } catch (err) {
      failed = true;
      setSaveStatus('Failed to save assignment');
    } finally {
      setSaveIsError(failed);
      setTimeout(() => setSaveStatus(''), failed ? 6000 : 2000);
    }
    return false;
  };

  const handleSaveAssignmentClick = (assignment) => {
    const auditorIdsChanged = assignment.auditor_1?.id !== assignment.saved_auditor_1_id ||
      assignment.auditor_2?.id !== assignment.saved_auditor_2_id;
    if (assignment.assigned && auditorIdsChanged) {
      setEditError('');
      setEditPassword('');
      setEditRequest(assignment);
      return;
    }
    saveAssignmentRow(assignment);
  };

  const confirmAssignmentEdit = async (event) => {
    event.preventDefault();
    if (!editRequest || !editPassword) {
      setEditError('Enter the current Admin password to save auditor changes.');
      return;
    }
    setIsSavingEdit(true);
    try {
      const payload = {
        department_id: editRequest.department_id,
        cycle_id: selectedCycleId,
        auditor_1_id: editRequest.auditor_1?.id || null,
        auditor_2_id: editRequest.auditor_2?.id || null,
        auditor_1_criteria: editRequest.auditor_1_criteria || [],
        auditor_2_criteria: editRequest.auditor_2_criteria || [],
        status: editRequest.status || 'Not started',
        edit_password: editPassword,
      };
      const res = await fetch('/api/assignments/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Could not update auditor assignment');
      setAssignments(prev => prev.map(assignment => assignment.department_id === editRequest.department_id
        ? {
          ...assignment,
          id: json.assignment_id,
          assigned: true,
          deployment_check: json.check,
          saved_auditor_1_id: editRequest.auditor_1?.id || null,
          saved_auditor_2_id: editRequest.auditor_2?.id || null,
        }
        : assignment));
      setEditingAssignmentIds(prev => {
        const next = new Set(prev);
        next.delete(editRequest.department_id);
        return next;
      });
      setSaveIsError(false);
      setSaveStatus(`Updated auditors: ${editRequest.institute_code} - ${editRequest.department_code}`);
      setEditRequest(null);
      setEditPassword('');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      setEditError(err.message || 'Could not update auditor assignment');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Add Department handler
  const handleAddDepartment = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/departments/add/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDept)
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(`Department ${newDept.code} added successfully! Auto-generated HOD Login:\nUsername: ${json.department.hod_username}\nPassword: ${json.department.hod_initial_password}`);
        setShowAddDeptModal(false);
        setNewDept({ institute_code: '', code: '', name: '', hod_name: '', hod_email: '' });
        if (onDepartmentAdded) onDepartmentAdded(json.department);
        await fetchAssignments();
      } else {
        alert(json.error || 'Failed to add department');
      }
    } catch (err) {
      alert('Error adding department');
    }
  };

  // Add Individual Auditor handler
  const handleAddAuditor = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auditors/add/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAuditor)
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(`Auditor ${newAuditor.name} registered!\nAuto-generated Login:\nUsername: ${json.auditor.username}\nPassword: ${json.auditor.initial_password}`);
        setShowAddAuditorModal(false);
        setNewAuditor({ name: '', email: '', institute_code: '', department_name: '', designation: 'Associate Professor', experience: '10 and above' });
        if (onAuditorAdded) onAuditorAdded(json.auditor);
      } else {
        alert(json.error || 'Failed to add auditor');
      }
    } catch (err) {
      alert('Error adding auditor');
    }
  };

  // Bulk Import Auditors
  const handleBulkImport = async () => {
    if (!bulkCsvText.trim()) return;
    setIsBulkImporting(true);
    try {
      const res = await fetch('/api/auditors/bulk-upload/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_text: bulkCsvText })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setBulkImportResults(json);
        // Refresh auditors list
        json.imported.forEach(a => {
          if (onAuditorAdded) onAuditorAdded(a);
        });
      } else {
        alert(json.error || 'Bulk upload failed');
      }
    } catch (err) {
      alert('Error during bulk import');
    } finally {
      setIsBulkImporting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBulkCsvText(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const filteredAuditors = auditors.filter(a => 
    a.name.toLowerCase().includes(searchAuditor.toLowerCase()) ||
    a.dept_name.toLowerCase().includes(searchAuditor.toLowerCase()) ||
    a.designation.toLowerCase().includes(searchAuditor.toLowerCase()) ||
    (a.username && a.username.toLowerCase().includes(searchAuditor.toLowerCase())) ||
    a.institute_code.toLowerCase().includes(searchAuditor.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Banner */}
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
              IQAC & AUDIT GOVERNANCE
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Auditor Allocation & Department Administration
            </h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Assign criteria <strong>individually to each auditor</strong>. Automatic user accounts and passwords are generated by the system for all auditors and HODs.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => setShowBulkModal(true)} className="btn btn-secondary btn-sm" style={{ background: '#0284c7', color: '#fff' }}>
            <Upload size={14} /> Bulk Add Auditors
          </button>
          <a href="/api/auditors/template/" download className="btn btn-outline btn-sm">
            <Download size={14} /> Download Template
          </a>
          <button onClick={() => setShowAddDeptModal(true)} className="btn btn-primary btn-sm">
            <PlusCircle size={14} /> +Dept
          </button>
          <button onClick={() => setShowAddAuditorModal(true)} className="btn btn-secondary btn-sm">
            <UserPlus size={14} /> +Auditor
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('assignments')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            background: activeTab === 'assignments' ? 'var(--primary)' : 'var(--bg-card-hover)',
            color: activeTab === 'assignments' ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeTab === 'assignments' ? '0 2px 8px var(--primary-light)' : undefined
          }}
        >
          Department Auditor Assignments ({assignments.filter(a => a.assigned).length} / {assignments.length})
        </button>
        <button
          onClick={() => setActiveTab('pool')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            background: activeTab === 'pool' ? 'var(--primary)' : 'var(--bg-card-hover)',
            color: activeTab === 'pool' ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeTab === 'pool' ? '0 2px 8px var(--primary-light)' : undefined
          }}
        >
          Auditor Pool & Auto-Logins ({auditors.length})
        </button>
      </div>

      {/* Tab 1: Assignments Table with INDIVIDUAL AUDITOR CRITERIA ASSIGNMENT */}
      {activeTab === 'assignments' && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ padding: '12px 18px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              💡 <strong>Individual Criteria Assignment</strong>: Click criterion chips under each auditor to assign specific criteria (e.g. C1-C3 to Auditor 1, C4-C9 to Auditor 2).
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
              {saveStatus && <span style={{ fontSize: '0.75rem', color: saveIsError ? '#ef4444' : '#10b981', fontWeight: 700 }}>{saveStatus}</span>}
              <button
                type="button"
                onClick={previewAutoAllotment}
                className="btn btn-secondary btn-sm"
                disabled={isPreviewingAutoAllot || loading || !selectedCycleId}
                title="Create a rule-checked proposal for departments without a complete auditor pair"
              >
                <UserCheck size={13} />
                {isPreviewingAutoAllot ? 'Preparing...' : 'Auto allot'}
              </button>
              <button
                type="button"
                onClick={resetAllAssignments}
                className="btn btn-outline btn-sm"
                disabled={resettingAllAssignments || loading || !selectedCycleId}
                title="Remove all auditor assignments and criteria for the selected cycle; scores and ATRs remain"
              >
                <RotateCcw size={13} />
                {resettingAllAssignments ? 'Resetting...' : 'Full reset'}
              </button>
            </div>
          </div>

          {/* Choose the college and department to assign auditors to */}
          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>College:
              <select value={collegeFilter} onChange={(e) => { setCollegeFilter(e.target.value); setDeptFilter('ALL'); }}
                style={{ width: '130px', padding: '5px 8px', fontSize: '0.8rem' }}>
                <option value="ALL">All colleges</option>
                {institutes.map(i => <option key={i.code} value={i.code}>{i.code}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>Department:
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
                style={{ width: '200px', padding: '5px 8px', fontSize: '0.8rem' }}>
                <option value="ALL">All departments</option>
                {assignments.filter(a => collegeFilter === 'ALL' || a.institute_code === collegeFilter).map(a => (
                  <option key={a.department_id} value={a.department_id}>{a.institute_code} - {a.department_code}</option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 600, color: 'var(--chip-label)' }}>Show:</span>
              {[['ALL', 'All'], ['unassigned', 'Not assigned'], ['assigned', 'Assigned']].map(([key, text]) => (
                <button key={key} onClick={() => setAssignFilter(key)}
                  style={{
                    padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '6px', cursor: 'pointer',
                    border: assignFilter === key ? '1px solid transparent' : '1px solid var(--chip-border)',
                    background: assignFilter === key ? 'var(--chip-active-bg)' : 'var(--chip-bg)',
                    color: assignFilter === key ? '#fff' : 'var(--chip-text)'
                  }}>
                  {text}
                </button>
              ))}
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Not offered: own college, matching department discipline, duplicate auditor pair, or another department in the same college. An auditor may cover one department in each of two other colleges. Edit saved auditor selections and confirm with the current Admin password.
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="audit-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Institute</th>
                  <th style={{ width: '90px' }}>Dept</th>
                  <th style={{ minWidth: '280px' }}>Lead Auditor (Auditor 1) & Assigned Criteria</th>
                  <th style={{ minWidth: '280px' }}>Second Auditor (Auditor 2) & Assigned Criteria</th>
                  <th style={{ minWidth: '150px' }}>Deployment Check</th>
                  <th style={{ width: '130px' }}>Status</th>
                  <th style={{ width: '150px', textAlign: 'center' }}>Save / Edit / Reset</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '18px' }}>
                    {loading ? 'Loading departments...' : 'No departments match the filters.'}
                  </td></tr>
                )}
                {visibleRows.map(row => {
                  const a1Set = new Set(row.auditor_1_criteria || []);
                  const a2Set = new Set(row.auditor_2_criteria || []);
                  const isA1All = criteriaList.length > 0 && a1Set.size === criteriaList.length;
                  const isA2All = criteriaList.length > 0 && a2Set.size === criteriaList.length;
                  const isEditing = editingAssignmentIds.has(row.department_id);
                  const a1AllocationCount = auditorAllocationCounts.get(row.auditor_1?.id) || 0;
                  const a2AllocationCount = auditorAllocationCounts.get(row.auditor_2?.id) || 0;
                  const repeatedA1 = a1AllocationCount > 1;
                  const repeatedA2 = a2AllocationCount > 1;

                  return (
                    <tr key={row.department_id}>
                      <td style={{ fontWeight: 700, color: '#818cf8' }}>{row.institute_code}</td>
                      <td style={{ fontWeight: 800, color: '#f8fafc' }}>{row.department_code}</td>

                      {/* Auditor 1 Column with Individual Criteria Chips */}
                      <td style={{ background: 'rgba(99, 102, 241, 0.03)' }}>
                        <select
                          value={row.auditor_1?.id || ''}
                          onChange={(e) => {
                            const found = auditors.find(a => a.id === Number(e.target.value));
                            handleAuditorChange(row.department_id, 'auditor_1', found || null);
                          }}
                          disabled={Boolean(row.auditor_1?.id) && !isEditing}
                          style={{
                            fontSize: '0.775rem',
                            padding: '4px 8px',
                            marginBottom: '6px',
                            ...(repeatedA1 ? {
                              background: '#7f1d1d',
                              border: '2px solid #ef4444',
                              color: '#fff',
                              fontWeight: 800,
                            } : {}),
                          }}
                          title={repeatedA1 ? `This auditor is allocated ${a1AllocationCount} times in this audit cycle` : undefined}
                        >
                          <option value="">-- Unassigned --</option>
                          {auditorChoices(row, 'auditor_1')
                            .map(a => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.institute_code} - {a.dept_name})
                              </option>
                            ))}
                        </select>
                        {repeatedA1 && (
                            <span style={{ display: 'block', color: '#ef4444', fontSize: '0.7rem', fontWeight: 800, marginBottom: '5px' }}>
                              Assigned {a1AllocationCount} times
                            </span>
                        )}

                        {/* Auditor 1 individual criteria picker */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--chip-a1-text)', fontWeight: 700 }}>A1 Criteria:</span>
                          <button
                            onClick={() => toggleAllAuditorCriteria(row.department_id, 1)}
                            style={{
                              padding: '1px 5px',
                              fontSize: '0.675rem',
                              borderRadius: '3px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: '1px solid var(--chip-a1)',
                              background: isA1All ? 'var(--chip-a1)' : 'transparent',
                              color: isA1All ? '#fff' : 'var(--chip-a1-text)'
                            }}
                          >
                            {isA1All ? 'All (9)' : 'All'}
                          </button>
                          {criteriaList.map(c => {
                            const isAssigned = a1Set.has(c.code);
                            return (
                              <button
                                key={c.code}
                                onClick={() => toggleAuditorCriteria(row.department_id, 1, c.code)}
                                style={{
                                  padding: '1px 4px',
                                  fontSize: '0.675rem',
                                  borderRadius: '3px',
                                  fontWeight: isAssigned ? 700 : 500,
                                  cursor: 'pointer',
                                  border: isAssigned ? '1px solid var(--chip-a1)' : '1px solid var(--chip-border)',
                                  background: isAssigned ? 'var(--chip-a1)' : 'var(--chip-bg)',
                                  color: isAssigned ? '#ffffff' : 'var(--chip-text)'
                                }}
                              >
                                {c.code}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* Auditor 2 Column with Individual Criteria Chips */}
                      <td style={{ background: 'rgba(6, 182, 212, 0.03)' }}>
                        <select
                          value={row.auditor_2?.id || ''}
                          onChange={(e) => {
                            const found = auditors.find(a => a.id === Number(e.target.value));
                            handleAuditorChange(row.department_id, 'auditor_2', found || null);
                          }}
                          disabled={Boolean(row.auditor_2?.id) && !isEditing}
                          style={{
                            fontSize: '0.775rem',
                            padding: '4px 8px',
                            marginBottom: '6px',
                            ...(repeatedA2 ? {
                              background: '#7f1d1d',
                              border: '2px solid #ef4444',
                              color: '#fff',
                              fontWeight: 800,
                            } : {}),
                          }}
                          title={repeatedA2 ? `This auditor is allocated ${a2AllocationCount} times in this audit cycle` : undefined}
                        >
                          <option value="">-- Unassigned --</option>
                          {auditorChoices(row, 'auditor_2')
                            .map(a => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.institute_code} - {a.dept_name})
                              </option>
                            ))}
                        </select>
                        {repeatedA2 && (
                            <span style={{ display: 'block', color: '#ef4444', fontSize: '0.7rem', fontWeight: 800, marginBottom: '5px' }}>
                              Assigned {a2AllocationCount} times
                            </span>
                        )}

                        {/* Auditor 2 individual criteria picker */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--chip-a2-text)', fontWeight: 700 }}>A2 Criteria:</span>
                          <button
                            onClick={() => toggleAllAuditorCriteria(row.department_id, 2)}
                            style={{
                              padding: '1px 5px',
                              fontSize: '0.675rem',
                              borderRadius: '3px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: '1px solid var(--chip-a2)',
                              background: isA2All ? 'var(--chip-a2)' : 'transparent',
                              color: isA2All ? '#fff' : 'var(--chip-a2-text)'
                            }}
                          >
                            {isA2All ? 'All (9)' : 'All'}
                          </button>
                          {criteriaList.map(c => {
                            const isAssigned = a2Set.has(c.code);
                            return (
                              <button
                                key={c.code}
                                onClick={() => toggleAuditorCriteria(row.department_id, 2, c.code)}
                                style={{
                                  padding: '1px 4px',
                                  fontSize: '0.675rem',
                                  borderRadius: '3px',
                                  fontWeight: isAssigned ? 700 : 500,
                                  cursor: 'pointer',
                                  border: isAssigned ? '1px solid var(--chip-a2)' : '1px solid var(--chip-border)',
                                  background: isAssigned ? 'var(--chip-a2)' : 'var(--chip-bg)',
                                  color: isAssigned ? '#ffffff' : 'var(--chip-text)'
                                }}
                              >
                                {c.code}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* Deployment Check Rule */}
                      <td>
                        <div style={{ 
                          fontSize: '0.725rem', 
                          color: !row.assigned ? 'var(--text-muted)' : row.deployment_check?.includes('Warning') ? '#ef4444' : '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {!row.assigned || row.deployment_check?.includes('Warning') ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
                          <span>{row.deployment_check || 'Rule verified'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <select
                          value={row.status || 'Not started'}
                          onChange={(e) => handleAssignmentChange(row.department_id, 'status', e.target.value)}
                          style={{ fontSize: '0.75rem', padding: '3px 6px' }}
                        >
                          <option value="Not started">Not started</option>
                          <option value="Digital audit done">Digital audit done</option>
                          <option value="Physical audit done">Physical audit done</option>
                          <option value="Report issued">Report issued</option>
                          <option value="ATR closed">ATR closed</option>
                        </select>
                      </td>

                      {/* Save / Reset Buttons */}
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => handleSaveAssignmentClick(row)}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '4px 8px' }}
                          title="Save this department's auditors and criteria"
                        >
                          <Save size={13} />
                        </button>
                        <button
                          onClick={() => toggleAssignmentEdit(row)}
                          className="btn btn-outline btn-sm"
                          style={{ padding: '4px 8px', marginLeft: '6px' }}
                          disabled={!row.assigned}
                          title={isEditing ? 'Cancel auditor edits' : 'Edit saved auditor selections'}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => resetAssignmentRow(row)}
                          className="btn btn-outline btn-sm"
                          style={{ padding: '4px 8px', marginLeft: '6px' }}
                          disabled={!row.assigned && !row.auditor_1 && !row.auditor_2}
                          title={row.assigned ? 'Reset: remove both auditors so the department can be reassigned' : 'Clear the unsaved choices'}
                        >
                          <RotateCcw size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Auditor Pool Directory & Automatic Logins */}
      {activeTab === 'pool' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* College Head ("Coll Head") logins: one per college, view-only access to all its departments */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ padding: '10px 16px', fontWeight: 800, fontSize: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
              College Head logins (Coll Head): view every department of their college, compare audits; no allocation or audit questions
            </div>
            <table className="audit-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>College</th>
                  <th style={{ minWidth: '180px' }}>Name</th>
                  <th style={{ minWidth: '200px' }}>Email (also accepted at login)</th>
                  <th style={{ minWidth: '120px' }}>Username</th>
                  <th style={{ minWidth: '200px' }}>Password (shown once)</th>
                  <th style={{ width: '70px' }}>Save</th>
                </tr>
              </thead>
              <tbody>
                {heads.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 700 }}>{h.code}</td>
                    <td><input value={h.head_name || ''} placeholder="Name of the College Head"
                      onChange={(e) => setHeads(prev => prev.map(x => (x.id === h.id ? { ...x, head_name: e.target.value } : x)))}
                      style={{ fontSize: '0.8rem', padding: '4px 8px' }} /></td>
                    <td><input type="email" value={h.head_email || ''} placeholder={`head.${h.code.toLowerCase()}@${h.code.toLowerCase()}.ac.in`}
                      onChange={(e) => setHeads(prev => prev.map(x => (x.id === h.id ? { ...x, head_email: e.target.value } : x)))}
                      style={{ fontSize: '0.8rem', padding: '4px 8px' }} /></td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{h.head_username || 'Created on save'}</td>
                    <td>{h.head_username
                      ? <PasswordCell kind="college_head" id={h.id} status={h.head_password_status} label={`Coll Head ${h.code}`} />
                      : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                    <td>
                      <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px' }} onClick={() => saveHead(h)} title="Save name / email (creates the login if needed)">
                        <Save size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* HOD logins: one per department */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ padding: '10px 16px', fontWeight: 800, fontSize: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
              HOD logins ({departments.length} departments)
            </div>
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              <table className="audit-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>College</th>
                    <th style={{ width: '110px' }}>Dept</th>
                    <th style={{ minWidth: '180px' }}>HOD</th>
                    <th style={{ minWidth: '160px' }}>Username</th>
                    <th style={{ minWidth: '200px' }}>Email (also accepted at login)</th>
                    <th style={{ minWidth: '220px' }}>Password (shown once)</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.filter(d => !searchAuditor || `${d.institute_code} ${d.code} ${d.hod_name} ${d.hod_username}`.toLowerCase().includes(searchAuditor.toLowerCase())).map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700 }}>{d.institute_code}</td>
                      <td style={{ fontWeight: 700 }}>{d.code}</td>
                      <td>{d.hod_name || '-'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{d.hod_username || '-'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{d.hod_email || '-'}</td>
                      <td>{d.hod_username
                        ? <PasswordCell kind="hod" id={d.id} status={d.hod_password_status} label={`HOD ${d.institute_code} - ${d.code}`} />
                        : <span style={{ color: 'var(--text-muted)' }}>No login</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                placeholder="Search auditor, username, dept..."
                value={searchAuditor}
                onChange={(e) => setSearchAuditor(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Total Pooled Auditors: <strong>{auditors.length}</strong> with system-generated logins
              </div>
              <a
                href="/api/auditors/export/"
                className="btn btn-secondary btn-sm"
                title="Download the complete auditor directory as an Excel workbook"
              >
                <Download size={14} /> Download Excel
              </a>
            </div>
          </div>

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
                  <th style={{ width: '40px' }}>Sl.</th>
                  <th style={{ width: '80px' }}>Institute</th>
                  <th style={{ width: '90px' }}>Dept</th>
                  <th style={{ minWidth: '160px' }}>Auditor Name</th>
                  <th style={{ minWidth: '150px' }}>Designation</th>
                  <th style={{ minWidth: '140px', background: '#172554', color: '#93c5fd' }}>
                    <Key size={12} style={{ display: 'inline', marginRight: '4px' }} /> Auto Username
                  </th>
                  <th style={{ minWidth: '200px', background: '#172554', color: '#93c5fd' }}>
                    Password (shown once)
                  </th>
                  <th style={{ minWidth: '180px' }}>Email Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditors.map((a, idx) => (
                  <tr key={a.id}>
                    <td style={{ color: '#64748b' }}>{a.sl_no || idx + 1}</td>
                    <td style={{ fontWeight: 700, color: '#818cf8' }}>{a.institute_code}</td>
                    <td style={{ fontWeight: 700, color: '#e2e8f0' }}>{a.dept_name}</td>
                    <td style={{ fontWeight: 700, color: '#f8fafc' }}>{a.name}</td>
                    <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{a.designation}</td>
                    <td style={{ fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700, background: 'rgba(30, 58, 138, 0.2)' }}>
                      {a.username || `auditor.${a.name.toLowerCase().replace(/[^a-z]/g, '')}`}
                    </td>
                    <td style={{ fontFamily: 'monospace', color: '#34d399', background: 'rgba(30, 58, 138, 0.2)' }}>
                      <PasswordCell kind="auditor" id={a.id} status={a.password_status} label={a.name} />
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{a.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Bulk Upload Auditors */}
      {showBulkModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '650px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={20} color="#38bdf8" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                  Bulk Add Auditors & Auto-Generate Credentials
                </h3>
              </div>
              <button onClick={() => { setShowBulkModal(false); setBulkImportResults(null); }} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px' }}>
              Upload a CSV file or paste CSV content with columns: <code>Name, Institute, Department, Designation, Experience, Email</code>. The system will automatically create individual auditor records and login accounts with auto-generated passwords.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <a href="/api/auditors/template/" download className="btn btn-secondary btn-sm">
                <Download size={14} /> Download CSV Template
              </a>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                style={{ fontSize: '0.8rem', color: '#94a3b8', width: 'auto' }}
              />
            </div>

            <textarea
              rows="6"
              value={bulkCsvText}
              onChange={(e) => setBulkCsvText(e.target.value)}
              placeholder="Name,Institute,Department,Designation,Experience,Email
Dr. K. Senthil,Institution 1,CSE,Professor,10 and above,senthil.k@college.edu
Mrs. M. Priya,Institution 2,ECE,Associate Professor,5 - 10 years,priya.m@college.edu"
              style={{ fontFamily: 'monospace', fontSize: '0.75rem', marginBottom: '14px' }}
            />

            {bulkImportResults && (
              <div style={{ background: '#0f172a', border: '1px solid #22c55e', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
                  ✓ Successfully imported {bulkImportResults.imported_count} auditors! System Logins:
                </div>
                <div style={{ maxHeight: '140px', overflowY: 'auto', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                  {bulkImportResults.imported.map((item, idx) => (
                    <div key={idx} style={{ padding: '3px 0', borderBottom: '1px solid #1e293b' }}>
                      <strong style={{ color: '#f8fafc' }}>{item.name}</strong> ({item.institute}-{item.department}) → User: <code style={{ color: '#60a5fa' }}>{item.username}</code> | Pass: <code style={{ color: '#34d399' }}>{item.initial_password}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => { setShowBulkModal(false); setBulkImportResults(null); }} 
                className="btn btn-secondary"
              >
                Close
              </button>
              <button 
                type="button" 
                onClick={handleBulkImport} 
                disabled={isBulkImporting || !bulkCsvText.trim()} 
                className="btn btn-primary"
              >
                {isBulkImporting ? 'Importing & Provisioning...' : 'Import Auditors'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Add Department */}
      {showAddDeptModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                Add New Department & Auto-Provision HOD Login
              </h3>
              <button onClick={() => setShowAddDeptModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleAddDepartment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Institute
                </label>
                <select
                  value={newDept.institute_code}
                  onChange={(e) => setNewDept({ ...newDept, institute_code: e.target.value })}
                >
                  {institutes.map(i => (
                    <option key={i.id} value={i.code}>{i.code} - {i.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Department Code (e.g. CSE, BIO, MECH)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ROBOTICS"
                  value={newDept.code}
                  onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Full Department Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Robotics and Automation Engineering"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  HOD Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. K. Ramanathan"
                  value={newDept.hod_name}
                  onChange={(e) => setNewDept({ ...newDept, hod_name: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  HOD Email
                </label>
                <input
                  type="email"
                  placeholder="hod.dept@krct.ac.in"
                  value={newDept.hod_email}
                  onChange={(e) => setNewDept({ ...newDept, hod_email: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAddDeptModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Dept & Provision HOD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Individual Auditor */}
      {showAddAuditorModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                Register Auditor & Auto-Generate Password
              </h3>
              <button onClick={() => setShowAddAuditorModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleAddAuditor} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. S. Balasubramanian"
                  value={newAuditor.name}
                  onChange={(e) => setNewAuditor({ ...newAuditor, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Institute
                  </label>
                  <select
                    value={newAuditor.institute_code}
                    onChange={(e) => setNewAuditor({ ...newAuditor, institute_code: e.target.value })}
                  >
                    {institutes.map(i => (
                      <option key={i.id} value={i.code}>{i.code}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Department
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CSE"
                    value={newAuditor.department_name}
                    onChange={(e) => setNewAuditor({ ...newAuditor, department_name: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Designation
                </label>
                <select
                  value={newAuditor.designation}
                  onChange={(e) => setNewAuditor({ ...newAuditor, designation: e.target.value })}
                >
                  <option value="Professor">Professor</option>
                  <option value="HoD/Associate Professor">HoD/Associate Professor</option>
                  <option value="Associate Professor">Associate Professor</option>
                  <option value="AHoD/Assistant Professor">AHoD/Assistant Professor</option>
                  <option value="Assistant Professor">Assistant Professor</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Experience
                </label>
                <select
                  value={newAuditor.experience}
                  onChange={(e) => setNewAuditor({ ...newAuditor, experience: e.target.value })}
                >
                  <option value="10 and above">10 and above</option>
                  <option value="5 - 10 years">5 - 10 years</option>
                  <option value="3 - 5 years">3 - 5 years</option>
                  <option value="Below 3 years">Below 3 years</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="auditor.name@college.edu"
                  value={newAuditor.email}
                  onChange={(e) => setNewAuditor({ ...newAuditor, email: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAddAuditorModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Register & Provision Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetRequest && (
        <div className="modal-overlay" role="presentation">
          <div className="modal-content animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="assignment-reset-title" style={{ maxWidth: '440px' }}>
            <h3 id="assignment-reset-title" style={{ marginBottom: '8px', fontSize: '1.1rem', fontWeight: 800 }}>
              Confirm auditor reset
            </h3>
            <p style={{ marginBottom: '14px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {resetRequest.type === 'all'
                ? `Enter the current Admin password to remove all auditor assignments for ${resetRequest.cycleLabel}. Scores and ATRs will remain.`
                : `Enter the current Admin password to reset ${resetRequest.label}. Scores and ATRs will remain.`}
            </p>
            <form onSubmit={confirmAssignmentReset} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                Current Admin password
                <input
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={resetPassword}
                  onChange={(event) => {
                    setResetPassword(event.target.value);
                    setResetError('');
                  }}
                  style={{ marginTop: '5px' }}
                />
              </label>
              {resetError && (
                <p role="alert" style={{ color: '#ef4444', fontSize: '0.8rem' }}>{resetError}</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isResetting}
                  onClick={() => {
                    setResetRequest(null);
                    setResetPassword('');
                    setResetError('');
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isResetting}>
                  <RotateCcw size={14} />
                  {isResetting ? 'Resetting...' : 'Authorize reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editRequest && (
        <div className="modal-overlay" role="presentation">
          <div className="modal-content animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="assignment-edit-title" style={{ maxWidth: '440px' }}>
            <h3 id="assignment-edit-title" style={{ marginBottom: '8px', fontSize: '1.1rem', fontWeight: 800 }}>
              Confirm auditor changes
            </h3>
            <p style={{ marginBottom: '14px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Enter the current Admin password to update the saved auditors for {editRequest.institute_code} - {editRequest.department_code}. Existing scores and ATRs will remain.
            </p>
            <form onSubmit={confirmAssignmentEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                Current Admin password
                <input
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={editPassword}
                  onChange={(event) => {
                    setEditPassword(event.target.value);
                    setEditError('');
                  }}
                  style={{ marginTop: '5px' }}
                />
              </label>
              {editError && (
                <p role="alert" style={{ color: '#ef4444', fontSize: '0.8rem' }}>{editError}</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSavingEdit}
                  onClick={() => {
                    setEditRequest(null);
                    setEditPassword('');
                    setEditError('');
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingEdit}>
                  <Save size={14} />
                  {isSavingEdit ? 'Saving...' : 'Authorize update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {autoAllotPreview && (
        <div className="modal-overlay" role="presentation">
          <div className="modal-content animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="auto-allot-title" style={{ maxWidth: '760px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
              <div>
                <h3 id="auto-allot-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>Auto-allotment preview</h3>
                <p style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Review the proposed assignments before saving. Existing auditor assignments are not changed.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setAutoAllotPreview(null)}
                style={{ background: 'transparent', border: 0, color: 'var(--text-secondary)', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '0.8rem' }}>
              <strong>{autoAllotPreview.proposed.length} department(s) proposed</strong>
              <span style={{ color: autoAllotPreview.unfilled.length ? '#f59e0b' : 'var(--grade-y)' }}>
                {autoAllotPreview.unfilled.length} department(s) cannot be fully allotted under the rules
              </span>
            </div>
            {autoAllotPreview.repeated_auditors.length > 0 && (
              <div style={{ padding: '10px 12px', marginBottom: '12px', borderRadius: '8px', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', fontSize: '0.8rem' }}>
                <strong>Auditors assigned twice across colleges:</strong>
                <ul style={{ margin: '6px 0 0 18px' }}>
                  {autoAllotPreview.repeated_auditors.map(auditor => (
                    <li key={auditor.auditor_id}>
                      {auditor.name} ({auditor.home_college}): {auditor.assignments.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ maxHeight: '42vh', overflow: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Auditor 1</th>
                    <th>Auditor 2</th>
                  </tr>
                </thead>
                <tbody>
                  {autoAllotPreview.proposed.map(item => (
                    <tr key={item.department_id}>
                      <td>{item.institute_code} - {item.department_code}</td>
                      <td>{item.auditor_1_name}</td>
                      <td>{item.auditor_2_name}</td>
                    </tr>
                  ))}
                  {autoAllotPreview.proposed.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No valid assignments available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {autoAllotPreview.unfilled.length > 0 && (
              <p style={{ marginTop: '10px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                Not filled: {autoAllotPreview.unfilled.map(dept => `${dept.institute_code} - ${dept.department_code}`).join(', ')}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" disabled={isApplyingAutoAllot} onClick={() => setAutoAllotPreview(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isApplyingAutoAllot || !autoAllotPreview.proposed.length}
                onClick={applyAutoAllotment}
              >
                <Save size={14} />
                {isApplyingAutoAllot ? 'Applying...' : 'Confirm and save'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
