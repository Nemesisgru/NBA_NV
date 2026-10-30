import React, { useState, useEffect } from 'react';
import { 
  UserCheck, UserPlus, Building, PlusCircle, CheckCircle2, 
  AlertCircle, Shield, RefreshCw, Save, Search, Download, Upload, Copy, Key 
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

  // Modals
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showAddAuditorModal, setShowAddAuditorModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Forms
  const [newDept, setNewDept] = useState({ institute_code: 'KRCT', code: '', name: '', hod_name: '', hod_email: '' });
  const [newAuditor, setNewAuditor] = useState({ name: '', email: '', institute_code: 'KRCT', department_name: '', designation: 'Associate Professor', experience: '10 and above' });
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkImportResults, setBulkImportResults] = useState(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assignments/?cycle_id=${selectedCycleId || ''}`);
      const json = await res.json();
      setAssignments(json.assignments || []);
    } catch (err) {
      console.error("Failed to load assignments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [selectedCycleId]);

  // Update auditor selection
  const handleAuditorChange = (deptId, auditorField, auditorObj) => {
    setAssignments(prev => prev.map(a => {
      if (a.department_id !== deptId) return a;
      return { ...a, [auditorField]: auditorObj };
    }));
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
        setSaveStatus('Assignment updated successfully!');
        await fetchAssignments();
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
        setNewDept({ institute_code: 'KRCT', code: '', name: '', hod_name: '', hod_email: '' });
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
        setNewAuditor({ name: '', email: '', institute_code: 'KRCT', department_name: '', designation: 'Associate Professor', experience: '10 and above' });
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
          Department Auditor Assignments ({assignments.length})
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
          <div style={{ padding: '12px 18px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              💡 <strong>Individual Criteria Assignment</strong>: Click criterion chips under each auditor to assign specific criteria (e.g. C1-C3 to Auditor 1, C4-C9 to Auditor 2).
            </span>
            {saveStatus && <span style={{ fontSize: '0.75rem', color: saveIsError ? '#ef4444' : '#10b981', fontWeight: 700 }}>{saveStatus}</span>}
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
                  <th style={{ width: '80px', textAlign: 'center' }}>Save</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(row => {
                  const a1Set = new Set(row.auditor_1_criteria || []);
                  const a2Set = new Set(row.auditor_2_criteria || []);
                  const isA1All = criteriaList.length > 0 && a1Set.size === criteriaList.length;
                  const isA2All = criteriaList.length > 0 && a2Set.size === criteriaList.length;

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
                          style={{ fontSize: '0.775rem', padding: '4px 8px', marginBottom: '6px' }}
                        >
                          <option value="">-- Unassigned --</option>
                          {auditors
                            .filter(a => a.institute_code !== row.institute_code || a.id === row.auditor_1?.id)
                            .map(a => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.institute_code} - {a.dept_name})
                              </option>
                            ))}
                        </select>

                        {/* Auditor 1 individual criteria picker */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.7rem', color: '#a5b4fc', fontWeight: 700 }}>A1 Criteria:</span>
                          <button
                            onClick={() => toggleAllAuditorCriteria(row.department_id, 1)}
                            style={{
                              padding: '1px 5px',
                              fontSize: '0.675rem',
                              borderRadius: '3px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: '1px solid #4f46e5',
                              background: isA1All ? '#4f46e5' : 'transparent',
                              color: isA1All ? '#fff' : '#a5b4fc'
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
                                  border: isAssigned ? '1px solid #6366f1' : '1px solid #23344d',
                                  background: isAssigned ? '#4f46e5' : '#0f172a',
                                  color: isAssigned ? '#ffffff' : '#64748b'
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
                          style={{ fontSize: '0.775rem', padding: '4px 8px', marginBottom: '6px' }}
                        >
                          <option value="">-- Unassigned --</option>
                          {auditors
                            .filter(a => a.institute_code !== row.institute_code || a.id === row.auditor_2?.id)
                            .map(a => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.institute_code} - {a.dept_name})
                              </option>
                            ))}
                        </select>

                        {/* Auditor 2 individual criteria picker */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>A2 Criteria:</span>
                          <button
                            onClick={() => toggleAllAuditorCriteria(row.department_id, 2)}
                            style={{
                              padding: '1px 5px',
                              fontSize: '0.675rem',
                              borderRadius: '3px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: '1px solid #0284c7',
                              background: isA2All ? '#0284c7' : 'transparent',
                              color: isA2All ? '#fff' : '#38bdf8'
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
                                  border: isAssigned ? '1px solid #0284c7' : '1px solid #23344d',
                                  background: isAssigned ? '#0284c7' : '#0f172a',
                                  color: isAssigned ? '#ffffff' : '#64748b'
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
                          color: row.deployment_check?.includes('Warning') ? '#ef4444' : '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {row.deployment_check?.includes('Warning') ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
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

                      {/* Save Button */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => saveAssignmentRow(row)}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '4px 8px' }}
                        >
                          <Save size={13} />
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
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Total Pooled Auditors: <strong>{auditors.length}</strong> with system-generated logins
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
                  <th style={{ minWidth: '140px', background: '#172554', color: '#93c5fd' }}>
                    Password
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
                      {a.initial_password || 'Audit@2025#'}
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
Dr. K. Senthil,KRCT,CSE,Professor,10 and above,senthil.k@krct.ac.in
Mrs. M. Priya,KRCE,ECE,Associate Professor,5 - 10 years,priya.m@krce.ac.in"
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
                  placeholder="auditor.name@krgi.edu"
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

    </div>
  );
}
