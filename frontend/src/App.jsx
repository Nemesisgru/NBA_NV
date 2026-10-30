import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import CriterionEvaluation from './components/CriterionEvaluation';
import CriterionSummary from './components/CriterionSummary';
import KRGIDashboard from './components/KRGIDashboard';
import ATRWorkspace from './components/ATRWorkspace';
import AdminAllocation from './components/AdminAllocation';
import ComparisonPage from './components/ComparisonPage';
import CycleFilterBar from './components/CycleFilterBar';
import LoginPage from './components/LoginPage';
import { Loader2 } from 'lucide-react';

// Tabs each role may open; the backend enforces the same limits on the API
const ROLE_TABS = {
  Admin: ['criteria', 'summary', 'dashboard', 'atr', 'allocations', 'comparison'],
  Auditor: ['criteria', 'summary', 'atr'],
  HOD: ['criteria', 'summary', 'atr']
};

export default function App() {
  const [bootstrap, setBootstrap] = useState(null);
  const [loading, setLoading] = useState(true);

  // Global State
  const [activeTab, setActiveTab] = useState('criteria');
  const [activeCriterionCode, setActiveCriterionCode] = useState('C1');
  const [selectedInstitute, setSelectedInstitute] = useState('KRCT');
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const userRole = currentUser?.role; // 'Auditor' | 'HOD' | 'Admin'

  // Load reference data (scoped to the user by the backend) and pick the user's starting context
  const startSession = async (user) => {
    setLoading(true);
    try {
      const res = await fetch('/api/bootstrap/');
      if (!res.ok) throw new Error(`bootstrap ${res.status}`);
      const data = await res.json();

      let cycleId = data.active_cycle_id || data.cycles[0]?.id;
      let dept = data.departments.find(d => d.institute_code === 'KRCT') || data.departments[0];
      let tab = 'criteria';
      let criterion = 'C1';

      if (user.role === 'HOD' && user.hod_info) {
        dept = data.departments.find(d => d.id === user.hod_info.department_id) || dept;
      } else if (user.role === 'Auditor') {
        // Start on the most recent cycle the auditor has an allocation in
        const assignments = [...(user.auditor_info?.assignments || [])].sort((a, b) => b.cycle_id - a.cycle_id);
        if (assignments.length > 0) {
          const first = assignments[0];
          cycleId = first.cycle_id;
          dept = data.departments.find(d => d.id === first.department_id) || dept;
          criterion = first.assigned_criteria?.[0] || criterion;
        }
      }

      setBootstrap(data);
      setSelectedCycle(cycleId);
      setSelectedDepartment(dept ? dept.id : null);
      setSelectedInstitute(dept ? dept.institute_code : '');
      setActiveCriterionCode(criterion);
      setActiveTab(tab);
      setCurrentUser(user);
    } catch (err) {
      console.error("Failed to load bootstrap data:", err);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const resetSession = () => {
    setCurrentUser(null);
    setBootstrap(null);
    setLoading(false);
  };

  // Restore an existing session on page load, and drop back to the login page if it expires
  useEffect(() => {
    fetch('/api/auth/me/')
      .then(res => (res.ok ? res.json() : null))
      .then(data => (data?.user ? startSession(data.user) : resetSession()))
      .catch(resetSession);

    window.addEventListener('auth:expired', resetSession);
    return () => window.removeEventListener('auth:expired', resetSession);
  }, []);

  if (!loading && !currentUser) {
    return <LoginPage onLogin={startSession} />;
  }

  if (loading || !bootstrap) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
        color: 'var(--text-primary)',
        gap: '16px'
      }}>
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #F54927 0%, #f97316 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(245, 73, 39, 0.4)'
        }}>
          <Loader2 size={30} className="animate-spin" color="#fff" />
        </div>
        <h2 style={{ fontWeight: 800, fontSize: '1.25rem' }}>KRGI Academic Audit System</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading NBA Tier-I audit matrices and rubrics...</p>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout/', { method: 'POST' });
    } finally {
      resetSession();
    }
  };

  const allowedTabs = ROLE_TABS[userRole] || [];
  const currentTab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0];
  const currentDept = bootstrap.departments.find(d => d.id === selectedDepartment);

  // Criteria this auditor may score for the selected department and cycle
  const auditorCriteria = userRole === 'Auditor'
    ? (currentUser.auditor_info?.assignments || [])
        .filter(a => a.department_id === selectedDepartment && a.cycle_id === selectedCycle)
        .flatMap(a => a.assigned_criteria || [])
    : null;

  // Tabs that show the year/cycle filter bar (synced with the ribbon cycle picker)
  const cycleFilterTabs = {
    criteria: 'criteria evaluation',
    summary: 'criterion summary',
    dashboard: 'KRGI dashboard',
    atr: 'action taken reports',
    allocations: 'auditor allocations'
  };

  const handleDepartmentAdded = (newDept) => {
    setBootstrap(prev => ({
      ...prev,
      departments: [...prev.departments, newDept]
    }));
    setSelectedDepartment(newDept.id);
  };

  const handleAuditorAdded = (newAuditor) => {
    setBootstrap(prev => ({
      ...prev,
      auditors: [...prev.auditors, newAuditor]
    }));
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      
      {/* Top Navbar */}
      <Navbar
        institutes={bootstrap.institutes}
        departments={bootstrap.departments}
        cycles={bootstrap.cycles}
        selectedInstitute={selectedInstitute}
        setSelectedInstitute={setSelectedInstitute}
        selectedDepartment={selectedDepartment}
        setSelectedDepartment={setSelectedDepartment}
        selectedCycle={selectedCycle}
        setSelectedCycle={setSelectedCycle}
        activeTab={currentTab}
        setActiveTab={setActiveTab}
        allowedTabs={allowedTabs}
        userRole={userRole}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Role / Logged in contextual alert bar */}
      {currentUser && (
        <div style={{
          background: currentUser.role === 'HOD' ? 'rgba(245, 158, 11, 0.12)' : 'var(--primary-light)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '8px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8rem',
          color: 'var(--text-primary)'
        }}>
          <div>
            {currentUser.role === 'HOD' ? (
              <span>
                🏛️ Logged in as <strong>Head of Department ({currentUser.hod_info?.institute_code} - {currentUser.hod_info?.department_code})</strong>. The auditor's report is view-only; enter your root cause and action plan in the Action Taken Report.
              </span>
            ) : currentUser.role === 'Auditor' ? (
              <span>
                🔍 Logged in as <strong>{currentUser.auditor_info?.name}</strong>.{' '}
                {auditorCriteria.length > 0
                  ? <>You can evaluate <strong>{auditorCriteria.join(', ')}</strong> for this department; other criteria are view-only.</>
                  : <>You have no criteria allocated for this department in the selected cycle (view-only).</>}
              </span>
            ) : (
              <span>
                👑 Logged in as <strong>Administrator</strong>. Full audit governance access.
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.75rem' }}
          >
            Log out
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '24px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        {cycleFilterTabs[currentTab] && (
          <CycleFilterBar
            cycles={bootstrap.cycles}
            selectedCycle={selectedCycle}
            setSelectedCycle={setSelectedCycle}
            tabLabel={cycleFilterTabs[currentTab]}
          />
        )}

        {currentTab === 'criteria' && (
          <CriterionEvaluation
            criteriaList={bootstrap.criteria}
            activeCriterionCode={activeCriterionCode}
            setActiveCriterionCode={setActiveCriterionCode}
            selectedDepartmentId={selectedDepartment}
            selectedCycleId={selectedCycle}
            departmentInfo={currentDept}
            userRole={userRole}
            editableCriteria={auditorCriteria}
            onNavigateToATR={() => setActiveTab('atr')}
          />
        )}

        {currentTab === 'summary' && (
          <CriterionSummary
            selectedDepartmentId={selectedDepartment}
            selectedCycleId={selectedCycle}
            onSelectCriterion={(code) => {
              setActiveCriterionCode(code);
              setActiveTab('criteria');
            }}
          />
        )}

        {currentTab === 'dashboard' && (
          <KRGIDashboard
            selectedCycleId={selectedCycle}
            onSelectDepartment={(deptId, instCode) => {
              setSelectedInstitute(instCode);
              setSelectedDepartment(deptId);
              setActiveTab('summary');
            }}
          />
        )}

        {currentTab === 'atr' && (
          <ATRWorkspace
            institutes={bootstrap.institutes}
            criteriaList={bootstrap.criteria}
            departmentInfo={currentDept}
            selectedDepartmentId={selectedDepartment}
            selectedCycleId={selectedCycle}
            userRole={userRole}
          />
        )}

        {currentTab === 'allocations' && (
          <AdminAllocation
            institutes={bootstrap.institutes}
            departments={bootstrap.departments}
            auditors={bootstrap.auditors}
            cycles={bootstrap.cycles}
            selectedCycleId={selectedCycle}
            criteriaList={bootstrap.criteria}
            onDepartmentAdded={handleDepartmentAdded}
            onAuditorAdded={handleAuditorAdded}
          />
        )}

        {currentTab === 'comparison' && (
          <ComparisonPage
            departments={bootstrap.departments}
            selectedCycleId={selectedCycle}
            criteriaList={bootstrap.criteria}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        background: '#0d131f',
        borderTop: '1px solid #1a2536',
        padding: '16px 24px',
        textAlign: 'center',
        fontSize: '0.775rem',
        color: '#64748b'
      }}>
        KRGI Academic Audit System • Aligned with NBA Tier-I Self Assessment Report (SAR) Criteria 1-9 • K. Ramakrishnan Group of Institutions
      </footer>

    </div>
  );
}
