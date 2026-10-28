import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import CriterionEvaluation from './components/CriterionEvaluation';
import CriterionSummary from './components/CriterionSummary';
import KRGIDashboard from './components/KRGIDashboard';
import ATRWorkspace from './components/ATRWorkspace';
import AdminAllocation from './components/AdminAllocation';
import ComparisonPage from './components/ComparisonPage';
import CycleFilterBar from './components/CycleFilterBar';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [bootstrap, setBootstrap] = useState(null);
  const [loading, setLoading] = useState(true);

  // Global State
  const [activeTab, setActiveTab] = useState('criteria');
  const [activeCriterionCode, setActiveCriterionCode] = useState('C1');
  const [selectedInstitute, setSelectedInstitute] = useState('KRCT');
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [userRole, setUserRole] = useState('Auditor'); // 'Auditor' | 'HOD' | 'Admin'
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch initial bootstrap configuration
  const fetchBootstrap = async () => {
    try {
      const res = await fetch('/api/bootstrap/');
      const data = await res.json();
      setBootstrap(data);

      if (data.cycles && data.cycles.length > 0) {
        setSelectedCycle(data.active_cycle_id || data.cycles[0].id);
      }

      if (data.departments && data.departments.length > 0) {
        const krctDepts = data.departments.filter(d => d.institute_code === 'KRCT');
        if (krctDepts.length > 0) {
          setSelectedDepartment(krctDepts[0].id);
        } else {
          setSelectedDepartment(data.departments[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load bootstrap data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBootstrap();
  }, []);

  if (loading || !bootstrap) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0f19',
        color: '#f8fafc',
        gap: '16px'
      }}>
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)'
        }}>
          <Loader2 size={30} className="animate-spin" color="#fff" />
        </div>
        <h2 style={{ fontWeight: 800, fontSize: '1.25rem' }}>KRGI Academic Audit System</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading NBA Tier-I audit matrices and rubrics...</p>
      </div>
    );
  }

  const handleLogin = (user) => {
    setCurrentUser(user);
    setUserRole(user.role);
    if (user.role === 'HOD' && user.hod_info) {
      setSelectedInstitute(user.hod_info.institute_code);
      setSelectedDepartment(user.hod_info.department_id);
      setActiveTab('atr');
    } else if (user.role === 'Auditor' && user.auditor_info && user.auditor_info.assignments?.length > 0) {
      const firstAss = user.auditor_info.assignments[0];
      setSelectedInstitute(firstAss.institute_code);
      setSelectedDepartment(firstAss.department_id);
      if (firstAss.assigned_criteria?.length > 0) {
        setActiveCriterionCode(firstAss.assigned_criteria[0]);
      }
      setActiveTab('criteria');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserRole('Auditor');
  };

  const currentDept = bootstrap.departments.find(d => d.id === selectedDepartment);

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
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
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        setUserRole={setUserRole}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onOpenAddDeptModal={() => setActiveTab('allocations')}
      />

      {/* Role / Logged in contextual alert bar */}
      {currentUser && (
        <div style={{
          background: currentUser.role === 'HOD' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.15)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '8px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8rem'
        }}>
          <div>
            {currentUser.role === 'HOD' ? (
              <span>
                🏛️ Logged in as <strong>Head of Department ({currentUser.hod_info?.institute_code} - {currentUser.hod_info?.department_code})</strong>. Review comments, inspect indicators scored &lt; 60%, and enter ATR actions.
              </span>
            ) : currentUser.role === 'Auditor' ? (
              <span>
                🔍 Logged in as <strong>{currentUser.auditor_info?.name}</strong>. Inspecting assigned department criteria.
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
            Switch Account
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '24px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        {cycleFilterTabs[activeTab] && (
          <CycleFilterBar
            cycles={bootstrap.cycles}
            selectedCycle={selectedCycle}
            setSelectedCycle={setSelectedCycle}
            tabLabel={cycleFilterTabs[activeTab]}
          />
        )}

        {activeTab === 'criteria' && (
          <CriterionEvaluation
            criteriaList={bootstrap.criteria}
            activeCriterionCode={activeCriterionCode}
            setActiveCriterionCode={setActiveCriterionCode}
            selectedDepartmentId={selectedDepartment}
            selectedCycleId={selectedCycle}
            departmentInfo={currentDept}
            userRole={userRole}
            onNavigateToATR={() => setActiveTab('atr')}
          />
        )}

        {activeTab === 'summary' && (
          <CriterionSummary
            selectedDepartmentId={selectedDepartment}
            selectedCycleId={selectedCycle}
            onSelectCriterion={(code) => {
              setActiveCriterionCode(code);
              setActiveTab('criteria');
            }}
          />
        )}

        {activeTab === 'dashboard' && (
          <KRGIDashboard
            selectedCycleId={selectedCycle}
            onSelectDepartment={(deptId, instCode) => {
              setSelectedInstitute(instCode);
              setSelectedDepartment(deptId);
              setActiveTab('summary');
            }}
          />
        )}

        {activeTab === 'atr' && (
          <ATRWorkspace
            institutes={bootstrap.institutes}
            criteriaList={bootstrap.criteria}
            departmentInfo={currentDept}
            selectedDepartmentId={selectedDepartment}
            selectedCycleId={selectedCycle}
            userRole={userRole}
          />
        )}

        {activeTab === 'allocations' && (
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

        {activeTab === 'comparison' && (
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
