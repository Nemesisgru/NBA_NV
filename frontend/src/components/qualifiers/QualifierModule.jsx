import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  ExternalLink,
  Download,
  RefreshCw,
  Building2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import ChecklistTab from './ChecklistTab';
import DepartmentsTab from './DepartmentsTab';
import PrimaryCheckTab from './PrimaryCheckTab';
import ProgramTab from './ProgramTab';
import QualifierSidebar from './QualifierSidebar';
import CollegeSelectModal from './CollegeSelectModal';

const getDepartmentOptions = (departments = []) => {
  const departmentsByName = new Map();
  departments
    .filter((department) => department.department_name?.trim())
    .forEach((department) => {
      const key = department.department_name.trim().toLocaleLowerCase();
      const existing = departmentsByName.get(key);
      if (!existing || (department.program_classification === 'UG' && existing.program_classification !== 'UG')) {
        departmentsByName.set(key, department);
      }
    });

  return Array.from(departmentsByName.values())
    .sort((a, b) => a.sno - b.sno)
    .map((department) => ({
      id: department.id,
      label: `${department.department_name} (${department.program_classification} - ${department.program_name})`,
    }));
};

export default function QualifierModule({ onBackToLogin }) {
  const [activeCollegeId, setActiveCollegeId] = useState(() => {
    const storedId = Number(localStorage.getItem('nba_active_college_id'));
    return Number.isInteger(storedId) && storedId > 0 ? storedId : null;
  });
  const [collegeModalOpen, setCollegeModalOpen] = useState(true);

  const [activeTab, setActiveTab] = useState('checklist');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState(null);
  const [activeDepartmentId, setActiveDepartmentId] = useState(null);
  const [colleges, setColleges] = useState([]);
  const [error, setError] = useState(null);

  const fetchColleges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/qualifiers/colleges/');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message || 'Failed to load colleges');
      setColleges(json.colleges || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchData = useCallback(async (collegeId = activeCollegeId) => {
    if (!collegeId) {
      await fetchColleges();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/qualifiers/all/?college_id=${encodeURIComponent(collegeId)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      if (json.status === 'success') {
        setData(json.data);
        if (json.data.config?.id) {
          setActiveCollegeId(json.data.config.id);
          localStorage.setItem('nba_active_college_id', String(json.data.config.id));
        }
      } else {
        throw new Error(json.message || 'Failed to load qualifier data');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeCollegeId, fetchColleges]);

  useEffect(() => {
    fetchColleges();
  }, [fetchColleges]);

  const handleAccessCollege = async (collegeId, password, passwordConfirm) => {
    const res = await fetch('/api/qualifiers/colleges/access/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        college_id: collegeId,
        password,
        password_confirm: passwordConfirm,
      }),
    });
    const json = await res.json();
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || `HTTP error ${res.status}`);
    }
    setData(json.data);
    setActiveCollegeId(json.data.config.id);
    setActiveTab('checklist');
    localStorage.setItem('nba_active_college_id', String(json.data.config.id));
    setError(null);
    setCollegeModalOpen(false);
  };

  // When user creates a new college
  const handleCreateCollege = async (collegePayload) => {
    try {
      const res = await fetch('/api/qualifiers/colleges/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collegePayload),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        throw new Error(json.message || `HTTP error ${res.status}`);
      }
      setData(json.data);
      setColleges(json.data.colleges_list || []);
      if (json.data.config?.id) {
        setActiveCollegeId(json.data.config.id);
        setActiveTab('checklist');
        localStorage.setItem('nba_active_college_id', String(json.data.config.id));
      }
      setError(null);
      setCollegeModalOpen(false);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleSyncGoogleSheet = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/qualifiers/sync-google-sheet/?college_id=${activeCollegeId || ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (json.status === 'success') {
        setData(json.data);
      }
    } catch (err) {
      console.error(err);
      alert('Error syncing from Google Sheet');
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateConfig = async (configUpdates) => {
    try {
      const res = await fetch('/api/qualifiers/config/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...configUpdates, college_id: activeCollegeId }),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        throw new Error(json.message || `HTTP error ${res.status}`);
      }
      setData(json.data);
      setColleges(json.data.colleges_list || []);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleSaveDepartments = async (payload) => {
    try {
      const res = await fetch('/api/qualifiers/departments/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, college_id: activeCollegeId }),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        throw new Error(json.message || `HTTP error ${res.status}`);
      }
      setData(json.data);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleSavePrimaryCheck = async (payload) => {
    try {
      const res = await fetch('/api/qualifiers/primary-check/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, college_id: activeCollegeId }),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        throw new Error(json.message || `HTTP error ${res.status}`);
      }
      setData(json.data);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleSaveFaculty = async (facultyPayload) => {
    const res = await fetch('/api/qualifiers/faculty/save/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...facultyPayload, college_id: activeCollegeId }),
    });
    const json = await res.json();
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || 'Failed to save faculty details.');
    }
    setData(json.data);
  };

  const handleDownloadFacultyTemplate = async (programKey) => {
    const query = new URLSearchParams({
      college_id: activeCollegeId,
      program_key: programKey,
    });
    const res = await fetch(`/api/qualifiers/faculty/template/?${query.toString()}`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Could not download the faculty template.');
    }
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `faculty-roster-template-${programKey}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleUploadFacultyRoster = async (programKey, file) => {
    const formData = new FormData();
    formData.append('college_id', activeCollegeId);
    formData.append('program_key', programKey);
    formData.append('file', file);
    const res = await fetch('/api/qualifiers/faculty/upload/', {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || 'Failed to upload faculty roster.');
    }
    setData(json.data);
  };

  const handleDeleteFaculty = async (facultyId) => {
    try {
      const res = await fetch('/api/qualifiers/faculty/delete/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: facultyId, college_id: activeCollegeId }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setData(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProgramProfile = async (profilePayload) => {
    try {
      const res = await fetch('/api/qualifiers/program-profile/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profilePayload, college_id: activeCollegeId }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setData(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportExcel = () => {
    window.open(`/api/qualifiers/export-excel/?college_id=${activeCollegeId || ''}`, '_blank');
  };

  const googleSheetUrl = data?.config?.google_sheet_url || (
    'https://docs.google.com/spreadsheets/d/1CRPySQV9K3hzANJWNo81o81OI0tWFI3t2PmNL_exQAo/edit?usp=sharing'
  );

  // Identify active program if activeTab is a program key
  const activeProgram = (data?.programs || []).find((p) => p.program_key === activeTab);
  const departmentQualifierData = data?.department_qualifier_data || {};
  const departmentOptions = getDepartmentOptions(data?.departments);
  const selectedDepartmentId = departmentOptions.find(
    (department) => String(department.id) === String(activeDepartmentId),
  )?.id ?? departmentOptions[0]?.id ?? null;
  const selectedDepartmentData = departmentQualifierData[String(selectedDepartmentId)];
  const selectedDepartmentConfig = {
    ...(data?.config || {}),
    ...(selectedDepartmentData?.primary_check || {}),
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: 'var(--bg-main)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Sidebar Navigation */}
      <QualifierSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        config={data?.config || {}}
        departments={data?.departments || []}
        mappings={data?.program_mappings || []}
        programs={data?.programs || []}
        onOpenCollegeSelect={() => setCollegeModalOpen(true)}
        onBackToLogin={onBackToLogin}
      />

      {/* Main Container Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <header
          style={{
            background: 'var(--bg-navbar)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border-navbar)',
            padding: '12px 24px',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* Active College Badge & Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                }}
              >
                <Building2 size={15} color="#10b981" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981' }}>
                  {data?.config?.institution_name || 'Loading College...'}
                </span>
                <button
                  type="button"
                  onClick={() => setCollegeModalOpen(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    padding: '0 4px',
                    textDecoration: 'underline',
                  }}
                >
                  Change
                </button>
              </div>

              <span
                style={{
                  background: 'var(--badge-bg)',
                  color: 'var(--badge-text)',
                  border: '1px solid var(--badge-border)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                {data?.config?.tier_type || 'Tier 1'}
              </span>
            </div>

            {/* Actions: Google Sheet, Sync, Export, Theme */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <a
                href={googleSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  textDecoration: 'none',
                }}
                title="Open live Google Spreadsheet in new tab"
              >
                <FileSpreadsheet size={15} />
                Google Sheet
                <ExternalLink size={12} />
              </a>

              <button
                onClick={handleSyncGoogleSheet}
                disabled={syncing}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Sync or reload data from Google Sheet"
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing...' : 'Sync Sheet'}
              </button>

              <button
                onClick={handleExportExcel}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Download complete college workbook (.xlsx)"
              >
                <Download size={13} /> Export Excel
              </button>

              <ThemeToggle id="qualifier-theme-toggle" showLabel={false} size="sm" />
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main style={{ flex: 1, padding: '24px', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}>
              <Loader2 size={32} className="animate-spin" color="var(--primary)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading College Workspace...</span>
            </div>
          )}

          {error && !loading && (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--grade-d-bg)',
                border: '1px solid var(--grade-d)',
                color: 'var(--grade-d)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <AlertTriangle size={20} />
              <div>
                <strong>Error loading qualifier data:</strong> {error}
              </div>
              <button
                onClick={() => (activeCollegeId ? fetchData(activeCollegeId) : fetchColleges())}
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', fontSize: '0.75rem' }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {departmentOptions.length > 0
                && ['checklist', 'primary'].includes(activeTab)
                && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Department
                    </span>
                    <select
                      value={selectedDepartmentId || ''}
                      onChange={(event) => setActiveDepartmentId(Number(event.target.value))}
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-input)',
                        color: 'var(--text-primary)',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        minWidth: '280px',
                      }}
                    >
                      {departmentOptions.map((department) => (
                        <option key={department.id} value={department.id}>{department.label}</option>
                      ))}
                    </select>
                  </label>
                )}

              {/* Tab 1: Checklist */}
              {activeTab === 'checklist' && (
                <ChecklistTab
                  checklist={selectedDepartmentData?.checklist?.length ? selectedDepartmentData.checklist : data.checklist}
                  programs={(data.programs || []).filter((prog) => {
                    const dept = (data.departments || []).find((d) => String(d.id) === String(selectedDepartmentId));
                    return dept ? prog.dept_sno === dept.sno : prog.program_type === 'master';
                  })}
                  config={selectedDepartmentConfig}
                  onRefresh={() => fetchData()}
                  onUpdateConfig={handleUpdateConfig}
                />
              )}

              {/* Tab 2: Departments */}
              {activeTab === 'departments' && (
                <DepartmentsTab
                  departments={data.departments}
                  mappings={data.program_mappings}
                  config={data.config}
                  onSaveDepartments={handleSaveDepartments}
                />
              )}

              {/* Tab 3: Primary Check */}
              {activeTab === 'primary' && (
                <PrimaryCheckTab
                  key={selectedDepartmentId || 'college'}
                  primaryCheck={selectedDepartmentData?.primary_check || data.primary_check}
                  config={selectedDepartmentConfig}
                  departmentId={selectedDepartmentId}
                  onSavePrimaryCheck={handleSavePrimaryCheck}
                  onUpdateConfig={handleUpdateConfig}
                />
              )}

              {/* Dynamic Program Tab (Master or Allied) */}
              {activeProgram && (
                <ProgramTab
                  program={activeProgram}
                  onSaveFaculty={handleSaveFaculty}
                  onDeleteFaculty={handleDeleteFaculty}
                  onSaveProgramProfile={handleSaveProgramProfile}
                  onDownloadFacultyTemplate={handleDownloadFacultyTemplate}
                  onUploadFacultyRoster={handleUploadFacultyRoster}
                />
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer
          style={{
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-subtle)',
            padding: '14px 24px',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          {data?.config?.institution_name || 'College Workspace'} • NBA Pre-Visit Qualifiers & Allied Matrix Module
        </footer>
      </div>

      {/* College Selection & Creation Modal */}
      {collegeModalOpen && !loading && (
        <CollegeSelectModal
          isOpen={collegeModalOpen}
          colleges={colleges}
          activeCollegeId={activeCollegeId}
          onAccessCollege={handleAccessCollege}
          onCreateCollege={handleCreateCollege}
          onClose={() => setCollegeModalOpen(false)}
        />
      )}
    </div>
  );
}
